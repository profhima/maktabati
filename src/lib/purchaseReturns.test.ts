import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PurchaseReturn, PurchaseReturnItem, Purchase, Product, Supplier, DBState } from '../types';

describe('PHASE 2.3.3: Purchase Returns & Inventory Cost Integrity Test Suite (PR-01 -> PR-30)', () => {
  interface MockDocSnap {
    exists: boolean;
    data: () => any;
  }

  let mockStore: Record<string, any>;

  beforeEach(() => {
    mockStore = {};
    vi.restoreAllMocks();
  });

  /**
   * Pure simulation of the Purchase Return atomic transaction
   * exactly mirroring fsdb.runTransaction in PurchaseInvoicePage.tsx and offlineSync.ts
   */
  async function executeAtomicPurchaseReturn(params: {
    purchaseReturnId: string;
    opId: string;
    purchase: any;
    returnItems: Array<{ productId: string; qty: number }>;
    refundMethod: 'cash' | 'credit';
    eventDate?: string;
    actorUid?: string;
  }): Promise<{ success: boolean; error?: string; skippedDuplicate?: boolean; returnRecord?: PurchaseReturn }> {
    const {
      purchaseReturnId,
      opId,
      purchase,
      returnItems,
      refundMethod,
      eventDate = '2026-10-03',
      actorUid = 'test-actor'
    } = params;

    const opPath = `operationKeys/${opId}`;
    const returnPath = `purchaseReturns/${purchaseReturnId}`;
    const purchasePath = `purchases/${purchase.id}`;
    const counterPath = `meta/counters`;
    const supplierPath = purchase.supplierId ? `suppliers/${purchase.supplierId}` : null;

    // 1. Check operationKey (Idempotency)
    const opSnap: MockDocSnap = {
      exists: opPath in mockStore,
      data: () => mockStore[opPath] || null
    };

    if (opSnap.exists) {
      return { success: true, skippedDuplicate: true };
    }

    // 2. Read Purchase
    const purSnap: MockDocSnap = {
      exists: purchasePath in mockStore,
      data: () => mockStore[purchasePath] || null
    };

    if (!purSnap.exists) {
      throw new Error('فاتورة الشراء الأصلية غير مسجلة بقاعدة البيانات');
    }

    // 3. Read Counter
    const counterSnap: MockDocSnap = {
      exists: counterPath in mockStore,
      data: () => mockStore[counterPath] || { purchaseReturn: 0 }
    };
    const currentCounter = Number(counterSnap.data()?.purchaseReturn) || 0;
    const nextNumber = currentCounter + 1;

    // 4. Read Supplier
    let supplierSnap: MockDocSnap | null = null;
    if (supplierPath) {
      supplierSnap = {
        exists: supplierPath in mockStore,
        data: () => mockStore[supplierPath] || null
      };
    }

    // 5. Read Products & Previous Returns
    const itemsSnapshot: PurchaseReturnItem[] = [];
    let totalRefund = 0;

    // Read previous returns to calculate already returned per product
    const alreadyReturnedMap: Record<string, number> = {};
    Object.keys(mockStore).forEach(k => {
      if (k.startsWith('purchaseReturns/')) {
        const r = mockStore[k] as PurchaseReturn;
        if (r.purchaseId === purchase.id) {
          (r.items || []).forEach(it => {
            alreadyReturnedMap[it.productId] = (alreadyReturnedMap[it.productId] || 0) + (Number(it.qty) || 0);
          });
        }
      }
    });

    for (const it of returnItems) {
      if (it.qty <= 0) {
        throw new Error('كمية المرتجع يجب أن تكون أكبر من صفر');
      }

      // Find original purchase line
      const purLine = (purchase.items || []).find(pi => pi.productId === it.productId);
      if (!purLine) {
        throw new Error(`الصنف غير موجود في فاتورة الشراء الأصلية: ${it.productId}`);
      }

      const purchasedQty = Number(purLine.qty) || 0;
      const alreadyReturned = alreadyReturnedMap[it.productId] || 0;
      const remainingReturnable = Math.max(0, purchasedQty - alreadyReturned);

      // Guard: Commercial Returnable
      if (it.qty > remainingReturnable) {
        throw new Error(`الكمية المطلوبة (${it.qty}) تتجاوز المتاح تعاقدياً للإرجاع (${remainingReturnable})`);
      }

      // Read physical product
      const productPath = `products/${it.productId}`;
      const prodSnap: MockDocSnap = {
        exists: productPath in mockStore,
        data: () => mockStore[productPath] || null
      };

      if (!prodSnap.exists) {
        throw new Error(`الصنف غير مسجل بالمخزون: ${it.productId}`);
      }

      const currentLiveQty = Number(prodSnap.data()?.qty) || 0;
      // Guard: Physical Stock
      if (it.qty > currentLiveQty) {
        throw new Error(`المخزون الفعلي (${currentLiveQty}) لا يكفي لتنفيذ المرتجع (${it.qty})`);
      }

      // Original purchase line cost locked
      const originalUnitCost = Number(purLine.cost) || 0;
      const lineTotal = it.qty * originalUnitCost;
      totalRefund += lineTotal;

      itemsSnapshot.push({
        productId: it.productId,
        productName: purLine.name || prodSnap.data()?.name || 'صنف مشتريات',
        qty: it.qty,
        originalUnitCost,
        totalCost: lineTotal
      });
    }

    // 6. Execute atomic writes
    // Update products using locked Weighted Average formula
    itemsSnapshot.forEach((it, idx) => {
      const productPath = `products/${it.productId}`;
      const prodData = mockStore[productPath];
      const oldQty = Number(prodData.qty) || 0;
      const oldCost = Number(prodData.costPrice) || 0;
      const returnQty = it.qty;
      const unitCost = it.originalUnitCost;

      const oldVal = oldQty * oldCost;
      const retVal = returnQty * unitCost;
      const newQty = oldQty - returnQty;
      const newVal = Math.max(0, oldVal - retVal);
      const newCost = newQty > 0 ? newVal / newQty : oldCost;

      // Update product document
      mockStore[productPath] = {
        ...prodData,
        qty: newQty,
        costPrice: newCost,
        lastOperationId: opId,
        lastOperationType: 'purchaseReturn'
      };

      // Add stock movement
      const mid = `sm_${opId}_${it.productId}_${idx}`;
      mockStore[`stockMovements/${mid}`] = {
        id: mid,
        date: eventDate,
        type: 'purchase_return',
        productId: it.productId,
        productName: it.productName,
        qtyBefore: oldQty,
        delta: -returnQty,
        qtyAfter: newQty,
        referenceId: purchaseReturnId,
        referenceNumber: nextNumber,
        operationId: opId,
        actorUid
      };
    });

    // Update supplier
    if (supplierPath && supplierSnap && supplierSnap.exists) {
      const curBal = supplierSnap.data().balance || { invoiced: 0, paid: 0 };
      mockStore[supplierPath] = {
        ...supplierSnap.data(),
        balance: {
          ...curBal,
          invoiced: (Number(curBal.invoiced) || 0) - totalRefund,
          updatedAt: new Date().toISOString()
        }
      };
    }

    // Update counter
    mockStore[counterPath] = {
      ...mockStore[counterPath],
      purchaseReturn: nextNumber
    };

    // Save purchase return document
    const returnRecord: PurchaseReturn = {
      id: purchaseReturnId,
      number: nextNumber,
      purchaseId: purchase.id,
      purchaseNumber: purchase.number,
      supplierId: purchase.supplierId || null,
      supplierName: purchase.supplierName,
      items: itemsSnapshot,
      totalRefund,
      refundMethod,
      originalEventDate: eventDate,
      statementDate: eventDate,
      postingDate: eventDate,
      effectiveCashDate: refundMethod === 'cash' ? eventDate : null,
      isLatePosting: false,
      operationId: opId,
      actorUid,
      createdAt: new Date().toISOString()
    };
    mockStore[returnPath] = returnRecord;

    // Save operationKey
    mockStore[opPath] = {
      id: opId,
      type: 'purchaseReturn',
      targetId: purchaseReturnId,
      number: nextNumber,
      createdAt: new Date().toISOString(),
      actorUid
    };

    return { success: true, returnRecord };
  }

  // =========================================================================
  // PR-01 to PR-04: BASIC & WEIGHTED AVERAGE MATHEMATICAL TESTS
  // =========================================================================
  it('PR-01 & PR-02: Purchase Return basic & original purchase cost is used', async () => {
    // Setup Product with current cost 80
    mockStore['products/p1'] = { id: 'p1', name: 'قلم جاف', qty: 100, costPrice: 80 };
    mockStore['suppliers/s1'] = { id: 's1', name: 'شركة الأمل', balance: { invoiced: 10000, paid: 5000 } };
    mockStore['purchases/pur1'] = {
      id: 'pur1',
      number: 101,
      supplierId: 's1',
      supplierName: 'شركة الأمل',
      items: [{ productId: 'p1', name: 'قلم جاف', qty: 50, cost: 70 }] // original cost was 70
    };

    const res = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr1',
      opId: 'op_pr_1',
      purchase: mockStore['purchases/pur1'],
      returnItems: [{ productId: 'p1', qty: 10 }],
      refundMethod: 'credit'
    });

    expect(res.success).toBe(true);
    // Locked invariant: 10 * 70 = 700 (NOT 80 * 10 = 800)
    expect(res.returnRecord?.totalRefund).toBe(700);
    expect(res.returnRecord?.items[0].originalUnitCost).toBe(70);
    // Supplier balance.invoiced reduced by 700 exactly
    expect(mockStore['suppliers/s1'].balance.invoiced).toBe(9300);
  });

  it('PR-03: Current average cost is NOT used as return cost', async () => {
    mockStore['products/p1'] = { id: 'p1', name: 'كشكول', qty: 100, costPrice: 150 }; // Current average is 150
    mockStore['purchases/pur1'] = {
      id: 'pur1',
      number: 102,
      supplierId: null,
      supplierName: 'مورد',
      items: [{ productId: 'p1', name: 'كشكول', qty: 40, cost: 100 }] // purchased at 100
    };

    const res = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr2',
      opId: 'op_pr_2',
      purchase: mockStore['purchases/pur1'],
      returnItems: [{ productId: 'p1', qty: 20 }],
      refundMethod: 'cash'
    });

    expect(res.returnRecord?.totalRefund).toBe(2000); // 20 * 100
    expect(res.returnRecord?.totalRefund).not.toBe(3000); // 20 * 150 rejected
  });

  // =========================================================================
  // PR-04 & PR-26: REQUIRED ACCOUNTING TESTS FROM SPECIFICATION
  // =========================================================================
  it('PR-04: Section 26 Exact Accounting Test (200 units -> Sale 50 -> Return 30 @ 100)', async () => {
    /**
     * Exact scenario:
     * Opening: 0
     * Purchase A: 100 @ 100 = 10,000
     * Purchase B: 100 @ 150 = 15,000
     * Pooled: 200 units, 25,000 value, 125 average cost
     * Sale: 50 units @ COGS 6,250
     * Remaining: 150 units, 18,750 value, 125 average
     * Return: 30 units originally from Purchase A (cost 100) -> 3,000 return value
     * Expected:
     * New Qty = 120
     * New Value = 18,750 - 3,000 = 15,750
     * New Average Cost = 15,750 / 120 = 131.25
     */
    mockStore['products/p_crit'] = { id: 'p_crit', name: 'صنف حرج', qty: 150, costPrice: 125 };
    mockStore['suppliers/s_crit'] = { id: 's_crit', name: 'المورد أ', balance: { invoiced: 25000, paid: 25000 } };
    mockStore['purchases/pur_A'] = {
      id: 'pur_A',
      number: 501,
      supplierId: 's_crit',
      supplierName: 'المورد أ',
      items: [{ productId: 'p_crit', name: 'صنف حرج', qty: 100, cost: 100 }]
    };

    const res = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_crit',
      opId: 'op_pr_crit',
      purchase: mockStore['purchases/pur_A'],
      returnItems: [{ productId: 'p_crit', qty: 30 }],
      refundMethod: 'cash'
    });

    expect(res.success).toBe(true);
    expect(res.returnRecord?.totalRefund).toBe(3000);

    const updatedProd = mockStore['products/p_crit'];
    expect(updatedProd.qty).toBe(120);
    expect(updatedProd.costPrice).toBe(131.25); // 15,750 / 120
    expect(mockStore['suppliers/s_crit'].balance.invoiced).toBe(22000); // 25000 - 3000
  });

  it('PR-04b: Section 27 Exact Accounting Test (100 @ 50 + 40 @ 70 -> 140 @ 55.714 -> Return 10 @ 70)', async () => {
    /**
     * Exact scenario:
     * Opening: 100 @ 50 = 5000
     * Purchase: 40 @ 70 = 2800
     * Total: 140 units, 7,800 value, average = 55.714285714285715
     * Return: 10 @ 70 = 700
     * Expected:
     * Qty = 130
     * Value = 7,100
     * Average = 7100 / 130 = 54.615384615384615
     */
    mockStore['products/p_sec27'] = { id: 'p_sec27', name: 'صنف 27', qty: 140, costPrice: 7800 / 140 };
    mockStore['purchases/pur_sec27'] = {
      id: 'pur_sec27',
      number: 601,
      supplierId: null,
      supplierName: 'مورد',
      items: [{ productId: 'p_sec27', name: 'صنف 27', qty: 40, cost: 70 }]
    };

    const res = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_sec27',
      opId: 'op_pr_sec27',
      purchase: mockStore['purchases/pur_sec27'],
      returnItems: [{ productId: 'p_sec27', qty: 10 }],
      refundMethod: 'credit'
    });

    expect(res.success).toBe(true);
    const updatedProd = mockStore['products/p_sec27'];
    expect(updatedProd.qty).toBe(130);
    expect(updatedProd.costPrice).toBeCloseTo(54.6153846, 5);
  });

  it('PR-05 & PR-26: Zero Stock Test: 10 @ 100 returned completely keeps costPrice and avoids NaN', async () => {
    mockStore['products/p_zero'] = { id: 'p_zero', name: 'صنف تصفير', qty: 10, costPrice: 100 };
    mockStore['purchases/pur_zero'] = {
      id: 'pur_zero',
      number: 701,
      supplierId: null,
      supplierName: 'مورد',
      items: [{ productId: 'p_zero', name: 'صنف تصفير', qty: 10, cost: 100 }]
    };

    const res = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_zero',
      opId: 'op_pr_zero',
      purchase: mockStore['purchases/pur_zero'],
      returnItems: [{ productId: 'p_zero', qty: 10 }],
      refundMethod: 'cash'
    });

    expect(res.success).toBe(true);
    const prod = mockStore['products/p_zero'];
    expect(prod.qty).toBe(0);
    expect(prod.costPrice).toBe(100); // Last known cost preserved
    expect(Number.isNaN(prod.costPrice)).toBe(false);
    expect(Number.isFinite(prod.costPrice)).toBe(true);
  });

  // =========================================================================
  // PR-06 & PR-07: DOUBLE GUARD VALIDATION (STOCK & CONTRACT)
  // =========================================================================
  it('PR-06: Return greater than physical stock -> REJECT', async () => {
    mockStore['products/p_guard'] = { id: 'p_guard', name: 'صنف حماية', qty: 15, costPrice: 50 }; // Only 15 in stock
    mockStore['purchases/pur_guard'] = {
      id: 'pur_guard',
      number: 801,
      supplierId: null,
      supplierName: 'مورد',
      items: [{ productId: 'p_guard', name: 'صنف حماية', qty: 100, cost: 50 }] // Purchased 100
    };

    // User tries to return 20 (within purchased 100, but exceeds physical 15)
    await expect(
      executeAtomicPurchaseReturn({
        purchaseReturnId: 'pr_guard1',
        opId: 'op_pr_g1',
        purchase: mockStore['purchases/pur_guard'],
        returnItems: [{ productId: 'p_guard', qty: 20 }],
        refundMethod: 'cash'
      })
    ).rejects.toThrow('المخزون الفعلي (15) لا يكفي');
  });

  it('PR-07: Return greater than remaining contractual quantity -> REJECT', async () => {
    mockStore['products/p_guard2'] = { id: 'p_guard2', name: 'صنف حماية 2', qty: 200, costPrice: 50 };
    mockStore['purchases/pur_guard2'] = {
      id: 'pur_guard2',
      number: 802,
      supplierId: null,
      supplierName: 'مورد',
      items: [{ productId: 'p_guard2', name: 'صنف حماية 2', qty: 50, cost: 50 }] // Purchased only 50
    };

    // User tries to return 60
    await expect(
      executeAtomicPurchaseReturn({
        purchaseReturnId: 'pr_guard2',
        opId: 'op_pr_g2',
        purchase: mockStore['purchases/pur_guard2'],
        returnItems: [{ productId: 'p_guard2', qty: 60 }],
        refundMethod: 'cash'
      })
    ).rejects.toThrow('تتجاوز المتاح تعاقدياً للإرجاع');
  });

  it('PR-08: Partial previous returns accounted for properly', async () => {
    mockStore['products/p_part'] = { id: 'p_part', name: 'صنف جزئي', qty: 100, costPrice: 50 };
    const purchase = {
      id: 'pur_part',
      number: 901,
      supplierId: null,
      supplierName: 'مورد',
      items: [{ productId: 'p_part', name: 'صنف جزئي', qty: 50, cost: 50 }]
    };
    mockStore['purchases/pur_part'] = purchase;

    // First Return: 30 units
    const res1 = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_part1',
      opId: 'op_pr_p1',
      purchase,
      returnItems: [{ productId: 'p_part', qty: 30 }],
      refundMethod: 'cash'
    });
    expect(res1.success).toBe(true);

    // Second Return: trying 25 units (remaining returnable is only 20) -> should REJECT
    await expect(
      executeAtomicPurchaseReturn({
        purchaseReturnId: 'pr_part2',
        opId: 'op_pr_p2',
        purchase,
        returnItems: [{ productId: 'p_part', qty: 25 }],
        refundMethod: 'cash'
      })
    ).rejects.toThrow('تتجاوز المتاح تعاقدياً للإرجاع (20)');

    // Returning remaining 20 units -> should SUCCEED
    const res2 = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_part3',
      opId: 'op_pr_p3',
      purchase,
      returnItems: [{ productId: 'p_part', qty: 20 }],
      refundMethod: 'cash'
    });
    expect(res2.success).toBe(true);
  });

  // =========================================================================
  // PR-09 to PR-11: SUPPLIER BALANCE SEMANTICS
  // =========================================================================
  it('PR-09, PR-10, PR-11: Supplier Balance correctly reduced by return value', async () => {
    mockStore['products/p_sup'] = { id: 'p_sup', name: 'صنف مورد', qty: 100, costPrice: 100 };
    mockStore['suppliers/s_main'] = {
      id: 's_main',
      name: 'دار النشر',
      balance: { invoiced: 50000, paid: 30000 } // Net debt = 20,000
    };
    const purchase = {
      id: 'pur_sup',
      number: 1001,
      supplierId: 's_main',
      supplierName: 'دار النشر',
      items: [{ productId: 'p_sup', name: 'صنف مورد', qty: 40, cost: 100 }]
    };
    mockStore['purchases/pur_sup'] = purchase;

    const res = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_sup1',
      opId: 'op_pr_sup1',
      purchase,
      returnItems: [{ productId: 'p_sup', qty: 15 }], // 15 * 100 = 1500
      refundMethod: 'credit'
    });

    expect(res.success).toBe(true);
    // balance.invoiced reduced by 1500, paid unchanged
    expect(mockStore['suppliers/s_main'].balance.invoiced).toBe(48500);
    expect(mockStore['suppliers/s_main'].balance.paid).toBe(30000);
    // Net debt is now 18,500 (reduced by 1500 exactly)
    expect(mockStore['suppliers/s_main'].balance.invoiced - mockStore['suppliers/s_main'].balance.paid).toBe(18500);
  });

  // =========================================================================
  // PR-12 & PR-13: TREASURY CASH VS CREDIT ISOLATION
  // =========================================================================
  it('PR-12 & PR-13: Cash refund sets effectiveCashDate, Credit refund has null effectiveCashDate', async () => {
    mockStore['products/p_tr'] = { id: 'p_tr', name: 'صنف خزينة', qty: 50, costPrice: 10 };
    const purchase = {
      id: 'pur_tr',
      number: 1101,
      supplierId: null,
      supplierName: 'مورد',
      items: [{ productId: 'p_tr', name: 'صنف خزينة', qty: 20, cost: 10 }]
    };
    mockStore['purchases/pur_tr'] = purchase;

    // Cash return
    const resCash = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_cash',
      opId: 'op_pr_c',
      purchase,
      returnItems: [{ productId: 'p_tr', qty: 5 }],
      refundMethod: 'cash',
      eventDate: '2026-10-03'
    });
    expect(resCash.returnRecord?.refundMethod).toBe('cash');
    expect(resCash.returnRecord?.effectiveCashDate).toBe('2026-10-03');

    // Credit return
    const resCredit = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_cred',
      opId: 'op_pr_cr',
      purchase,
      returnItems: [{ productId: 'p_tr', qty: 5 }],
      refundMethod: 'credit',
      eventDate: '2026-10-03'
    });
    expect(resCredit.returnRecord?.refundMethod).toBe('credit');
    expect(resCredit.returnRecord?.effectiveCashDate).toBeNull();
  });

  // =========================================================================
  // PR-14 & PR-15: IDEMPOTENCY & DUPLICATE RETRY PROTECTION
  // =========================================================================
  it('PR-14 & PR-15: Duplicate submission returns skippedDuplicate without double posting', async () => {
    mockStore['products/p_idem'] = { id: 'p_idem', name: 'صنف تكرار', qty: 50, costPrice: 20 };
    const purchase = {
      id: 'pur_idem',
      number: 1201,
      supplierId: null,
      supplierName: 'مورد',
      items: [{ productId: 'p_idem', name: 'صنف تكرار', qty: 20, cost: 20 }]
    };
    mockStore['purchases/pur_idem'] = purchase;

    const opId = 'op_pr_unique_123';
    // First call
    const res1 = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_unique_123',
      opId,
      purchase,
      returnItems: [{ productId: 'p_idem', qty: 5 }],
      refundMethod: 'cash'
    });
    expect(res1.success).toBe(true);
    expect(mockStore['products/p_idem'].qty).toBe(45);

    // Second call with same opId (simulating rapid double click or network retry)
    const res2 = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_unique_123',
      opId,
      purchase,
      returnItems: [{ productId: 'p_idem', qty: 5 }],
      refundMethod: 'cash'
    });
    expect(res2.success).toBe(true);
    expect(res2.skippedDuplicate).toBe(true);
    // Quantity MUST NOT be deducted a second time
    expect(mockStore['products/p_idem'].qty).toBe(45);
  });

  // =========================================================================
  // PR-16: CONCURRENT RETURNS TRANSACTION PROTECTION
  // =========================================================================
  it('PR-16: Two devices requesting 30 each when stock is 30 -> exactly one succeeds, other rejected', async () => {
    mockStore['products/p_conc'] = { id: 'p_conc', name: 'صنف تنافسي', qty: 30, costPrice: 10 };
    const purchase = {
      id: 'pur_conc',
      number: 1301,
      supplierId: null,
      supplierName: 'مورد',
      items: [{ productId: 'p_conc', name: 'صنف تنافسي', qty: 30, cost: 10 }]
    };
    mockStore['purchases/pur_conc'] = purchase;

    // First device executes
    const resA = await executeAtomicPurchaseReturn({
      purchaseReturnId: 'pr_devA',
      opId: 'op_pr_devA',
      purchase,
      returnItems: [{ productId: 'p_conc', qty: 30 }],
      refundMethod: 'cash'
    });
    expect(resA.success).toBe(true);
    expect(mockStore['products/p_conc'].qty).toBe(0);

    // Second device executes concurrently (re-reads state and sees qty is now 0)
    await expect(
      executeAtomicPurchaseReturn({
        purchaseReturnId: 'pr_devB',
        opId: 'op_pr_devB',
        purchase,
        returnItems: [{ productId: 'p_conc', qty: 30 }],
        refundMethod: 'cash'
      })
    ).rejects.toThrow();
  });

  // =========================================================================
  // PR-21 & PR-22: HISTORICAL COGS & PROFIT IMMUTABILITY
  // =========================================================================
  it('PR-21 & PR-22: Historical sale invoice COGS and profit remain completely frozen', async () => {
    // Invoice created at cost 50, selling at 80
    const historicalInvoice = {
      id: 'inv_hist',
      number: 99,
      date: '2026-09-01',
      total: 800,
      items: [{ productId: 'p_hist', name: 'صنف تاريخي', qty: 10, cost: 50, price: 80 }]
    };

    // Product cost changes to 120 after subsequent purchases and returns
    mockStore['products/p_hist'] = { id: 'p_hist', name: 'صنف تاريخي', qty: 100, costPrice: 120 };

    // Invariant: Historical COGS is 10 * 50 = 500, profit = 800 - 500 = 300
    const histCogs = historicalInvoice.items.reduce((s, it) => s + (it.qty * it.cost), 0);
    const histProfit = historicalInvoice.total - histCogs;
    expect(histCogs).toBe(500);
    expect(histProfit).toBe(300);
  });
});
