// Offline & PWA Synchronization Management System for Maktabati
import { Invoice, DBState, Customer, Product, StockMovement, CustomerPayment, SupplierPayment } from '../types';
import { fsdb, fsauth, defaultDB, auditActor } from './firebase';
import { uid, todayStr, stockMovementId } from './utils';
import { findFirstOpenBusinessDay } from './businessCalendar';

export interface QueuedOfflineOperation {
  id: string;
  type: 'invoice' | 'salesReturn' | 'purchase' | 'purchaseReturn' | 'expense' | 'customer' | 'stockAdjustment' | 'userProfile' | 'cashier' | 'customerPayment' | 'supplierPayment';
  title: string;
  createdAt: string;
  ownerUid?: string;
  payload: any;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  errorMsg?: string;
  retryCount: number;
}

const OFFLINE_QUEUE_KEY = 'maktabati_offline_operations_v2';
const OFFLINE_COUNTER_KEY = 'maktabati_offline_counters_v2';

/**
 * Checks if a Firestore / Network error is strictly a transient connectivity failure
 * that qualifies for offline fallback / retry, rather than a business logic or validation rejection.
 *
 * Must strictly return FALSE for business logic errors:
 * - Insufficient stock
 * - Product not found
 * - Operation key already committed
 * - Permission denied
 * - Bad request / validation failure
 */
export function isNetworkOrTransientError(err: any): boolean {
  if (!err) return false;

  // 1. Explicit business logic messages or custom application exceptions
  const msg = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  if (
    msg.includes('كمية غير كافية') ||
    msg.includes('غير كافية للصنف') ||
    msg.includes('غير موجود') ||
    msg.includes('مستخدم مسبق') ||
    msg.includes('insufficient') ||
    msg.includes('already exists') ||
    msg.includes('validation') ||
    msg.includes('invalid') ||
    msg.includes('permission-denied') ||
    msg.includes('permission denied')
  ) {
    return false;
  }

  // 2. Check Firebase / Firestore error codes
  const code = (typeof err.code === 'string' ? err.code : '').toLowerCase();
  if (code) {
    // Known transient / connectivity error codes in Firebase / gRPC
    const transientCodes = [
      'unavailable',
      'deadline-exceeded',
      'network-request-failed',
      'resource-exhausted',
      'cancelled',
      'aborted',
      'timeout',
      'failed-precondition' // only if network connection failed precondition
    ];

    if (code === 'permission-denied' || code === 'not-found' || code === 'already-exists' || code === 'invalid-argument') {
      return false;
    }

    if (transientCodes.includes(code)) {
      return true;
    }
  }

  // 3. Known network / offline phrases in error message or name
  if (
    msg.includes('unavailable') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('client is offline') ||
    msg.includes('could not reach') ||
    msg.includes('connection refused') ||
    msg.includes('offline') ||
    msg.includes('timeout') ||
    msg.includes('deadline exceeded')
  ) {
    return true;
  }

  // 4. Fallback check: navigator offline state if error occurred during network call
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  // Default to false: Any unknown or uncategorized error MUST NOT silently fall back to offline
  return false;
}

export class OfflineSyncManager {
  private static listeners: Array<(queue: QueuedOfflineOperation[]) => void> = [];

  // Get all pending operations
  static getQueue(): QueuedOfflineOperation[] {
    try {
      const data = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (_e) {
      return [];
    }
  }

  // Save queue
  static saveQueue(queue: QueuedOfflineOperation[]): void {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      this.notifyListeners(queue);
    } catch (e) {
      console.error('Failed to save offline queue to localStorage', e);
    }
  }

  // Subscribe to queue changes
  static subscribe(fn: (queue: QueuedOfflineOperation[]) => void): () => void {
    this.listeners.push(fn);
    fn(this.getQueue());
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private static notifyListeners(queue: QueuedOfflineOperation[]): void {
    this.listeners.forEach(fn => {
      try {
        fn(queue);
      } catch (_e) {}
    });
  }

  // Calculate next sequential invoice number safely (taking local DB max + offline queue into account)
  static getNextInvoiceNumber(existingInvoices: Invoice[] = []): number {
    const highestDbNumber = existingInvoices.reduce((max, inv) => {
      const num = Number(inv.number) || 0;
      return num > max ? num : max;
    }, 0);

    const queuedInvoices = this.getQueue().filter(q => q.type === 'invoice' && q.status !== 'synced');
    const highestQueuedNumber = queuedInvoices.reduce((max, q) => {
      const num = Number(q.payload?.invoice?.number) || 0;
      return num > max ? num : max;
    }, 0);

    let storedCounter = 0;
    try {
      const counters = JSON.parse(localStorage.getItem(OFFLINE_COUNTER_KEY) || '{}');
      storedCounter = Number(counters.invoice) || 0;
    } catch {}

    const nextNumber = Math.max(highestDbNumber, highestQueuedNumber, storedCounter) + 1;

    // Update stored counter
    try {
      const counters = JSON.parse(localStorage.getItem(OFFLINE_COUNTER_KEY) || '{}');
      counters.invoice = nextNumber;
      localStorage.setItem(OFFLINE_COUNTER_KEY, JSON.stringify(counters));
    } catch {}

    return nextNumber;
  }

  // Add an invoice to offline queue
  static enqueueInvoice(data: {
    opId?: string;
    invoice: Invoice;
    stockDeductions: Array<{ productId: string; newQty: number; delta: number; name: string }>;
    customerUpdate?: { customerId: string; balance: { invoiced: number; paid: number }; loyaltyPoints: number };
    stockMovements: StockMovement[];
  }): QueuedOfflineOperation {
    // Single Source of Truth: ensure op.id strictly matches invoice.operationId or opId
    const opId = data.opId || data.invoice.operationId || ('op_' + data.invoice.id);
    if (!data.invoice.operationId) {
      data.invoice.operationId = opId;
    }

    const currentAuthUid = fsauth.currentUser?.uid || auditActor().uid;
    // Bind invoice creator/actor to authenticated user
    if (!data.invoice.actorUid) data.invoice.actorUid = currentAuthUid;
    if (!data.invoice.createdBy) data.invoice.createdBy = currentAuthUid;

    const op: QueuedOfflineOperation = {
      id: opId,
      type: 'invoice',
      title: `فاتورة بيع #${data.invoice.number} (${data.invoice.customerName || 'عميل نقدي'}) — ${data.invoice.total} ج`,
      createdAt: new Date().toISOString(),
      ownerUid: currentAuthUid,
      payload: data,
      status: 'pending',
      retryCount: 0
    };

    const queue = this.getQueue();
    queue.push(op);
    this.saveQueue(queue);
    return op;
  }

  // Add a generic operation to queue
  static enqueueGeneric(type: QueuedOfflineOperation['type'], title: string, payload: any): QueuedOfflineOperation {
    const currentAuthUid = fsauth.currentUser?.uid || auditActor().uid;
    // Bind payload identity if present
    if (payload && typeof payload === 'object') {
      if (payload.actorUid === undefined) payload.actorUid = currentAuthUid;
      if (payload.createdBy === undefined) payload.createdBy = currentAuthUid;
    }

    const op: QueuedOfflineOperation = {
      id: uid(),
      type,
      title,
      createdAt: new Date().toISOString(),
      ownerUid: currentAuthUid,
      payload,
      status: 'pending',
      retryCount: 0
    };

    const queue = this.getQueue();
    queue.push(op);
    this.saveQueue(queue);
    return op;
  }

  // Add customer payment to offline queue
  static enqueueCustomerPayment(payment: CustomerPayment): QueuedOfflineOperation {
    const currentAuthUid = fsauth.currentUser?.uid || auditActor().uid;
    if (!payment.actorUid) payment.actorUid = currentAuthUid;
    if (!payment.createdBy) payment.createdBy = currentAuthUid;
    return this.enqueueGeneric(
      'customerPayment',
      `تحصيل عميل: ${payment.customerName || payment.customerId} (${payment.amount} ج)`,
      { payment }
    );
  }

  // Add supplier payment to offline queue
  static enqueueSupplierPayment(payment: SupplierPayment): QueuedOfflineOperation {
    const currentAuthUid = fsauth.currentUser?.uid || auditActor().uid;
    if (!payment.actorUid) payment.actorUid = currentAuthUid;
    if (!payment.createdBy) payment.createdBy = currentAuthUid;
    return this.enqueueGeneric(
      'supplierPayment',
      `سداد مورد: ${payment.supplierName || payment.supplierId} (${payment.amount} ج)`,
      { payment }
    );
  }

  // Remove item by ID
  static removeItem(id: string): void {
    const queue = this.getQueue().filter(q => q.id !== id);
    this.saveQueue(queue);
  }

  // Clear all synced/all items
  static clearQueue(onlySynced = false): void {
    if (onlySynced) {
      const queue = this.getQueue().filter(q => q.status !== 'synced');
      this.saveQueue(queue);
    } else {
      this.saveQueue([]);
    }
  }

  // Execute single queued item to Firestore using atomic transactions and relative deltas
  static async syncSingleOperation(op: QueuedOfflineOperation): Promise<boolean> {
    const actor = auditActor();

    if (op.type === 'invoice') {
      const { invoice, stockDeductions } = op.payload;
      const invoiceId = invoice.id;
      const opId = invoice.operationId || invoiceId;

      const opRef = fsdb.collection('operationKeys').doc(opId);
      const invRef = fsdb.collection('invoices').doc(invoiceId);
      const counterRef = fsdb.collection('meta').doc('counters');
      const customerRef = invoice.customerId ? fsdb.collection('customers').doc(invoice.customerId) : null;

      // Determine physical deductions and movements to process:
      // Single Source of Truth: Favor existing stockMovements if available in payload.
      // Otherwise reconstruct without ANY grouping or aggregation.
      const rawMovements: StockMovement[] = Array.isArray(op.payload.stockMovements) && op.payload.stockMovements.length > 0
        ? op.payload.stockMovements
        : [];

      // Build physical deduction list strictly 1-to-1 without grouping/collapsing duplicate productIds
      interface PhysicalItemDeduction {
        productId: string;
        qty: number;
        name: string;
        originalIndex: number;
        precomputedMid?: string;
        note?: string;
        barcode?: string;
      }

      const deductionsList: PhysicalItemDeduction[] = [];

      if (rawMovements.length > 0) {
        // Use the exact physical movements created at offline save time
        rawMovements.forEach((mv, idx) => {
          if (mv.productId) {
            deductionsList.push({
              productId: mv.productId,
              qty: Math.abs(Number(mv.delta) || 0),
              name: mv.productName || 'صنف مباع',
              originalIndex: idx,
              precomputedMid: mv.id,
              note: mv.note,
              barcode: mv.barcode
            });
          }
        });
      } else if (Array.isArray(stockDeductions) && stockDeductions.length > 0) {
        stockDeductions.forEach((it, idx) => {
          if (it.productId) {
            deductionsList.push({
              productId: it.productId,
              qty: Math.abs(Number(it.delta) || 0) || (Number((it as any).qty) || 0),
              name: it.name || 'صنف مباع',
              originalIndex: idx
            });
          }
        });
      } else if (Array.isArray(invoice.items)) {
        invoice.items.forEach((it, idx) => {
          if (it.productId) {
            deductionsList.push({
              productId: it.productId,
              qty: Number(it.qty) || 0,
              name: it.name || 'صنف مباع',
              originalIndex: idx
            });
          }
        });
      }

      // Collect unique product IDs for Firestore document references
      const uniqueProductIds = Array.from(new Set(deductionsList.map(d => d.productId)));
      const productRefs = uniqueProductIds.map(id => fsdb.collection('products').doc(id));

      await fsdb.runTransaction(async tx => {
        const reads = await Promise.all([
          tx.get(opRef),
          tx.get(invRef),
          tx.get(counterRef),
          ...(customerRef ? [tx.get(customerRef)] : []),
          ...productRefs.map(ref => tx.get(ref))
        ]);

        const opSnap = reads[0];
        const invSnap = reads[1];
        const counterSnap = reads[2];

        // Case 1: opSnap exists -> transaction was already atomically committed. Exit immediately without modifying anything.
        if (opSnap.exists) {
          return;
        }

        // Check if invoice doc exists without opSnap (Cases 3, 4, 5)
        if (invSnap.exists) {
          const existingInvData = (invSnap.data() || {}) as Partial<Invoice>;
          const existingOpId = existingInvData.operationId;

          if (existingOpId && existingOpId === opId) {
            // Case 3: invoice exists with matching operationId, but operationKey is missing.
            // Under strict integrity rules, we CANNOT guess that products/customers/counters were completely committed.
            // We DO NOT write operationKey, DO NOT re-deduct stock, DO NOT modify customer balance.
            // Abort and flag as conflict requiring manual review.
            throw new Error(`تعارض في مزامنة الفاتورة #${invoice.number}: الفاتورة موجودة ولكن لم يثبت اكتمال معاملتها الذرية السابقة (تتطلب مراجعة يدوية لحفظ سلامة المخزون)`);
          } else if (existingOpId && existingOpId !== opId) {
            // Case 4: invoice exists with a DIFFERENT operationId.
            // Strict refusal to overwrite existing invoice belonging to another operation.
            throw new Error(`تعارض أمني في معرف الفاتورة #${invoice.number}: معرف الفاتورة مسجل لعملية أخرى (${existingOpId}) ولا يمكن الكتابة فوقه`);
          } else {
            // Case 5: invoice exists without an operationId (Legacy Partial Write).
            // Under strict integrity rules, we do NOT guess, do NOT delete, do NOT re-deduct, do NOT heal blindly.
            throw new Error(`فاتورة سابقة بدون معرف عملية (Legacy #${invoice.number}): لا يمكن إثبات اكتمالها بأمان وتتطلب مراجعة يدوية`);
          }
        }

        // Case 2: !opSnap.exists && !invSnap.exists -> Proceed with full atomic transaction for the first time
        const customerSnap = customerRef ? reads[3] : null;
        const productSnaps = reads.slice(customerRef ? 4 : 3);
        const productSnapMap: Record<string, any> = {};
        productRefs.forEach((ref, idx) => {
          productSnapMap[ref.id] = productSnaps[idx];
        });

        // 1. Strict Stock Validation before ANY write operation:
        // Calculate total required quantity per unique product to prevent duplicate items from overdrafting
        const totalRequiredByProduct: Record<string, number> = {};
        for (const d of deductionsList) {
          totalRequiredByProduct[d.productId] = (totalRequiredByProduct[d.productId] || 0) + d.qty;
        }

        for (const prodId of uniqueProductIds) {
          const snap = productSnapMap[prodId];
          if (!snap || !snap.exists) {
            const sampleItem = deductionsList.find(d => d.productId === prodId);
            throw new Error(`الصنف غير موجود على السحابة: ${sampleItem?.name || prodId}`);
          }

          const currentLiveQty = Number(snap.data()?.qty) || 0;
          const requiredQty = totalRequiredByProduct[prodId] || 0;

          if (currentLiveQty < requiredQty) {
            const sampleItem = deductionsList.find(d => d.productId === prodId);
            throw new Error(
              `الكمية غير كافية للصنف: ${sampleItem?.name || prodId} (المتاح في السحابة: ${currentLiveQty} والمطلوب: ${requiredQty})`
            );
          }
        }

        // 2. Process Product Stock Updates:
        // Compute new quantities using totalRequiredByProduct on live values
        for (const prodId of uniqueProductIds) {
          const snap = productSnapMap[prodId];
          const currentLiveQty = Number(snap.data()?.qty) || 0;
          const requiredQty = totalRequiredByProduct[prodId] || 0;
          const newLiveQty = currentLiveQty - requiredQty;

          tx.update(fsdb.collection('products').doc(prodId), {
            qty: newLiveQty,
            lastOperationId: opId,
            lastOperationType: 'sale',
            lastOperationActorUid: actor.uid
          });
        }

        // 3. Process Stock Movements:
        // Guarantee 1-to-1 fidelity with original deductions without collapsing duplicates
        // Maintain intermediate qty tracking for movements on identical products
        const runningQtyTracker: Record<string, number> = {};
        for (const prodId of uniqueProductIds) {
          const snap = productSnapMap[prodId];
          runningQtyTracker[prodId] = Number(snap.data()?.qty) || 0;
        }

        for (const d of deductionsList) {
          const snap = productSnapMap[d.productId];
          const qtyBefore = runningQtyTracker[d.productId];
          const qtyAfter = qtyBefore - d.qty;
          runningQtyTracker[d.productId] = qtyAfter;

          // Deterministic Stock Movement ID:
          // If precomputed ID was provided from offline save, use it directly.
          // Otherwise calculate sm_${opId}_${d.productId}_${d.originalIndex}.
          const mid = d.precomputedMid || `sm_${opId}_${d.productId}_${d.originalIndex}`;
          tx.set(fsdb.collection('stockMovements').doc(mid), {
            id: mid,
            date: invoice.date || todayStr(),
            createdAt: new Date().toISOString(),
            type: 'sale',
            productId: d.productId,
            productName: d.name || snap?.data()?.name || 'صنف مباع',
            barcode: d.barcode || snap?.data()?.barcode || '',
            qtyBefore,
            delta: -d.qty,
            qtyAfter,
            referenceId: invoiceId,
            referenceNumber: invoice.number,
            note: d.note || 'مزامنة بيع مع السحابة (تطبيق الخصم النسبي)',
            actorUid: actor.uid,
            createdBy: actor.uid,
            isOfflineSync: true
          });
        }

        // 2. Process Customer Balance with REAL LIVE cloud balance
        if (customerRef && customerSnap?.exists) {
          const currentBal = customerSnap.data().balance || { invoiced: 0, paid: 0 };
          const netTotal = Number(invoice.total) || 0;
          const paid = Number(invoice.paidAmount ?? invoice.total ?? 0);

          const newInvoiced = (Number(currentBal.invoiced) || 0) + netTotal;
          const newPaid = (Number(currentBal.paid) || 0) + paid;

          const currentPoints = Number(customerSnap.data().loyaltyPoints) || 0;
          const usedPts = Number(invoice.usedPoints) || 0;
          const earnedPts = Number(invoice.earnedPoints) || 0;
          const newPoints = Math.max(0, currentPoints - usedPts + earnedPts);

          tx.update(customerRef, {
            balance: { invoiced: newInvoiced, paid: newPaid, updatedAt: new Date().toISOString() },
            loyaltyPoints: newPoints
          });
        }

        // 3. Counter update
        const counterData = counterSnap.exists ? counterSnap.data() || {} : {};
        const currentCounter = Number(counterData.invoice) || 0;
        if (Number(invoice.number) > currentCounter) {
          tx.set(counterRef, { invoice: Number(invoice.number) }, { merge: true });
        }

        // 4. Invoice document
        tx.set(invRef, {
          ...invoice,
          isOfflineDraft: false,
          isOfflineSync: true,
          syncedAt: new Date().toISOString()
        });

        // 5. Operation key
        tx.set(opRef, {
          id: opId,
          type: 'sale',
          targetId: invoiceId,
          number: invoice.number,
          date: invoice.date || todayStr(),
          createdAt: invoice.createdAt || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
          actorUid: actor.uid
        });
      });

      return true;
    }

    if (op.type === 'salesReturn') {
      const { returnDoc, stockAdditions } = op.payload;
      const returnId = returnDoc.id;
      const opId = returnDoc.operationId || returnId;

      const opRef = fsdb.collection('operationKeys').doc(opId);
      const returnRef = fsdb.collection('salesReturns').doc(returnId);
      const customerRef = returnDoc.customerId ? fsdb.collection('customers').doc(returnDoc.customerId) : null;

      // Deltas: returned items have +delta, exchange items have -delta
      const deltas: Record<string, { delta: number; name: string }> = {};
      if (Array.isArray(returnDoc.items)) {
        for (const it of returnDoc.items) {
          if (it.productId) {
            const current = deltas[it.productId]?.delta || 0;
            deltas[it.productId] = { delta: current + (Number(it.qty) || 0), name: it.name };
          }
        }
      }
      if (Array.isArray(returnDoc.exchangeItems)) {
        for (const it of returnDoc.exchangeItems) {
          if (it.productId) {
            const current = deltas[it.productId]?.delta || 0;
            deltas[it.productId] = { delta: current - (Number(it.qty) || 0), name: it.name };
          }
        }
      }
      if (Object.keys(deltas).length === 0 && Array.isArray(stockAdditions)) {
        for (const it of stockAdditions) {
          if (it.productId) {
            const current = deltas[it.productId]?.delta || 0;
            deltas[it.productId] = { delta: current + (Number(it.qty) || Math.abs(Number(it.delta) || 0)), name: it.name || '' };
          }
        }
      }

      const productIds = Object.keys(deltas);
      const productRefs = productIds.map(id => fsdb.collection('products').doc(id));

      await fsdb.runTransaction(async tx => {
        const reads = await Promise.all([
          tx.get(opRef),
          tx.get(returnRef),
          ...(customerRef ? [tx.get(customerRef)] : []),
          ...productRefs.map(ref => tx.get(ref))
        ]);

        const opSnap = reads[0];
        const retSnap = reads[1];
        if (opSnap.exists || retSnap.exists) {
          return;
        }

        const customerSnap = customerRef ? reads[2] : null;
        const productSnaps = reads.slice(customerRef ? 3 : 2);
        const productSnapMap: Record<string, any> = {};
        productRefs.forEach((ref, idx) => {
          productSnapMap[ref.id] = productSnaps[idx];
        });

        // 1. Update each product relative stock
        productIds.forEach((pId, idx) => {
          const { delta, name } = deltas[pId];
          const snap = productSnapMap[pId];
          const currentLiveQty = snap?.exists ? (Number(snap.data()?.qty) || 0) : 0;
          const newLiveQty = currentLiveQty + delta;

          if (snap?.exists) {
            tx.update(fsdb.collection('products').doc(pId), {
              qty: newLiveQty,
              lastOperationId: opId,
              lastOperationType: 'return',
              lastOperationActorUid: actor.uid
            });
          }

          const mid = stockMovementId(opId, pId, `return_sync_${idx}`);
          tx.set(fsdb.collection('stockMovements').doc(mid), {
            id: mid,
            date: returnDoc.date || todayStr(),
            createdAt: new Date().toISOString(),
            type: delta > 0 ? 'return' : 'sale',
            productId: pId,
            productName: name || snap?.data()?.name || 'صنف مرتجع',
            barcode: snap?.data()?.barcode || '',
            qtyBefore: currentLiveQty,
            delta,
            qtyAfter: newLiveQty,
            referenceId: returnId,
            referenceNumber: returnDoc.number || returnDoc.id,
            note: 'مزامنة مرتجع مبيعات مع السحابة (تطبيق إضافة/خصم نسبي)',
            operationId: opId,
            actorUid: actor.uid,
            createdBy: actor.uid,
            isOfflineSync: true
          });
        });

        // 2. Update Customer Balance relative to live data
        if (customerRef && customerSnap?.exists) {
          const currentBal = customerSnap.data().balance || { invoiced: 0, paid: 0 };
          const creditReduction = Number(returnDoc.creditReduction) || 0;
          const newInvoiced = Math.max(0, (Number(currentBal.invoiced) || 0) - creditReduction);
          tx.update(customerRef, {
            balance: {
              invoiced: newInvoiced,
              paid: Number(currentBal.paid) || 0,
              updatedAt: new Date().toISOString()
            }
          });
        }

        tx.set(returnRef, {
          ...returnDoc,
          isOfflineSync: true,
          syncedAt: new Date().toISOString()
        });

        tx.set(opRef, {
          id: opId,
          type: 'return',
          targetId: returnId,
          number: returnDoc.number || returnDoc.id,
          date: returnDoc.date || todayStr(),
          createdAt: returnDoc.createdAt || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
          actorUid: actor.uid
        });
      });

      return true;
    }

    if (op.type === 'expense') {
      await fsdb.collection('expenses').doc(op.payload.id).set(op.payload);
      return true;
    }

    if (op.type === 'purchase') {
      const { purchase, stockAdditions } = op.payload;
      const purchaseId = purchase.id;
      const opId = purchase.operationId || purchaseId;

      const opRef = fsdb.collection('operationKeys').doc(opId);
      const purchaseRef = fsdb.collection('purchases').doc(purchaseId);
      const counterRef = fsdb.collection('meta').doc('counters');
      const supplierRef = purchase.supplierId ? fsdb.collection('suppliers').doc(purchase.supplierId) : null;

      const itemsToAdd: Array<{ productId: string; qty: number; cost: number; sellPrice?: number; name?: string }> = [];
      if (Array.isArray(purchase.items)) {
        for (const it of purchase.items) {
          if (it.productId) {
            itemsToAdd.push({
              productId: it.productId,
              qty: Number(it.qty) || 0,
              cost: Number(it.cost) || 0,
              sellPrice: it.sellPrice,
              name: it.name
            });
          }
        }
      } else if (Array.isArray(stockAdditions)) {
        for (const it of stockAdditions) {
          if (it.productId) {
            itemsToAdd.push({
              productId: it.productId,
              qty: Number(it.qty) || Number(it.delta) || 0,
              cost: Number(it.costPrice) || 0,
              name: it.name
            });
          }
        }
      }

      const productRefs = itemsToAdd.map(it => fsdb.collection('products').doc(it.productId));

      await fsdb.runTransaction(async tx => {
        const reads = await Promise.all([
          tx.get(opRef),
          tx.get(purchaseRef),
          tx.get(counterRef),
          ...(supplierRef ? [tx.get(supplierRef)] : []),
          ...productRefs.map(ref => tx.get(ref))
        ]);

        const opSnap = reads[0];
        const purSnap = reads[1];
        const counterSnap = reads[2];
        if (opSnap.exists || purSnap.exists) {
          return;
        }

        const supplierSnap = supplierRef ? reads[3] : null;
        const productSnaps = reads.slice(supplierRef ? 4 : 3);
        const productSnapMap: Record<string, any> = {};
        productRefs.forEach((ref, idx) => {
          productSnapMap[ref.id] = productSnaps[idx];
        });

        // 1. Product quantities and weighted average cost based on LIVE stock
        for (let idx = 0; idx < itemsToAdd.length; idx++) {
          const it = itemsToAdd[idx];
          const snap = productSnapMap[it.productId];
          const currentLiveQty = snap?.exists ? (Number(snap.data()?.qty) || 0) : 0;
          const currentLiveCost = snap?.exists ? (Number(snap.data()?.costPrice) || 0) : 0;

          const newLiveQty = currentLiveQty + it.qty;
          const newCost = newLiveQty > 0 ? (currentLiveQty * currentLiveCost + it.qty * it.cost) / newLiveQty : it.cost;

          if (snap?.exists) {
            tx.update(fsdb.collection('products').doc(it.productId), {
              qty: newLiveQty,
              costPrice: newCost,
              sellPrice: it.sellPrice !== undefined ? it.sellPrice : snap.data().sellPrice,
              lastOperationId: opId,
              lastOperationType: 'purchase',
              lastOperationActorUid: actor.uid,
              lastOperationTime: new Date().toISOString()
            });
          }

          const mid = stockMovementId(opId, it.productId, `purchase_sync_${idx}`);
          tx.set(fsdb.collection('stockMovements').doc(mid), {
            id: mid,
            date: purchase.date || todayStr(),
            createdAt: new Date().toISOString(),
            type: 'purchase',
            productId: it.productId,
            productName: it.name || snap?.data()?.name || 'صنف مشتريات',
            barcode: snap?.data()?.barcode || '',
            qtyBefore: currentLiveQty,
            delta: it.qty,
            qtyAfter: newLiveQty,
            referenceId: purchaseId,
            referenceNumber: purchase.number,
            note: 'مزامنة مشتريات مع السحابة (تطبيق إضافة نسبية وحساب متوسط التكلفة)',
            operationId: opId,
            actorUid: actor.uid,
            createdBy: actor.uid,
            isOfflineSync: true
          });
        }

        // 2. Update Supplier Balance relative to live data
        if (supplierRef && supplierSnap?.exists) {
          const currentBal = supplierSnap.data().balance || { invoiced: 0, paid: 0 };
          const newInvoiced = (Number(currentBal.invoiced) || 0) + (Number(purchase.total) || 0);
          const newPaid = (Number(currentBal.paid) || 0) + (Number(purchase.paidAmount) || 0);
          tx.update(supplierRef, {
            balance: { invoiced: newInvoiced, paid: newPaid, updatedAt: new Date().toISOString() }
          });
        }

        // 3. Counter
        const counterData = counterSnap.exists ? counterSnap.data() || {} : {};
        const currentCounter = Number(counterData.purchase) || 0;
        if (Number(purchase.number) > currentCounter) {
          tx.set(counterRef, { purchase: Number(purchase.number) }, { merge: true });
        }

        tx.set(purchaseRef, {
          ...purchase,
          operationId: opId,
          actorUid: actor.uid,
          createdBy: actor.uid,
          isOfflineSync: true,
          syncedAt: new Date().toISOString()
        });

        tx.set(opRef, {
          id: opId,
          type: 'purchase',
          targetId: purchaseId,
          number: purchase.number,
          date: purchase.date || todayStr(),
          createdAt: purchase.createdAt || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
          actorUid: actor.uid,
          createdBy: actor.uid
        });
      });

      return true;
    }

    if (op.type === 'purchaseReturn') {
      const { purchaseReturn, items, refundMethod } = op.payload;
      const returnId = purchaseReturn.id;
      const opId = purchaseReturn.operationId || ('op_pr_' + returnId);

      const opRef = fsdb.collection('operationKeys').doc(opId);
      const returnRef = fsdb.collection('purchaseReturns').doc(returnId);
      const purchaseRef = fsdb.collection('purchases').doc(purchaseReturn.purchaseId);
      const counterRef = fsdb.collection('meta').doc('counters');
      const supplierRef = purchaseReturn.supplierId ? fsdb.collection('suppliers').doc(purchaseReturn.supplierId) : null;

      const returnItems: Array<{ productId: string; qty: number; originalUnitCost: number; productName: string }> = Array.isArray(items) ? items : (purchaseReturn.items || []);
      const productIds = Array.from(new Set(returnItems.map(it => it.productId).filter(Boolean)));
      const productRefs = productIds.map(id => fsdb.collection('products').doc(id));

      await fsdb.runTransaction(async tx => {
        const reads = await Promise.all([
          tx.get(opRef),
          tx.get(returnRef),
          tx.get(counterRef),
          tx.get(purchaseRef),
          ...(supplierRef ? [tx.get(supplierRef)] : []),
          ...productRefs.map(ref => tx.get(ref))
        ]);

        const opSnap = reads[0];
        const retSnap = reads[1];
        const counterSnap = reads[2];
        const purSnap = reads[3];

        // Idempotency: If already committed, return immediately
        if (opSnap.exists || retSnap.exists) {
          return;
        }

        if (!purSnap.exists) {
          throw new Error(`فاتورة الشراء الأصلية غير موجودة على السحابة: #${purchaseReturn.purchaseNumber || purchaseReturn.purchaseId}`);
        }

        const supplierSnap = supplierRef ? reads[4] : null;
        const productOffset = supplierRef ? 5 : 4;
        const productSnaps = reads.slice(productOffset);
        const productSnapMap: Record<string, any> = {};
        productRefs.forEach((ref, idx) => {
          productSnapMap[ref.id] = productSnaps[idx];
        });

        // 1. Double Guard Validation: Physical stock check
        for (const it of returnItems) {
          const snap = productSnapMap[it.productId];
          if (!snap || !snap.exists) {
            throw new Error(`الصنف غير موجود على السحابة: ${it.productName || it.productId}`);
          }
          const currentLiveQty = Number(snap.data()?.qty) || 0;
          if (currentLiveQty < it.qty) {
            throw new Error(`الكمية غير كافية بالمخزون للمرتجع: ${it.productName} (المتاح: ${currentLiveQty} والمطلوب رده: ${it.qty})`);
          }
        }

        // 2. Weighted Average Recalculation & Stock Movement
        const totalRefund = Number(purchaseReturn.totalRefund) || returnItems.reduce((s, it) => s + (it.qty * it.originalUnitCost), 0);

        returnItems.forEach((it, idx) => {
          const snap = productSnapMap[it.productId];
          const oldQty = Number(snap.data()?.qty) || 0;
          const oldCost = Number(snap.data()?.costPrice) || 0;
          const returnQty = Number(it.qty) || 0;
          const originalUnitCost = Number(it.originalUnitCost) || oldCost;

          const oldInventoryValue = oldQty * oldCost;
          const returnedInventoryValue = returnQty * originalUnitCost;

          const newQty = oldQty - returnQty;
          const newInventoryValue = Math.max(0, oldInventoryValue - returnedInventoryValue);
          const newCostPrice = newQty > 0 ? (newInventoryValue / newQty) : oldCost;

          tx.update(fsdb.collection('products').doc(it.productId), {
            qty: newQty,
            costPrice: newCostPrice,
            lastOperationId: opId,
            lastOperationType: 'purchaseReturn',
            lastOperationActorUid: actor.uid
          });

          const mid = stockMovementId(opId, it.productId, `pr_sync_${idx}`);
          tx.set(fsdb.collection('stockMovements').doc(mid), {
            id: mid,
            date: purchaseReturn.originalEventDate || purchaseReturn.date || todayStr(),
            createdAt: new Date().toISOString(),
            type: 'purchase_return',
            productId: it.productId,
            productName: it.productName || snap.data()?.name || 'صنف مرتجع للمورد',
            barcode: snap.data()?.barcode || '',
            qtyBefore: oldQty,
            delta: -returnQty,
            qtyAfter: newQty,
            referenceId: returnId,
            referenceNumber: purchaseReturn.number,
            note: 'مزامنة مرتجع مشتريات مع السحابة (تطبيق خصم التكلفة الأصلية)',
            operationId: opId,
            actorUid: actor.uid,
            createdBy: actor.uid,
            isOfflineSync: true
          });
        });

        // 3. Supplier Balance update
        if (supplierRef && supplierSnap?.exists) {
          const curBal = supplierSnap.data().balance || { invoiced: 0, paid: 0 };
          const newInvoiced = (Number(curBal.invoiced) || 0) - totalRefund;
          tx.update(supplierRef, {
            balance: {
              invoiced: newInvoiced,
              paid: Number(curBal.paid) || 0,
              updatedAt: new Date().toISOString()
            }
          });
        }

        // 4. Counter
        const counterData = counterSnap.exists ? counterSnap.data() || {} : {};
        const currentCounter = Number(counterData.purchaseReturn) || 0;
        if (Number(purchaseReturn.number) > currentCounter) {
          tx.set(counterRef, { purchaseReturn: Number(purchaseReturn.number) }, { merge: true });
        }

        // 5. Document & Operation Key
        tx.set(returnRef, {
          ...purchaseReturn,
          isOfflineSync: true,
          syncedAt: new Date().toISOString()
        });

        tx.set(opRef, {
          id: opId,
          type: 'purchaseReturn',
          targetId: returnId,
          number: purchaseReturn.number,
          date: purchaseReturn.originalEventDate || purchaseReturn.date || todayStr(),
          createdAt: purchaseReturn.createdAt || new Date().toISOString(),
          syncedAt: new Date().toISOString(),
          actorUid: actor.uid,
          createdBy: actor.uid
        });
      });

      return true;
    }

    if (op.type === 'customer') {
      const customer = op.payload;
      await fsdb.collection('customers').doc(customer.id).set(customer, { merge: true });
      return true;
    }

    if (op.type === 'stockAdjustment') {
      const adj = op.payload;
      if (adj.productId && adj.productUpdate) {
        await fsdb.collection('products').doc(adj.productId).set(adj.productUpdate, { merge: true });
      }
      if (adj.movement) {
        await fsdb.collection('stockMovements').doc(adj.movement.id).set(adj.movement);
      }
      return true;
    }

    if (op.type === 'userProfile' || (op.type as any) === 'cashier') {
      try {
        const user = op.payload;
        const targetId = user?.uid || user?.id || op.id;
        if (targetId) {
          await fsdb.collection('userProfiles').doc(targetId).set(user, { merge: true });
        }
      } catch (e) {
        console.warn('Offline user profile sync note:', e);
      }
      return true;
    }

    if (op.type === 'customerPayment') {
      const payment: CustomerPayment = op.payload?.payment || op.payload;
      const paymentId = payment.id;
      const opId = payment.operationId || `op_cust_pay_${paymentId}`;
      const customerId = payment.customerId;
      const amount = Number(payment.amount) || 0;

      const opRef = fsdb.collection('operationKeys').doc(opId);
      const customerRef = fsdb.collection('customers').doc(customerId);
      const paymentRef = fsdb.collection('customerPayments').doc(paymentId);

      // Check closed-day resolution at sync time if needed
      let finalPostingDate = payment.postingDate || payment.date;
      let finalEffectiveCashDate = payment.effectiveCashDate || payment.date;
      let isLatePosting = payment.isLatePosting || false;
      let closedDate = payment.closedDate || null;

      try {
        const eventDate = payment.originalEventDate || payment.date;
        const closingSnap = await fsdb.collection('dailyClosings').doc(eventDate).get();
        if (closingSnap.exists) {
          isLatePosting = true;
          closedDate = eventDate;
          try {
            const calendarSnap = await fsdb.collection('appSettings').doc('businessCalendar').get();
            const calendarData = calendarSnap.data();
            const versionsSnap = await fsdb.collection('appSettings').doc('businessCalendar').collection('versions').get();
            const versions = versionsSnap.docs.map(d => d.data());
            if (calendarData && versions.length === 0) {
              versions.push(calendarData);
            }
            const allClosingsSnap = await fsdb.collection('dailyClosings').get();
            const closedDates = allClosingsSnap.docs.map(d => d.id);
            if (versions.length > 0) {
              finalPostingDate = findFirstOpenBusinessDay(eventDate, versions as any, closedDates);
              finalEffectiveCashDate = finalPostingDate;
            }
          } catch (e) {
            console.warn('Failed to resolve authoritative calendar version at sync, retaining initial posting date:', e);
          }
        }
      } catch (err) {
        console.warn('Could not check closed dates during payment sync:', err);
      }

      const finalPaymentRecord: CustomerPayment = {
        ...payment,
        id: paymentId,
        customerId,
        amount,
        date: payment.date || todayStr(),
        operationId: opId,
        originalEventDate: payment.originalEventDate || payment.date || todayStr(),
        statementDate: payment.statementDate || payment.date || todayStr(),
        actualCashDate: payment.actualCashDate || payment.date || todayStr(),
        postingDate: finalPostingDate,
        effectiveCashDate: finalEffectiveCashDate,
        isLatePosting,
        closedDate,
        syncDate: new Date().toISOString(),
        actorUid: payment.actorUid || actor.uid,
        createdBy: payment.createdBy || actor.uid,
        createdAt: payment.createdAt || new Date().toISOString()
      };

      await fsdb.runTransaction(async tx => {
        const [opSnap, customerSnap] = await Promise.all([
          tx.get(opRef),
          tx.get(customerRef)
        ]);

        if (opSnap.exists) {
          // Idempotency: operation already committed, abort duplicate execution safely
          return;
        }

        if (!customerSnap.exists) throw new Error('العميل غير مسجل');
        const bal = customerSnap.data().balance || { invoiced: 0, paid: 0 };
        const newPaid = (Number(bal.paid) || 0) + amount;

        tx.update(customerRef, {
          balance: {
            invoiced: bal.invoiced || 0,
            paid: newPaid,
            updatedAt: new Date().toISOString()
          }
        });

        tx.set(paymentRef, finalPaymentRecord);
        tx.set(opRef, {
          id: opId,
          type: 'customer_payment',
          targetId: paymentId,
          customerId,
          amount,
          date: finalPaymentRecord.date,
          originalEventDate: finalPaymentRecord.originalEventDate,
          postingDate: finalPaymentRecord.postingDate,
          effectiveCashDate: finalPaymentRecord.effectiveCashDate,
          actorUid: finalPaymentRecord.actorUid || actor.uid,
          createdBy: finalPaymentRecord.createdBy || actor.uid,
          createdAt: new Date().toISOString()
        });
      });

      return true;
    }

    if (op.type === 'supplierPayment') {
      const payment: SupplierPayment = op.payload?.payment || op.payload;
      const paymentId = payment.id;
      const opId = payment.operationId || `op_supp_pay_${paymentId}`;
      const supplierId = payment.supplierId;
      const amount = Number(payment.amount) || 0;

      const opRef = fsdb.collection('operationKeys').doc(opId);
      const supplierRef = fsdb.collection('suppliers').doc(supplierId);
      const paymentRef = fsdb.collection('supplierPayments').doc(paymentId);

      let finalPostingDate = payment.postingDate || payment.date;
      let finalEffectiveCashDate = payment.effectiveCashDate || payment.date;
      let isLatePosting = payment.isLatePosting || false;
      let closedDate = payment.closedDate || null;

      try {
        const eventDate = payment.originalEventDate || payment.date;
        const closingSnap = await fsdb.collection('dailyClosings').doc(eventDate).get();
        if (closingSnap.exists) {
          isLatePosting = true;
          closedDate = eventDate;
          try {
            const calendarSnap = await fsdb.collection('appSettings').doc('businessCalendar').get();
            const calendarData = calendarSnap.data();
            const versionsSnap = await fsdb.collection('appSettings').doc('businessCalendar').collection('versions').get();
            const versions = versionsSnap.docs.map(d => d.data());
            if (calendarData && versions.length === 0) {
              versions.push(calendarData);
            }
            const allClosingsSnap = await fsdb.collection('dailyClosings').get();
            const closedDates = allClosingsSnap.docs.map(d => d.id);
            if (versions.length > 0) {
              finalPostingDate = findFirstOpenBusinessDay(eventDate, versions as any, closedDates);
              finalEffectiveCashDate = finalPostingDate;
            }
          } catch (e) {
            console.warn('Failed to resolve authoritative calendar version at sync, retaining initial posting date:', e);
          }
        }
      } catch (err) {
        console.warn('Could not check closed dates during supplier payment sync:', err);
      }

      const finalPaymentRecord: SupplierPayment = {
        ...payment,
        id: paymentId,
        supplierId,
        amount,
        date: payment.date || todayStr(),
        operationId: opId,
        originalEventDate: payment.originalEventDate || payment.date || todayStr(),
        statementDate: payment.statementDate || payment.date || todayStr(),
        actualCashDate: payment.actualCashDate || payment.date || todayStr(),
        postingDate: finalPostingDate,
        effectiveCashDate: finalEffectiveCashDate,
        isLatePosting,
        closedDate,
        syncDate: new Date().toISOString(),
        actorUid: payment.actorUid || actor.uid,
        createdBy: payment.createdBy || actor.uid,
        createdAt: payment.createdAt || new Date().toISOString()
      };

      await fsdb.runTransaction(async tx => {
        const [opSnap, supplierSnap] = await Promise.all([
          tx.get(opRef),
          tx.get(supplierRef)
        ]);

        if (opSnap.exists) {
          // Idempotency: operation already committed, abort duplicate execution safely
          return;
        }

        if (!supplierSnap.exists) throw new Error('المورد غير مسجل');
        const bal = supplierSnap.data().balance || { invoiced: 0, paid: 0 };
        const newPaid = (Number(bal.paid) || 0) + amount;

        tx.update(supplierRef, {
          balance: {
            invoiced: bal.invoiced || 0,
            paid: newPaid,
            updatedAt: new Date().toISOString()
          }
        });

        tx.set(paymentRef, finalPaymentRecord);
        tx.set(opRef, {
          id: opId,
          type: 'supplier_payment',
          targetId: paymentId,
          supplierId,
          amount,
          date: finalPaymentRecord.date,
          originalEventDate: finalPaymentRecord.originalEventDate,
          postingDate: finalPaymentRecord.postingDate,
          effectiveCashDate: finalPaymentRecord.effectiveCashDate,
          actorUid: finalPaymentRecord.actorUid || actor.uid,
          createdBy: finalPaymentRecord.createdBy || actor.uid,
          createdAt: new Date().toISOString()
        });
      });

      return true;
    }

    return true;
  }

  // Trigger sync of all pending queue items
  static async syncAllPending(): Promise<{ synced: number; failed: number; skippedOtherUser: number; errors: string[] }> {
    const queue = this.getQueue();
    const currentUid = fsauth.currentUser?.uid || auditActor().uid;
    const pending = queue.filter(q => q.status !== 'synced');
    if (pending.length === 0) {
      return { synced: 0, failed: 0, skippedOtherUser: 0, errors: [] };
    }

    let synced = 0;
    let failed = 0;
    let skippedOtherUser = 0;
    const errors: string[] = [];

    const updatedQueue = [...queue];

    for (let i = 0; i < updatedQueue.length; i++) {
      const item = updatedQueue[i];
      if (item.status === 'synced') continue;

      // Item A Security Isolation:
      // If the operation has an ownerUid that does not match the currently authenticated user,
      // leave it strictly pending (do not execute under a different user's identity).
      // Operations without ownerUid (legacy) are also left pending and not executed automatically.
      if (!item.ownerUid || item.ownerUid !== currentUid) {
        skippedOtherUser++;
        continue;
      }

      item.status = 'syncing';
      this.saveQueue(updatedQueue);

      try {
        await this.syncSingleOperation(item);
        item.status = 'synced';
        item.errorMsg = undefined;
        synced++;
      } catch (err: any) {
        item.status = 'failed';
        item.errorMsg = err.message || 'خطأ غير معروف في الاتصال';
        item.retryCount = (item.retryCount || 0) + 1;
        failed++;
        errors.push(`${item.title}: ${err.message}`);
      }

      this.saveQueue(updatedQueue);
    }

    // Clean up synced items after successful flush
    const remaining = this.getQueue().filter(q => q.status !== 'synced');
    this.saveQueue(remaining);

    return { synced, failed, skippedOtherUser, errors };
  }

  // Get pending operations in the queue that belong to another user or lack an ownerUid
  static getPendingOtherUserOperations(currentUid?: string): QueuedOfflineOperation[] {
    const queue = this.getQueue();
    const uid = currentUid || fsauth.currentUser?.uid || '';
    return queue.filter(q => q.status !== 'synced' && (!q.ownerUid || q.ownerUid !== uid));
  }

  // Diagnostic helper to inspect storage quota
  static async getStorageEstimate(): Promise<{ usageMB: number; quotaMB: number; percent: number }> {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        const usageMB = Math.round((est.usage || 0) / (1024 * 1024) * 10) / 10;
        const quotaMB = Math.round((est.quota || 0) / (1024 * 1024));
        const percent = quotaMB > 0 ? Math.round((usageMB / quotaMB) * 100) : 0;
        return { usageMB, quotaMB, percent };
      }
    } catch (_e) {}
    return { usageMB: 0, quotaMB: 0, percent: 0 };
  }
}

// Service worker helper
export function registerMaktabatiServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('✅ Maktabati PWA Service Worker Registered:', reg.scope);

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 New Maktabati version available! Reloading or activating...');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('Maktabati Service Worker registration note:', err);
      });
  });
}
