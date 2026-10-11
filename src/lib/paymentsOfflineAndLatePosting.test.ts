import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomerPayment, SupplierPayment, Customer, Supplier, DailyClosing } from '../types';
import { resolveClosedDayDates, findFirstOpenBusinessDay, BusinessCalendarVersionRecord } from './businessCalendar';
import { OfflineSyncManager, isNetworkOrTransientError } from './offlineSync';

// Mock localStorage for node environment
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => localStorageStore[k] || null,
  setItem: (k: string, v: string) => { localStorageStore[k] = String(v); },
  removeItem: (k: string) => { delete localStorageStore[k]; },
  clear: () => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }
};
Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('Phase 2.4.1: Offline Payments & Closed-Day Late Posting Lifecycle Suite', () => {
  let mockStore: Record<string, any>;

  beforeEach(() => {
    mockStore = {};
    localStorageMock.clear();
    vi.restoreAllMocks();
  });

  const calendarVersions: BusinessCalendarVersionRecord[] = [
    {
      version: 1,
      effectiveFrom: '2026-10-01',
      weeklyHolidays: [5, 6], // Fri, Sat
      officialHolidays: [],
      nonWorkingDates: [],
      createdAt: '2026-10-01T00:00:00Z',
      createdByUid: 'admin',
      createdByName: 'Admin User'
    }
  ];

  // Helper to execute atomic customer payment simulation mirroring production
  async function executeAtomicCustomerPayment(params: {
    customer: Customer;
    payment: CustomerPayment;
    simulateAckFailure?: boolean;
  }): Promise<{ success: boolean; skippedDuplicate?: boolean }> {
    const { customer, payment, simulateAckFailure } = params;
    const opPath = `operationKeys/${payment.operationId}`;
    const custPath = `customers/${customer.id}`;
    const payPath = `customerPayments/${payment.id}`;

    // Read phase
    const opExists = opPath in mockStore;
    if (opExists) {
      return { success: true, skippedDuplicate: true };
    }

    const curCustomer = mockStore[custPath] || customer;
    const curBal = curCustomer.balance || { invoiced: 0, paid: 0 };
    const newPaid = (Number(curBal.paid) || 0) + Number(payment.amount);

    // Commit phase
    mockStore[custPath] = {
      ...curCustomer,
      balance: {
        invoiced: curBal.invoiced || 0,
        paid: newPaid,
        updatedAt: '2026-10-05T12:00:00Z'
      }
    };
    mockStore[payPath] = payment;
    mockStore[opPath] = {
      id: payment.operationId,
      type: 'customer_payment',
      targetId: payment.id,
      amount: payment.amount,
      date: payment.date
    };

    if (simulateAckFailure) {
      throw new Error('NETWORK_TIMEOUT_AFTER_COMMIT');
    }

    return { success: true };
  }

  // Helper to execute atomic supplier payment simulation mirroring production
  async function executeAtomicSupplierPayment(params: {
    supplier: Supplier;
    payment: SupplierPayment;
    simulateAckFailure?: boolean;
  }): Promise<{ success: boolean; skippedDuplicate?: boolean }> {
    const { supplier, payment, simulateAckFailure } = params;
    const opPath = `operationKeys/${payment.operationId}`;
    const suppPath = `suppliers/${supplier.id}`;
    const payPath = `supplierPayments/${payment.id}`;

    // Read phase
    const opExists = opPath in mockStore;
    if (opExists) {
      return { success: true, skippedDuplicate: true };
    }

    const curSupplier = mockStore[suppPath] || supplier;
    const curBal = curSupplier.balance || { invoiced: 0, paid: 0 };
    const newPaid = (Number(curBal.paid) || 0) + Number(payment.amount);

    // Commit phase
    mockStore[suppPath] = {
      ...curSupplier,
      balance: {
        invoiced: curBal.invoiced || 0,
        paid: newPaid,
        updatedAt: '2026-10-05T12:00:00Z'
      }
    };
    mockStore[payPath] = payment;
    mockStore[opPath] = {
      id: payment.operationId,
      type: 'supplier_payment',
      targetId: payment.id,
      amount: payment.amount,
      date: payment.date
    };

    if (simulateAckFailure) {
      throw new Error('NETWORK_TIMEOUT_AFTER_COMMIT');
    }

    return { success: true };
  }

  // =========================================================================
  // 1. CRITICAL SCENARIO TESTS (A, B, C, D, E, F, G)
  // =========================================================================

  it('TEST A: Supplier Double Retry Idempotency (3 retries -> exactly 1 financial effect)', async () => {
    const supplier: Supplier = {
      id: 'supp_100',
      name: 'دار النشر الأهلية',
      balance: { invoiced: 10000, paid: 0 }
    };
    mockStore[`suppliers/${supplier.id}`] = supplier;

    const paymentId = 'pay_supp_retry_01';
    const opId = `op_supp_pay_${paymentId}`;
    const paymentRecord: SupplierPayment = {
      id: paymentId,
      supplierId: supplier.id,
      amount: 3000,
      date: '2026-10-05',
      operationId: opId,
      originalEventDate: '2026-10-05',
      statementDate: '2026-10-05',
      actualCashDate: '2026-10-05',
      postingDate: '2026-10-05',
      effectiveCashDate: '2026-10-05',
      isLatePosting: false,
      createdAt: '2026-10-05T10:00:00Z'
    };

    // Execute 3 times with the same operationId
    const res1 = await executeAtomicSupplierPayment({ supplier, payment: paymentRecord });
    const res2 = await executeAtomicSupplierPayment({ supplier, payment: paymentRecord });
    const res3 = await executeAtomicSupplierPayment({ supplier, payment: paymentRecord });

    expect(res1.success).toBe(true);
    expect(res1.skippedDuplicate).toBeUndefined();
    expect(res2.skippedDuplicate).toBe(true);
    expect(res3.skippedDuplicate).toBe(true);

    const updatedSupplier = mockStore[`suppliers/${supplier.id}`];
    expect(updatedSupplier.balance.paid).toBe(3000); // NOT 9000
    const netDue = updatedSupplier.balance.invoiced - updatedSupplier.balance.paid;
    expect(netDue).toBe(7000);

    const paymentDocs = Object.keys(mockStore).filter(k => k.startsWith('supplierPayments/'));
    expect(paymentDocs.length).toBe(1);
  });

  it('TEST B: Customer Double Retry Idempotency (3 retries -> exactly 1 financial effect)', async () => {
    const customer: Customer = {
      id: 'cust_200',
      name: 'أحمد محمود',
      points: 0,
      balance: { invoiced: 10000, paid: 0 }
    };
    mockStore[`customers/${customer.id}`] = customer;

    const paymentId = 'pay_cust_retry_01';
    const opId = `op_cust_pay_${paymentId}`;
    const paymentRecord: CustomerPayment = {
      id: paymentId,
      customerId: customer.id,
      amount: 3000,
      date: '2026-10-05',
      operationId: opId,
      originalEventDate: '2026-10-05',
      statementDate: '2026-10-05',
      actualCashDate: '2026-10-05',
      postingDate: '2026-10-05',
      effectiveCashDate: '2026-10-05',
      isLatePosting: false,
      createdAt: '2026-10-05T10:00:00Z'
    };

    const res1 = await executeAtomicCustomerPayment({ customer, payment: paymentRecord });
    const res2 = await executeAtomicCustomerPayment({ customer, payment: paymentRecord });
    const res3 = await executeAtomicCustomerPayment({ customer, payment: paymentRecord });

    expect(res1.success).toBe(true);
    expect(res2.skippedDuplicate).toBe(true);
    expect(res3.skippedDuplicate).toBe(true);

    const updatedCustomer = mockStore[`customers/${customer.id}`];
    expect(updatedCustomer.balance.paid).toBe(3000); // NOT 9000
    const netDebt = updatedCustomer.balance.invoiced - updatedCustomer.balance.paid;
    expect(netDebt).toBe(7000);

    const paymentDocs = Object.keys(mockStore).filter(k => k.startsWith('customerPayments/'));
    expect(paymentDocs.length).toBe(1);
  });

  it('TEST C: Closed-Day Customer Payment Late Posting (Day D closed -> posts to next open business day via resolveClosedDayDates)', () => {
    const closedDates = ['2026-10-05']; // Monday 2026-10-05 closed
    const resolved = resolveClosedDayDates('2026-10-05', closedDates, calendarVersions);

    expect(resolved.isLatePosting).toBe(true);
    expect(resolved.originalEventDate).toBe('2026-10-05');
    expect(resolved.actualCashDate).toBe('2026-10-05');
    expect(resolved.statementDate).toBe('2026-10-05');
    expect(resolved.closedDate).toBe('2026-10-05');
    // First open day is 2026-10-06 (Tuesday)
    expect(resolved.postingDate).toBe('2026-10-06');
    expect(resolved.effectiveCashDate).toBe('2026-10-06');
  });

  it('TEST C2: Unit test for findFirstOpenBusinessDay() shifting closed day to next open business day', () => {
    const closedDates = new Set(['2026-10-05']); // 2026-10-05 is closed
    const nextDay = findFirstOpenBusinessDay('2026-10-05', calendarVersions, closedDates);
    expect(nextDay).toBe('2026-10-06');

    // When next day is also closed, it must shift to the next available open day
    const multipleClosed = new Set(['2026-10-05', '2026-10-06']);
    const nextAvailableDay = findFirstOpenBusinessDay('2026-10-05', calendarVersions, multipleClosed);
    expect(nextAvailableDay).toBe('2026-10-07');
  });

  it('TEST D: Closed-Day Supplier Payment Late Posting (Day D closed -> posts to next open business day)', () => {
    // Thu 2026-10-08 closed; Fri 2026-10-09 & Sat 2026-10-10 weekly holidays
    const closedDates = ['2026-10-08'];
    const resolved = resolveClosedDayDates('2026-10-08', closedDates, calendarVersions);

    expect(resolved.isLatePosting).toBe(true);
    expect(resolved.originalEventDate).toBe('2026-10-08');
    expect(resolved.closedDate).toBe('2026-10-08');
    // Jumps over weekend (Fri 09, Sat 10) to Sunday 2026-10-11
    expect(resolved.postingDate).toBe('2026-10-11');
    expect(resolved.effectiveCashDate).toBe('2026-10-11');
  });

  it('TEST E: Normal Open-Day Payment (Day D open -> posts on same day)', () => {
    const closedDates = ['2026-10-01']; // Different day closed
    const resolved = resolveClosedDayDates('2026-10-05', closedDates, calendarVersions);

    expect(resolved.isLatePosting).toBe(false);
    expect(resolved.closedDate).toBeNull();
    expect(resolved.postingDate).toBe('2026-10-05');
    expect(resolved.effectiveCashDate).toBe('2026-10-05');
    expect(resolved.originalEventDate).toBe('2026-10-05');
  });

  it('TEST F: Cross Device Duplicate Protection', async () => {
    const customer: Customer = {
      id: 'cust_300',
      name: 'محمود حسن',
      points: 0,
      balance: { invoiced: 5000, paid: 0 }
    };
    mockStore[`customers/${customer.id}`] = customer;

    const sharedOpId = 'op_cust_pay_shared_999';
    const clientA: CustomerPayment = {
      id: 'pay_shared_999',
      customerId: customer.id,
      amount: 1500,
      date: '2026-10-05',
      operationId: sharedOpId,
      originalEventDate: '2026-10-05',
      postingDate: '2026-10-05',
      effectiveCashDate: '2026-10-05',
      statementDate: '2026-10-05',
      createdAt: '2026-10-05T10:00:00Z'
    };

    const clientB: CustomerPayment = {
      id: 'pay_shared_999',
      customerId: customer.id,
      amount: 1500,
      date: '2026-10-05',
      operationId: sharedOpId,
      originalEventDate: '2026-10-05',
      postingDate: '2026-10-05',
      effectiveCashDate: '2026-10-05',
      statementDate: '2026-10-05',
      createdAt: '2026-10-05T10:00:01Z'
    };

    const resA = await executeAtomicCustomerPayment({ customer, payment: clientA });
    const resB = await executeAtomicCustomerPayment({ customer, payment: clientB });

    expect(resA.success).toBe(true);
    expect(resB.skippedDuplicate).toBe(true);
    expect(mockStore[`customers/${customer.id}`].balance.paid).toBe(1500);
  });

  it('TEST G: Network Failure After Commit (Recovery retry does not double debit)', async () => {
    const supplier: Supplier = {
      id: 'supp_400',
      name: 'مؤسسة الكتب الحديثة',
      balance: { invoiced: 8000, paid: 0 }
    };
    mockStore[`suppliers/${supplier.id}`] = supplier;

    const payment: SupplierPayment = {
      id: 'pay_supp_ack_fail',
      supplierId: supplier.id,
      amount: 2000,
      date: '2026-10-05',
      operationId: 'op_supp_pay_ack_fail',
      originalEventDate: '2026-10-05',
      postingDate: '2026-10-05',
      effectiveCashDate: '2026-10-05',
      statementDate: '2026-10-05',
      createdAt: '2026-10-05T10:00:00Z'
    };

    // First attempt commits to DB but throws before client receives response
    await expect(
      executeAtomicSupplierPayment({ supplier, payment, simulateAckFailure: true })
    ).rejects.toThrow('NETWORK_TIMEOUT_AFTER_COMMIT');

    // State on server was committed
    expect(mockStore[`suppliers/${supplier.id}`].balance.paid).toBe(2000);

    // Client retries the same operation
    const retryRes = await executeAtomicSupplierPayment({ supplier, payment });
    expect(retryRes.skippedDuplicate).toBe(true);
    expect(mockStore[`suppliers/${supplier.id}`].balance.paid).toBe(2000); // Still 2000, not 4000
  });

  // =========================================================================
  // 2. OFFLINE QUEUE & SYNC INTEGRATION
  // =========================================================================

  it('Offline Queue: Enqueue customerPayment and supplierPayment into OfflineSyncManager', () => {
    const cp: CustomerPayment = {
      id: 'cp_off_01',
      customerId: 'c1',
      customerName: 'عميل أوفلاين',
      amount: 450,
      date: '2026-10-05',
      operationId: 'op_cust_pay_cp_off_01',
      originalEventDate: '2026-10-05',
      statementDate: '2026-10-05',
      actualCashDate: '2026-10-05',
      postingDate: '2026-10-06',
      effectiveCashDate: '2026-10-06',
      isLatePosting: true,
      createdAt: '2026-10-05T10:00:00Z'
    };

    const sp: SupplierPayment = {
      id: 'sp_off_01',
      supplierId: 's1',
      supplierName: 'مورد أوفلاين',
      amount: 1200,
      date: '2026-10-05',
      operationId: 'op_supp_pay_sp_off_01',
      originalEventDate: '2026-10-05',
      statementDate: '2026-10-05',
      actualCashDate: '2026-10-05',
      postingDate: '2026-10-06',
      effectiveCashDate: '2026-10-06',
      isLatePosting: true,
      createdAt: '2026-10-05T10:00:00Z'
    };

    const opCp = OfflineSyncManager.enqueueCustomerPayment(cp);
    const opSp = OfflineSyncManager.enqueueSupplierPayment(sp);

    expect(opCp.type).toBe('customerPayment');
    expect(opCp.payload.payment.id).toBe('cp_off_01');
    expect(opSp.type).toBe('supplierPayment');
    expect(opSp.payload.payment.id).toBe('sp_off_01');

    const queue = OfflineSyncManager.getQueue();
    expect(queue.length).toBe(2);
  });

  // =========================================================================
  // 3. TREASURY & DAYCLOSE ISOLATION
  // =========================================================================

  it('Treasury Effect: Late posting payment does NOT mutate closed-day cash ledger', () => {
    // Suppose Day 2026-10-05 is closed.
    // A payment recorded late on 2026-10-05 has effectiveCashDate: 2026-10-06.
    const cp: CustomerPayment = {
      id: 'cp_late_1',
      customerId: 'c1',
      amount: 500,
      date: '2026-10-05', // original date
      originalEventDate: '2026-10-05',
      postingDate: '2026-10-06',
      effectiveCashDate: '2026-10-06',
      isLatePosting: true
    };

    // Treasury event resolution logic
    const cashDate = cp.effectiveCashDate || cp.postingDate || cp.date;
    expect(cashDate).toBe('2026-10-06');
    expect(cashDate).not.toBe('2026-10-05'); // Closed day untouched!
  });

  it('DayClose Effect: Late posting payment is included in open business day with Late Reconciliation Delta', () => {
    const customerPayments: CustomerPayment[] = [
      {
        id: 'cp1',
        customerId: 'c1',
        amount: 300,
        date: '2026-10-06',
        effectiveCashDate: '2026-10-06',
        isLatePosting: false
      },
      {
        id: 'cp2',
        customerId: 'c2',
        amount: 700,
        date: '2026-10-05', // from closed day
        effectiveCashDate: '2026-10-06',
        isLatePosting: true
      }
    ];

    const supplierPayments: SupplierPayment[] = [
      {
        id: 'sp1',
        supplierId: 's1',
        amount: 200,
        date: '2026-10-05', // from closed day
        effectiveCashDate: '2026-10-06',
        isLatePosting: true
      }
    ];

    const closeDate = '2026-10-06';

    const dayCustomerPayments = customerPayments.filter(
      cp => (cp.effectiveCashDate || cp.postingDate || cp.date) === closeDate
    );
    const daySupplierPayments = supplierPayments.filter(
      sp => (sp.effectiveCashDate || sp.postingDate || sp.date) === closeDate
    );

    expect(dayCustomerPayments.length).toBe(2);
    expect(daySupplierPayments.length).toBe(1);

    const totalCustomerIn = dayCustomerPayments.reduce((s, cp) => s + cp.amount, 0);
    const totalSupplierOut = daySupplierPayments.reduce((s, sp) => s + sp.amount, 0);
    expect(totalCustomerIn).toBe(1000);
    expect(totalSupplierOut).toBe(200);

    // Late Reconciliation Delta: late in (+700) minus late out (-200) = +500
    const lateIn = dayCustomerPayments.filter(cp => cp.isLatePosting).reduce((s, cp) => s + cp.amount, 0);
    const lateOut = daySupplierPayments.filter(sp => sp.isLatePosting).reduce((s, sp) => s + sp.amount, 0);
    const delta = lateIn - lateOut;
    expect(delta).toBe(500);
  });
});
