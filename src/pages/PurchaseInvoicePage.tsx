import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import {
  fmt,
  todayStr,
  uid,
  productFullName,
  productLabel,
  stockMovementId,
  similarityScore
} from '../lib/utils';
import { CATEGORIES } from '../lib/constants';
import { OfflineSyncManager } from '../lib/offlineSync';
import * as XLSX from 'xlsx';
import { PackagePlus, FileSpreadsheet, Plus, Trash2, Download, CheckCircle2, RotateCcw, Search, AlertCircle } from 'lucide-react';
import { PurchaseReturn, PurchaseReturnItem } from '../types';
import { findFirstOpenBusinessDay } from '../lib/businessCalendar';
import { recordSecureAudit } from '../lib/auditEngine';

export const PurchaseInvoicePage: React.FC = () => {
  const {
    db,
    setDb,
    purchaseCartItems,
    setPurchaseCartItems,
    openQuickAdd,
    toast
  } = useApp();

  const [activeTab, setActiveTab] = useState<'new_purchase' | 'purchase_return'>('new_purchase');

  // Purchase Return State
  const [selectedReturnPurchaseId, setSelectedReturnPurchaseId] = useState('');
  const [returnSearchQ, setReturnSearchQ] = useState('');
  const [returnQtyMap, setReturnQtyMap] = useState<Record<string, number>>({});
  const [refundMethod, setRefundMethod] = useState<'cash' | 'credit'>('credit');
  const [returnNotes, setReturnNotes] = useState('');
  const isSubmittingReturnRef = React.useRef(false);

  const [supplierId, setSupplierId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);

  // Manual item add
  const [prodSearch, setProdSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [itemQty, setItemQty] = useState(1);
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [sellPrice, setSellPrice] = useState<number | ''>('');
  const [matchingOpen, setMatchingOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // XLSX Import
  const [xlsxSupplierId, setXlsxSupplierId] = useState('');
  const [xlsxDiscount, setXlsxDiscount] = useState(0);
  const [xlsxPaid, setXlsxPaid] = useState(0);
  const [xlsxRows, setXlsxRows] = useState<any[]>([]);

  const matchingProducts = prodSearch.trim()
    ? (db.products || [])
        .filter(p =>
          `${productFullName(p)} ${p.barcode || ''}`.toLowerCase().includes(prodSearch.trim().toLowerCase())
        )
        .slice(0, 8)
    : [];

  const handleSelectProduct = (p: any) => {
    setSelectedProductId(p.id);
    setProdSearch(productLabel(p));
    setCostPrice(p.costPrice);
    setSellPrice(p.sellPrice);
    setMatchingOpen(false);
  };

  const handleAddManualItem = () => {
    if (!selectedProductId) {
      toast('اختر صنفاً أولاً');
      return;
    }
    const p = (db.products || []).find(x => x.id === selectedProductId);
    if (!p) return;

    if (itemQty <= 0) {
      toast('أدخل كمية صحيحة');
      return;
    }
    const cost = typeof costPrice === 'number' ? costPrice : p.costPrice;
    const sell = typeof sellPrice === 'number' ? sellPrice : p.sellPrice;

    setPurchaseCartItems(prev => [
      ...prev,
      {
        productId: p.id,
        name: productFullName(p),
        qty: itemQty,
        cost,
        sellPrice: sell,
        term: p.term || ''
      }
    ]);

    setSelectedProductId(null);
    setProdSearch('');
    setItemQty(1);
    setCostPrice('');
    setSellPrice('');
    toast(`تمت إضافة "${p.name}" لفاتورة الشراء`);
  };

  const cleanDiscount = Math.max(0, discount);
  const subtotal = purchaseCartItems.reduce((s, it) => s + it.qty * it.cost, 0);
  const total = Math.max(0, subtotal - cleanDiscount);
  const dueAmount = Math.max(0, total - Math.max(0, paidAmount));

  // Save Manual Purchase
  const handleSavePurchase = async () => {
    if (!purchaseCartItems.length) {
      toast('أضف أصنافاً لفاتورة الشراء أولاً');
      return;
    }

    setSaving(true);
    const operationId = uid();
    const purchaseId = uid();
    const actor = auditActor();
    const supplier = (db.suppliers || []).find(s => s.id === supplierId);

    // If Offline Mode
    if (!navigator.onLine) {
      try {
        const lastPurchaseNum = (db.purchases || []).reduce((max, p) => Math.max(max, Number(p.number) || 0), 0);
        const number = lastPurchaseNum + 1;

        const stockAdditions: any[] = [];
        const stockMovements: any[] = [];

        for (let idx = 0; idx < purchaseCartItems.length; idx++) {
          const it = purchaseCartItems[idx];
          if (!it.productId) continue;
          const prod = (db.products || []).find(p => p.id === it.productId);
          const oldQty = prod?.qty || 0;
          const oldCost = prod?.costPrice || 0;
          const newQty = oldQty + it.qty;
          const newCost = newQty > 0 ? (oldQty * oldCost + it.qty * it.cost) / newQty : it.cost;

          stockAdditions.push({
            productId: it.productId,
            name: it.name,
            qty: it.qty,
            costPrice: it.cost,
            sellPrice: it.sellPrice
          });

          const mid = stockMovementId(operationId, it.productId, `purchase_${idx}`);
          stockMovements.push({
            id: mid,
            date: todayStr(),
            createdAt: new Date().toISOString(),
            type: 'purchase',
            productId: it.productId,
            productName: it.name,
            barcode: prod?.barcode || '',
            qtyBefore: oldQty,
            delta: it.qty,
            qtyAfter: newQty,
            referenceId: purchaseId,
            referenceNumber: number,
            note: 'شراء — إضافة للمخزون مع حساب متوسط التكلفة (أوفلاين)',
            operationId,
            actorUid: actor.uid,
            createdBy: actor.uid,
            isOfflineSync: false
          });
        }

        const purchaseRecord = {
          id: purchaseId,
          number,
          date: todayStr(),
          supplierId: supplierId || null,
          supplierName: supplier ? supplier.name : 'مورد غير محدد',
          items: purchaseCartItems,
          subtotal,
          discount: cleanDiscount,
          originalTotal: subtotal,
          total,
          paidAmount: Math.max(0, paidAmount),
          dueAmount,
          operationId,
          actorUid: actor.uid,
          createdBy: actor.uid,
          createdAt: new Date().toISOString(),
          isOfflineDraft: true
        };

        OfflineSyncManager.enqueueGeneric(
          'purchase',
          `فاتورة شراء #${number} (${supplier ? supplier.name : 'مورد عام'}) — ${total} ج`,
          {
            purchase: purchaseRecord,
            stockAdditions,
            supplierUpdate: supplierId ? {
              supplierId,
              balance: {
                invoiced: (supplier?.balance?.invoiced || 0) + total,
                paid: (supplier?.balance?.paid || 0) + paidAmount
              }
            } : null,
            stockMovements
          }
        );

        toast(`⚡ تم حفظ فاتورة الشراء أوفلاين #${number} وسيتم مزامنتها فور اتصال الإنترنت`);
        setPurchaseCartItems([]);
        setDiscount(0);
        setPaidAmount(0);
      } catch (err: any) {
        toast(`⚠️ تعذر الحفظ أوفلاين: ${err.message}`);
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const counterRef = fsdb.collection('meta').doc('counters');
      const opRef = fsdb.collection('operationKeys').doc(operationId);
      const purchaseRef = fsdb.collection('purchases').doc(purchaseId);
      const supplierRef = supplierId ? fsdb.collection('suppliers').doc(supplierId) : null;
      const productIds: string[] = Array.from(new Set(purchaseCartItems.map(it => it.productId!).filter(Boolean)));
      const productRefs = productIds.map(id => fsdb.collection('products').doc(id));

      await fsdb.runTransaction(async tx => {
        const reads = await Promise.all([
          tx.get(opRef),
          tx.get(counterRef),
          tx.get(purchaseRef),
          ...(supplierRef ? [tx.get(supplierRef)] : []),
          ...productRefs.map(ref => tx.get(ref))
        ]);

        const counterData = reads[1].exists ? reads[1].data() || {} : {};
        const number = (Number(counterData.purchase) || 0) + 1;

        const supplierSnap = supplierRef ? reads[3] : null;
        const productOffset = supplierRef ? 4 : 3;
        const productSnaps = reads.slice(productOffset);

        const stockMap: Record<string, any> = {};
        productRefs.forEach((ref, idx) => {
          stockMap[ref.id] = productSnaps[idx];
        });

        // Supplier Balance Update
        if (supplierRef && supplierSnap?.exists) {
          const curBal = supplierSnap.data().balance || { invoiced: 0, paid: 0 };
          const newPurchased = (Number(curBal.invoiced) || 0) + total;
          const newPaid = (Number(curBal.paid) || 0) + paidAmount;
          tx.update(supplierRef, {
            balance: { invoiced: newPurchased, paid: newPaid, updatedAt: new Date().toISOString() }
          });
        }

        // Weighted Average Cost & Stock Additions
        for (let idx = 0; idx < purchaseCartItems.length; idx++) {
          const it = purchaseCartItems[idx];
          if (!it.productId) continue;
          const snap = stockMap[it.productId];
          const oldQty = Number(snap.data().qty) || 0;
          const oldCost = Number(snap.data().costPrice) || 0;
          const newQty = oldQty + it.qty;
          const newCost = newQty > 0 ? (oldQty * oldCost + it.qty * it.cost) / newQty : it.cost;

          tx.update(fsdb.collection('products').doc(it.productId), {
            qty: newQty,
            costPrice: newCost,
            sellPrice: it.sellPrice !== undefined ? it.sellPrice : snap.data().sellPrice,
            lastOperationId: operationId,
            lastOperationType: 'purchase',
            lastOperationActorUid: actor.uid
          });

          const mid = stockMovementId(operationId, it.productId, `purchase_${idx}`);
          tx.set(fsdb.collection('stockMovements').doc(mid), {
            id: mid,
            date: todayStr(),
            createdAt: new Date().toISOString(),
            type: 'purchase',
            productId: it.productId,
            productName: it.name,
            barcode: snap.data().barcode || '',
            qtyBefore: oldQty,
            delta: it.qty,
            qtyAfter: newQty,
            referenceId: purchaseId,
            referenceNumber: number,
            note: 'شراء — إضافة للمخزون مع حساب متوسط التكلفة',
            operationId,
            actorUid: actor.uid,
            createdBy: actor.uid
          });
        }

        const purchaseRecord = {
          id: purchaseId,
          number,
          date: todayStr(),
          supplierId: supplierId || null,
          supplierName: supplier ? supplier.name : 'مورد غير محدد',
          items: purchaseCartItems,
          subtotal,
          discount: cleanDiscount,
          originalTotal: subtotal,
          total,
          paidAmount: Math.max(0, paidAmount),
          dueAmount,
          operationId,
          actorUid: actor.uid,
          createdBy: actor.uid,
          createdAt: new Date().toISOString()
        };

        tx.set(counterRef, { purchase: number }, { merge: true });
        tx.set(purchaseRef, purchaseRecord);
        tx.set(opRef, {
          id: operationId,
          type: 'purchase',
          targetId: purchaseId,
          number,
          date: todayStr(),
          createdAt: new Date().toISOString(),
          actorUid: actor.uid,
          createdBy: actor.uid
        });
      });

      toast(`✅ تم حفظ فاتورة الشراء #${purchaseId.slice(0, 6)} بنجاح`);
      setPurchaseCartItems([]);
      setDiscount(0);
      setPaidAmount(0);
    } catch (err: any) {
      toast(`⚠️ خطأ أثناء حفظ فاتورة الشراء: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Excel Importer
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

        const parsed: any[] = [];
        for (let i = 1; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r[0] == null || String(r[0]).trim() === '') continue;
          const name = String(r[0]).trim();
          const qty = parseInt(r[1]) || 0;
          const cost = parseFloat(r[2]) || 0;
          if (qty <= 0) continue;

          // Fuzzy match against database
          const scored = (db.products || []).map(p => {
            const full = productFullName(p);
            const score = Math.max(similarityScore(name, full), similarityScore(name, p.name));
            return { p, score };
          }).sort((a, b) => b.score - a.score);

          parsed.push({
            name,
            qty,
            cost,
            candidates: scored.slice(0, 5),
            allProducts: scored,
            selectedMatch: scored.length && scored[0].score >= 0.45 ? scored[0].p.id : '__new__',
            newCategory: CATEGORIES[0]
          });
        }

        if (!parsed.length) {
          toast('الملف فارغ أو لا يحتوي على صفوف بيانات صحيحة');
          return;
        }
        setXlsxRows(parsed);
        toast(`تمت قراءة ${parsed.length} صنف من ملف الإكسيل`);
      } catch (err: any) {
        toast(`تعذر قراءة ملف الإكسيل: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    const rows = [
      ['اسم الصنف (كما ورد في فاتورة المورد)', 'الكمية', 'سعر التكلفة للوحدة'],
      ['مثال: دراسات المعاصر اولى اعدادي', '10', '25']
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'نموذج شراء');
    XLSX.writeFile(wb, 'نموذج-فاتورة-شراء.xlsx');
  };

  const handleConfirmXlsxImport = async () => {
    if (!xlsxSupplierId) {
      toast('اختر المورد أولاً');
      return;
    }
    if (!xlsxRows.length) return;

    setSaving(true);
    const supplier = (db.suppliers || []).find(s => s.id === xlsxSupplierId);
    const operationId = uid();
    const purchaseId = uid();
    const actor = auditActor();

    try {
      const itemsToBuy: any[] = [];
      const newProductsToCreate: any[] = [];
      let sub = 0;

      xlsxRows.forEach(row => {
        const qty = Number(row.qty) || 0;
        const cost = Number(row.cost) || 0;
        if (qty <= 0 || cost < 0) return;
        sub += qty * cost;

        if (row.selectedMatch === '__new__') {
          const newP = {
            id: uid(),
            name: row.name,
            category: row.newCategory || 'كتب خارجية',
            barcode: '',
            institution: '',
            grade: '',
            unit: 'قطعة',
            costPrice: cost,
            sellPrice: 0,
            qty: 0,
            minQty: 5
          };
          newProductsToCreate.push(newP);
          itemsToBuy.push({ productId: newP.id, name: row.name, qty, cost, term: '' });
        } else {
          const p = (db.products || []).find(x => x.id === row.selectedMatch);
          itemsToBuy.push({ productId: row.selectedMatch, name: p ? productFullName(p) : row.name, qty, cost, term: p?.term || '' });
        }
      });

      const totalImp = Math.max(0, sub - xlsxDiscount);
      const paidImp = Math.min(totalImp, xlsxPaid);

      // Create new products first
      for (const np of newProductsToCreate) {
        await fsdb.collection('products').doc(np.id).set(np);
      }

      // Add to purchase cart
      setPurchaseCartItems(itemsToBuy);
      setSupplierId(xlsxSupplierId);
      setDiscount(xlsxDiscount);
      setPaidAmount(paidImp);
      setXlsxRows([]);
      toast('تم استيراد الأصناف إلى فاتورة الشراء بنجاح — يمكنك مراجعتها وحفظها');
    } catch (err: any) {
      toast(`خطأ أثناء الاستيراد: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Purchase Return Handler
  const selectedPurchase = (db.purchases || []).find(p => p.id === selectedReturnPurchaseId);
  const existingReturns = ((db as any).purchaseReturns || []).filter(
    (pr: any) => pr.purchaseId === selectedReturnPurchaseId
  );

  // Calculate already returned quantity per product in this purchase
  const alreadyReturnedByProduct: Record<string, number> = {};
  existingReturns.forEach((pr: any) => {
    (pr.items || []).forEach((it: any) => {
      alreadyReturnedByProduct[it.productId] = (alreadyReturnedByProduct[it.productId] || 0) + (Number(it.qty) || 0);
    });
  });

  const handleSavePurchaseReturn = async () => {
    if (!selectedPurchase) {
      toast('اختر فاتورة الشراء المراد الإرجاع منها');
      return;
    }

    const itemsToReturn: PurchaseReturnItem[] = [];
    let totalRefundCalc = 0;

    for (const it of selectedPurchase.items || []) {
      const returnQty = returnQtyMap[it.productId] || 0;
      if (returnQty <= 0) continue;

      const purchasedQty = Number(it.qty) || 0;
      const alreadyReturned = alreadyReturnedByProduct[it.productId] || 0;
      const remainingReturnable = Math.max(0, purchasedQty - alreadyReturned);

      const prod = (db.products || []).find(p => p.id === it.productId);
      const currentPhysical = prod ? Number(prod.qty) || 0 : 0;

      // Double guard validation
      if (returnQty > remainingReturnable) {
        toast(`⚠️ الكمية المطلوبة للصنف "${it.name || prod?.name}" (${returnQty}) تتجاوز الكمية المتبقية القابلة للإرجاع (${remainingReturnable})`);
        return;
      }

      if (returnQty > currentPhysical) {
        toast(`⚠️ الكمية المطلوبة للصنف "${it.name || prod?.name}" (${returnQty}) تتجاوز الرصيد الفعلي بالمخزون (${currentPhysical})`);
        return;
      }

      const originalUnitCost = Number(it.cost) || (prod?.costPrice || 0);
      const lineTotal = returnQty * originalUnitCost;
      totalRefundCalc += lineTotal;

      itemsToReturn.push({
        productId: it.productId,
        productName: it.name || prod?.name || 'صنف مشتريات',
        qty: returnQty,
        originalUnitCost,
        totalCost: lineTotal
      });
    }

    if (itemsToReturn.length === 0) {
      toast('حدد كمية مرتجعة واحدة على الأقل');
      return;
    }

    if (isSubmittingReturnRef.current) return;
    isSubmittingReturnRef.current = true;
    setSaving(true);

    const purchaseReturnId = uid();
    const opId = 'op_pr_' + purchaseReturnId;
    const actor = auditActor();

    // Closed-Day Date Model Check
    const eventDate = todayStr();
    let postingDate = eventDate;
    let effectiveCashDate: string | null = refundMethod === 'cash' ? eventDate : null;
    let isLatePosting = false;
    let closedDate: string | null = null;

    try {
      const isTodayClosed = (db.dailyClosings || []).some(c => c.date === eventDate);
      if (isTodayClosed) {
        isLatePosting = true;
        closedDate = eventDate;
        // Resolve first open business day
        const calendarVersions = (db as any).businessCalendarVersions || [];
        const closedDatesList = (db.dailyClosings || []).map(c => c.date);
        try {
          if (calendarVersions.length > 0) {
            postingDate = findFirstOpenBusinessDay(eventDate, calendarVersions, closedDatesList);
          } else {
            postingDate = eventDate;
          }
        } catch {
          postingDate = eventDate;
        }
        if (refundMethod === 'cash') {
          effectiveCashDate = postingDate;
        }
      }
    } catch {}

    const returnRecord: PurchaseReturn = {
      id: purchaseReturnId,
      number: 0, // will be assigned inside transaction or offline
      purchaseId: selectedPurchase.id,
      purchaseNumber: selectedPurchase.number,
      supplierId: selectedPurchase.supplierId || null,
      supplierName: selectedPurchase.supplierName || 'مورد عام',
      items: itemsToReturn,
      totalRefund: totalRefundCalc,
      refundMethod,
      originalEventDate: eventDate,
      statementDate: eventDate,
      postingDate,
      effectiveCashDate,
      syncDate: null,
      closedDate,
      isLatePosting,
      operationId: opId,
      actorUid: actor.uid,
      actorName: (actor as any).name || 'المستخدم المسؤول',
      createdAt: new Date().toISOString(),
      notes: returnNotes.trim() || undefined
    };

    // Offline Execution
    if (!navigator.onLine) {
      try {
        const lastReturnNum = ((db as any).purchaseReturns || []).reduce(
          (max: number, pr: any) => Math.max(max, Number(pr.number) || 0),
          0
        );
        returnRecord.number = lastReturnNum + 1;

        const stockMovements: any[] = [];
        const stockDeductions: any[] = [];

        itemsToReturn.forEach((it, idx) => {
          const prod = (db.products || []).find(p => p.id === it.productId);
          const oldQty = prod ? Number(prod.qty) || 0 : 0;
          const oldCost = prod ? Number(prod.costPrice) || 0 : 0;
          const newQty = oldQty - it.qty;
          const oldVal = oldQty * oldCost;
          const retVal = it.qty * it.originalUnitCost;
          const newVal = Math.max(0, oldVal - retVal);
          const newCost = newQty > 0 ? newVal / newQty : oldCost;

          stockDeductions.push({
            productId: it.productId,
            name: it.productName,
            qty: it.qty,
            costPrice: it.originalUnitCost
          });

          const mid = stockMovementId(opId, it.productId, `pr_${idx}`);
          stockMovements.push({
            id: mid,
            date: eventDate,
            createdAt: new Date().toISOString(),
            type: 'purchase_return',
            productId: it.productId,
            productName: it.productName,
            barcode: prod?.barcode || '',
            qtyBefore: oldQty,
            delta: -it.qty,
            qtyAfter: newQty,
            referenceId: purchaseReturnId,
            referenceNumber: returnRecord.number,
            note: `مرتجع شراء — فاتورة #${selectedPurchase.number} (${refundMethod === 'cash' ? 'نقدي' : 'آجل'}) [أوفلاين]`,
            operationId: opId,
            actorUid: actor.uid,
            createdBy: actor.uid
          });
        });

        OfflineSyncManager.enqueueGeneric(
          'purchaseReturn' as any,
          `مرتجع مشتريات #${returnRecord.number} (${selectedPurchase.supplierName}) — ${totalRefundCalc} ج`,
          {
            purchaseReturn: returnRecord,
            items: itemsToReturn,
            refundMethod,
            supplierUpdate: selectedPurchase.supplierId ? {
              supplierId: selectedPurchase.supplierId,
              reductionAmount: totalRefundCalc
            } : null,
            stockMovements
          }
        );

        // Update local state
        setDb((prev: any) => {
          const updatedProducts = (prev.products || []).map((p: any) => {
            const retItem = itemsToReturn.find(it => it.productId === p.id);
            if (!retItem) return p;
            const oldQty = Number(p.qty) || 0;
            const oldCost = Number(p.costPrice) || 0;
            const newQty = oldQty - retItem.qty;
            const oldVal = oldQty * oldCost;
            const retVal = retItem.qty * retItem.originalUnitCost;
            const newVal = Math.max(0, oldVal - retVal);
            const newCost = newQty > 0 ? newVal / newQty : oldCost;
            return { ...p, qty: newQty, costPrice: newCost };
          });

          let updatedSuppliers = prev.suppliers || [];
          if (selectedPurchase.supplierId) {
            updatedSuppliers = updatedSuppliers.map((s: any) => {
              if (s.id !== selectedPurchase.supplierId) return s;
              const curBal = s.balance || { invoiced: 0, paid: 0 };
              return {
                ...s,
                balance: {
                  ...curBal,
                  invoiced: (Number(curBal.invoiced) || 0) - totalRefundCalc,
                  updatedAt: new Date().toISOString()
                }
              };
            });
          }

          return {
            ...prev,
            purchaseReturns: [returnRecord, ...(prev.purchaseReturns || [])],
            products: updatedProducts,
            suppliers: updatedSuppliers,
            stockMovements: [...stockMovements, ...(prev.stockMovements || [])]
          };
        });

        toast(`⚡ تم حفظ مرتجع المشتريات أوفلاين #${returnRecord.number} وسيتم مزامنته عند توفر الإنترنت`);
        setReturnQtyMap({});
        setSelectedReturnPurchaseId('');
        setReturnNotes('');
      } catch (err: any) {
        toast(`⚠️ تعذر الحفظ أوفلاين: ${err.message}`);
      } finally {
        isSubmittingReturnRef.current = false;
        setSaving(false);
      }
      return;
    }

    // Online Atomic Firestore Transaction
    try {
      const counterRef = fsdb.collection('meta').doc('counters');
      const opRef = fsdb.collection('operationKeys').doc(opId);
      const returnRef = fsdb.collection('purchaseReturns').doc(purchaseReturnId);
      const purchaseRef = fsdb.collection('purchases').doc(selectedPurchase.id);
      const supplierRef = selectedPurchase.supplierId ? fsdb.collection('suppliers').doc(selectedPurchase.supplierId) : null;
      const productIds = Array.from(new Set(itemsToReturn.map(it => it.productId)));
      const productRefs = productIds.map(id => fsdb.collection('products').doc(id));

      await fsdb.runTransaction(async tx => {
        const reads = await Promise.all([
          tx.get(opRef),
          tx.get(counterRef),
          tx.get(purchaseRef),
          ...(supplierRef ? [tx.get(supplierRef)] : []),
          ...productRefs.map(ref => tx.get(ref))
        ]);

        const opSnap = reads[0];
        const counterSnap = reads[1];
        const purSnap = reads[2];

        if (opSnap.exists) {
          // Idempotency: abort duplicate execution safely
          return;
        }

        if (!purSnap.exists) {
          throw new Error('فاتورة الشراء الأصلية غير مسجلة بقاعدة البيانات');
        }

        const counterData = counterSnap.exists ? counterSnap.data() || {} : {};
        const number = (Number(counterData.purchaseReturn) || 0) + 1;
        returnRecord.number = number;

        const supplierSnap = supplierRef ? reads[3] : null;
        const productOffset = supplierRef ? 4 : 3;
        const productSnaps = reads.slice(productOffset);

        const stockMap: Record<string, any> = {};
        productRefs.forEach((ref, idx) => {
          stockMap[ref.id] = productSnaps[idx];
        });

        // 1. Double Guard Validation: Physical stock check on live cloud data
        for (const it of itemsToReturn) {
          const snap = stockMap[it.productId];
          if (!snap || !snap.exists) throw new Error(`الصنف غير موجود بالمخزون: ${it.productName}`);
          const currentQty = Number(snap.data().qty) || 0;
          if (currentQty < it.qty) {
            throw new Error(`المخزون غير كافٍ للصنف "${it.productName}" (المتاح: ${currentQty} فقط والمطلوب رده: ${it.qty})`);
          }
        }

        // 2. Weighted Average & Stock Updates
        itemsToReturn.forEach((it, idx) => {
          const snap = stockMap[it.productId];
          const oldQty = Number(snap.data().qty) || 0;
          const oldCost = Number(snap.data().costPrice) || 0;
          const returnQty = it.qty;
          const unitCost = it.originalUnitCost;

          const oldVal = oldQty * oldCost;
          const retVal = returnQty * unitCost;
          const newQty = oldQty - returnQty;
          const newVal = Math.max(0, oldVal - retVal);
          const newCost = newQty > 0 ? (newVal / newQty) : oldCost;

          tx.update(fsdb.collection('products').doc(it.productId), {
            qty: newQty,
            costPrice: newCost,
            lastOperationId: opId,
            lastOperationType: 'purchaseReturn',
            lastOperationActorUid: actor.uid
          });

          const mid = stockMovementId(opId, it.productId, `pr_${idx}`);
          tx.set(fsdb.collection('stockMovements').doc(mid), {
            id: mid,
            date: eventDate,
            createdAt: new Date().toISOString(),
            type: 'purchase_return',
            productId: it.productId,
            productName: it.productName,
            barcode: snap.data().barcode || '',
            qtyBefore: oldQty,
            delta: -returnQty,
            qtyAfter: newQty,
            referenceId: purchaseReturnId,
            referenceNumber: number,
            note: `مرتجع شراء — فاتورة #${selectedPurchase.number} (${refundMethod === 'cash' ? 'استرداد نقدي' : 'تخفيض آجل'})`,
            operationId: opId,
            actorUid: actor.uid,
            createdBy: actor.uid
          });
        });

        // 3. Supplier Balance update
        if (supplierRef && supplierSnap?.exists) {
          const curBal = supplierSnap.data().balance || { invoiced: 0, paid: 0 };
          const newInvoiced = (Number(curBal.invoiced) || 0) - totalRefundCalc;
          tx.update(supplierRef, {
            balance: {
              invoiced: newInvoiced,
              paid: Number(curBal.paid) || 0,
              updatedAt: new Date().toISOString()
            }
          });
        }

        // 4. Counter update
        tx.set(counterRef, { purchaseReturn: number }, { merge: true });

        // 5. Purchase Return Document & Operation Key
        tx.set(returnRef, returnRecord);
        tx.set(opRef, {
          id: opId,
          type: 'purchaseReturn',
          targetId: purchaseReturnId,
          number,
          date: eventDate,
          createdAt: new Date().toISOString(),
          actorUid: actor.uid,
          createdBy: actor.uid
        });
      });

      // Audit Log
      await recordSecureAudit(
        'مرتجع مشتريات',
        'purchases',
        {
          purchaseReturnId,
          purchaseId: selectedPurchase.id,
          purchaseNumber: selectedPurchase.number,
          supplierId: selectedPurchase.supplierId,
          supplierName: selectedPurchase.supplierName,
          totalRefund: totalRefundCalc,
          refundMethod,
          itemsCount: itemsToReturn.length
        },
        'info'
      );

      toast(`✅ تم تسجيل مرتجع الشراء #${returnRecord.number} بقيمة ${fmt(totalRefundCalc)} ج بنجاح`);
      setReturnQtyMap({});
      setSelectedReturnPurchaseId('');
      setReturnNotes('');
    } catch (err: any) {
      toast(`⚠️ خطأ أثناء حفظ مرتجع المشتريات: ${err.message}`);
    } finally {
      isSubmittingReturnRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#FAF6EE] border border-[#D8CBB0] w-fit">
        <button
          onClick={() => setActiveTab('new_purchase')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'new_purchase'
              ? 'bg-[#A9762F] text-white shadow-xs'
              : 'text-[#3A4A63] hover:bg-[#EFE7D6]'
          }`}
        >
          <PackagePlus className="w-4 h-4" />
          فاتورة شراء جديدة
        </button>
        <button
          onClick={() => setActiveTab('purchase_return')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-all ${
            activeTab === 'purchase_return'
              ? 'bg-[#A9762F] text-white shadow-xs'
              : 'text-[#3A4A63] hover:bg-[#EFE7D6]'
          }`}
        >
          <RotateCcw className="w-4 h-4" />
          مرتجع مشتريات
        </button>
      </div>

      {activeTab === 'purchase_return' ? (
        /* PURCHASE RETURN TAB */
        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#EFE7D6]">
            <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-[#A8503A]" />
              تسجيل مرتجع مشتريات لمورد
            </h3>
            <span className="text-xs text-[#8E98A6]">{todayStr()}</span>
          </div>

          {/* Select Purchase Invoice */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#3A4A63]">اختر فاتورة الشراء المرجعية *</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="ابحث برقم الفاتورة أو اسم المورد..."
                  value={returnSearchQ}
                  onChange={e => setReturnSearchQ(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
                />
                <Search className="w-4 h-4 text-[#8E98A6] absolute left-2.5 top-2.5" />
              </div>
              <select
                className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
                value={selectedReturnPurchaseId}
                onChange={e => {
                  setSelectedReturnPurchaseId(e.target.value);
                  setReturnQtyMap({});
                }}
              >
                <option value="">— اختر فاتورة شراء —</option>
                {(db.purchases || [])
                  .filter(p => {
                    if (!returnSearchQ.trim()) return true;
                    const q = returnSearchQ.trim().toLowerCase();
                    return (
                      `#${p.number}`.includes(q) ||
                      String(p.number).includes(q) ||
                      (p.supplierName || '').toLowerCase().includes(q)
                    );
                  })
                  .slice()
                  .reverse()
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      فاتورة #{p.number} — {p.supplierName} ({fmt(p.total)} ج) — {p.date}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {selectedPurchase ? (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0] text-xs flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-[#1F2A3C]">المورد:</span> {selectedPurchase.supplierName}
                </div>
                <div>
                  <span className="font-bold text-[#1F2A3C]">تاريخ الشراء:</span> {selectedPurchase.date}
                </div>
                <div>
                  <span className="font-bold text-[#1F2A3C]">إجمالي الفاتورة:</span> {fmt(selectedPurchase.total)} ج
                </div>
              </div>

              {/* Purchase Items Return Table */}
              <div className="overflow-x-auto border border-[#D8CBB0] rounded-xl bg-white">
                <table className="w-full text-xs text-right">
                  <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
                    <tr>
                      <th className="p-2.5">الصنف</th>
                      <th className="p-2.5 text-center">المشترى أصلاً</th>
                      <th className="p-2.5 text-center">سُبق إرجاعه</th>
                      <th className="p-2.5 text-center">المتاح للرد تعاقدياً</th>
                      <th className="p-2.5 text-center">المخزون الفعلي</th>
                      <th className="p-2.5 text-center">سعر الشراء الأصلي</th>
                      <th className="p-2.5 text-center w-28">كمية المرتجع</th>
                      <th className="p-2.5 text-center">إجمالي المرتجع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE7D6]">
                    {(selectedPurchase.items || []).map((it, idx) => {
                      const purchasedQty = Number(it.qty) || 0;
                      const alreadyReturned = alreadyReturnedByProduct[it.productId] || 0;
                      const remainingReturnable = Math.max(0, purchasedQty - alreadyReturned);
                      const prod = (db.products || []).find(p => p.id === it.productId);
                      const currentPhysical = prod ? Number(prod.qty) || 0 : 0;
                      const returnQty = returnQtyMap[it.productId] || 0;
                      const originalUnitCost = Number(it.cost) || (prod?.costPrice || 0);
                      const lineTotal = returnQty * originalUnitCost;
                      const maxAllowed = Math.min(remainingReturnable, currentPhysical);

                      return (
                        <tr key={idx} className="hover:bg-[#FAF6EE]">
                          <td className="p-2.5 font-medium">{it.name || prod?.name || 'صنف مشتريات'}</td>
                          <td className="p-2.5 text-center font-bold">{purchasedQty}</td>
                          <td className="p-2.5 text-center text-[#8E98A6]">{alreadyReturned}</td>
                          <td className="p-2.5 text-center font-bold text-[#5C7A5E]">{remainingReturnable}</td>
                          <td className="p-2.5 text-center font-bold text-[#1F2A3C]">{currentPhysical}</td>
                          <td className="p-2.5 text-center font-mono">{fmt(originalUnitCost)} ج</td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              max={maxAllowed}
                              value={returnQtyMap[it.productId] ?? ''}
                              placeholder="0"
                              disabled={maxAllowed <= 0}
                              onChange={e => {
                                const val = Math.max(0, parseInt(e.target.value) || 0);
                                setReturnQtyMap(prev => ({
                                  ...prev,
                                  [it.productId]: Math.min(val, maxAllowed)
                                }));
                              }}
                              className="w-20 p-1.5 text-center text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-lg font-bold"
                            />
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-[#A8503A]">
                            {fmt(lineTotal)} ج
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Settlement Method & Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center p-3.5 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
                <div>
                  <label className="block text-xs font-semibold text-[#3A4A63] mb-1.5">طريقة التسوية المالية *</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1F2A3C]">
                      <input
                        type="radio"
                        name="refundMethod"
                        value="credit"
                        checked={refundMethod === 'credit'}
                        onChange={() => setRefundMethod('credit')}
                        className="text-[#A9762F]"
                      />
                      تخفيض مديونية المورد (آجل)
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-[#1F2A3C]">
                      <input
                        type="radio"
                        name="refundMethod"
                        value="cash"
                        checked={refundMethod === 'cash'}
                        onChange={() => setRefundMethod('cash')}
                        className="text-[#A9762F]"
                      />
                      استرداد نقدي فوري بالخزينة (كاش)
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#3A4A63] mb-1">ملاحظات وسبب الإرجاع</label>
                  <input
                    type="text"
                    placeholder="مثال: بضاعة تالفة، عيوب طباعة، إلخ..."
                    value={returnNotes}
                    onChange={e => setReturnNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-[#FFFDF8] border border-[#D8CBB0] rounded-xl"
                  />
                </div>
              </div>

              {/* Submit Return Button */}
              <button
                disabled={saving}
                onClick={handleSavePurchaseReturn}
                className="w-full py-3 rounded-xl bg-[#A8503A] hover:bg-[#92422e] text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                {saving ? 'جاري تنفيذ المرتجع...' : 'تأكيد وحفظ مرتجع المشتريات وتحديث التكلفة والأرصدة'}
              </button>
            </div>
          ) : (
            <div className="p-8 text-center text-[#8E98A6] text-xs">
              الرجاء اختيار فاتورة شراء لعرض بنودها وتحديد الأصناف والكميات المراد إرجاعها للمورد
            </div>
          )}
        </div>
      ) : (
        /* NEW PURCHASE TAB */
        <>
      {/* 1. Excel/CSV Smart Import Accordion */}
      <div className="p-4 rounded-2xl bg-[#FAF6EE] border border-[#D8CBB0] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-[#5C7A5E]" />
            استيراد فاتورة شراء من ملف إكسيل / CSV مع مطابقة ذكية
          </h3>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1 text-xs font-bold text-[#A9762F] hover:underline"
          >
            <Download className="w-3.5 h-3.5" />
            تحميل نموذج Excel
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">المورد</label>
            <select
              className="w-full px-3 py-2 text-xs bg-[#FFFDF8] border border-[#D8CBB0] rounded-xl"
              value={xlsxSupplierId}
              onChange={e => setXlsxSupplierId(e.target.value)}
            >
              <option value="">— اختر مورد —</option>
              {(db.suppliers || []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">ملف الإكسيل (.xlsx / .csv)</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#EFE7D6] file:text-[#1F2A3C] hover:file:bg-[#e4d9bd] cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">الخصم الإضافي</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full px-3 py-2 text-xs bg-[#FFFDF8] border border-[#D8CBB0] rounded-xl"
              value={xlsxDiscount}
              onChange={e => setXlsxDiscount(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Review Table */}
        {xlsxRows.length > 0 && (
          <div className="mt-4 space-y-3 pt-3 border-t border-[#D8CBB0]">
            <h4 className="font-serif font-bold text-xs md:text-sm text-[#1F2A3C]">
              🔍 مراجعة المطابقات وتفادي دبلجة الأصناف ({xlsxRows.length} صنف)
            </h4>
            <div className="overflow-x-auto border border-[#D8CBB0] rounded-xl max-h-64 bg-white">
              <table className="w-full text-xs text-right">
                <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C] sticky top-0">
                  <tr>
                    <th className="p-2">الاسم في الملف</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2 text-center">التكلفة</th>
                    <th className="p-2">الصنف المطابق بالمخزون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFE7D6]">
                  {xlsxRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FAF6EE]">
                      <td className="p-2 font-medium">{row.name}</td>
                      <td className="p-2 text-center font-bold">{row.qty}</td>
                      <td className="p-2 text-center font-mono">{fmt(row.cost)}</td>
                      <td className="p-2">
                        <select
                          className="w-full p-1.5 bg-[#F6F1E7] border border-[#D8CBB0] rounded text-xs"
                          value={row.selectedMatch}
                          onChange={e => {
                            const val = e.target.value;
                            setXlsxRows(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], selectedMatch: val };
                              return next;
                            });
                          }}
                        >
                          <option value="__new__">➕ إضافة كصنف جديد</option>
                          {row.candidates.map((c: any) => (
                            <option key={c.p.id} value={c.p.id}>
                              {productFullName(c.p)} (تطابق {Math.round(c.score * 100)}%)
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              disabled={saving}
              onClick={handleConfirmXlsxImport}
              className="px-5 py-2.5 rounded-xl bg-[#5C7A5E] hover:bg-[#4c684e] text-white font-bold text-xs md:text-sm transition-colors shadow-xs"
            >
              ✅ تأكيد الاستيراد ونقل الأصناف للفاتورة
            </button>
          </div>
        )}
      </div>

      {/* 2. Manual Purchase Invoice Builder */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#EFE7D6]">
          <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-[#A9762F]" />
            فاتورة شراء جديدة (يدوي)
          </h3>
          <span className="text-xs text-[#8E98A6]">{todayStr()}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">المورد</label>
            <select
              className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
              value={supplierId}
              onChange={e => setSupplierId(e.target.value)}
            >
              <option value="">— اختر مورد —</option>
              {(db.suppliers || []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Item Picker */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-3 border-t border-[#EFE7D6]">
          <div className="sm:col-span-5 relative">
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">🔍 ابحث عن صنف</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
              placeholder="اكتب اسم صنف أو كود..."
              value={prodSearch}
              onChange={e => {
                setProdSearch(e.target.value);
                setMatchingOpen(true);
              }}
              onFocus={() => setMatchingOpen(true)}
            />
            {matchingOpen && matchingProducts.length > 0 && (
              <div className="absolute top-full right-0 left-0 z-30 mt-1 bg-[#FFFDF8] border border-[#D8CBB0] rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-[#EFE7D6]">
                {matchingProducts.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProduct(p)}
                    className="p-2.5 hover:bg-[#EFE7D6] cursor-pointer flex justify-between text-xs"
                  >
                    <span><b>{p.name}</b> ({productFullName(p)})</span>
                    <span>تكلفة: {fmt(p.costPrice)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">الكمية</label>
            <input
              type="number"
              min="1"
              className="w-full px-2 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl text-center font-bold"
              value={itemQty}
              onChange={e => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">سعر التكلفة</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full px-2 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl text-center font-bold"
              value={costPrice}
              onChange={e => setCostPrice(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">سعر البيع</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full px-2 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl text-center font-bold"
              value={sellPrice}
              onChange={e => setSellPrice(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="sm:col-span-1 flex items-end">
            <button
              onClick={handleAddManualItem}
              className="w-full py-2 rounded-xl bg-[#5C7A5E] hover:bg-[#4c684e] text-white font-bold text-sm flex items-center justify-center"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Cart Table */}
        <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl mt-3">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
              <tr>
                <th className="p-2.5">الصنف</th>
                <th className="p-2.5 text-center">الكمية</th>
                <th className="p-2.5 text-center">سعر التكلفة</th>
                <th className="p-2.5 text-center">سعر البيع</th>
                <th className="p-2.5 text-center">الإجمالي</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7D6]">
              {purchaseCartItems.length > 0 ? (
                purchaseCartItems.map((it, idx) => (
                  <tr key={idx} className="hover:bg-[#FAF6EE]">
                    <td className="p-2.5 font-medium">{it.name}</td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min="1"
                        className="w-16 px-1 py-1 text-xs border border-[#D8CBB0] rounded text-center font-bold"
                        value={it.qty}
                        onChange={e => {
                          const q = Math.max(1, parseInt(e.target.value) || 1);
                          setPurchaseCartItems(prev => {
                            const next = [...prev];
                            next[idx] = { ...next[idx], qty: q };
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="p-2.5 text-center font-mono">{fmt(it.cost)}</td>
                    <td className="p-2.5 text-center font-mono">{fmt(it.sellPrice)}</td>
                    <td className="p-2.5 text-center font-mono font-bold text-[#A9762F]">
                      {fmt(it.qty * it.cost)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        onClick={() => {
                          setPurchaseCartItems(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="p-1 text-[#A8503A] hover:bg-[#A8503A]/10 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#8E98A6]">
                    لم يتم إضافة أصناف لفاتورة الشراء بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Financial Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-3 border-t border-[#EFE7D6]">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-[#3A4A63] mb-1">خصم المورد</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
                value={discount}
                onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#3A4A63] mb-1">المدفوع الآن</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono"
                value={paidAmount}
                onChange={e => setPaidAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF6EE] border border-[#D8CBB0] text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-[#8E98A6]">الإجمالي:</span>
              <span className="font-mono">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-[#A9762F]">
              <span>الصافي بعد الخصم:</span>
              <span className="font-mono">{fmt(total)} ج</span>
            </div>
            {dueAmount > 0 && (
              <div className="flex justify-between text-[#A8503A] font-bold">
                <span>المتبقي آجل للمورد:</span>
                <span className="font-mono">{fmt(dueAmount)} ج</span>
              </div>
            )}
          </div>
        </div>

        <button
          disabled={saving || !purchaseCartItems.length}
          onClick={handleSavePurchase}
          className="w-full py-3 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-sm shadow-md transition-all disabled:opacity-50"
        >
          {saving ? 'جاري الحفظ...' : '💾 حفظ فاتورة الشراء وتحديث الأرصدة والتكلفة'}
        </button>
      </div>
      </>
      )}
    </div>
  );
};
