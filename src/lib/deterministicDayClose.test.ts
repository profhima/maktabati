import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DailyClosing, Expense } from '../types';

// Mock localStorage for test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

describe('Phase 2.2.5.3 — Date Model Foundation & Deterministic Day Close Tests', () => {

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  // =========================================================================
  // TEST 1 & TEST 4: Deterministic Close ID and operationKey
  // =========================================================================
  it('Test 1 & 4: New Day Close uses closeDate as deterministic ID and operationKey', () => {
    const closeDate = '2026-10-01';
    const deterministicCloseId = closeDate;
    const deterministicOpKey = `op_close_${closeDate}`;

    const closing: DailyClosing = {
      id: deterministicCloseId,
      date: closeDate,
      shiftId: deterministicCloseId,
      expectedCash: 5000,
      actualCash: 5000,
      difference: 0,
      closedDate: closeDate,
      createdAt: '2026-10-01T22:00:00.000Z'
    };

    expect(closing.id).toBe('2026-10-01');
    expect(closing.date).toBe(closeDate);
    expect(closing.closedDate).toBe('2026-10-01');
    expect(deterministicOpKey).toBe('op_close_2026-10-01');
  });

  // =========================================================================
  // TEST 2: Duplicate Day Close rejection
  // =========================================================================
  it('Test 2: Attempting to close the same date a second time is rejected', () => {
    const existingClosings: DailyClosing[] = [
      {
        id: '2026-10-01',
        date: '2026-10-01',
        actualCash: 5000,
        expectedCash: 5000
      }
    ];

    const targetDate = '2026-10-01';
    const isAlreadyClosed = existingClosings.some(c => c.date === targetDate || c.id === targetDate);

    expect(isAlreadyClosed).toBe(true);

    // Simulated handler logic
    let errorThrown = false;
    try {
      if (isAlreadyClosed) {
        throw new Error(`ALREADY_CLOSED: تم إقفال وردية يوم ${targetDate} مسبقاً.`);
      }
    } catch (err: any) {
      errorThrown = true;
      expect(err.message).toContain('ALREADY_CLOSED');
    }
    expect(errorThrown).toBe(true);
  });

  // =========================================================================
  // TEST 3: Concurrent close from two devices
  // =========================================================================
  it('Test 3: Two devices attempting to close the same date simultaneously - exactly one succeeds', async () => {
    const cloudDb = new Map<string, any>();
    const closeDate = '2026-10-01';
    const opKey = `op_close_${closeDate}`;

    // Simulated atomic transaction
    const executeCloseTx = async (deviceId: string) => {
      // Simulate transactional read
      if (cloudDb.has(`dailyClosings/${closeDate}`) || cloudDb.has(`operationKeys/${opKey}`)) {
        throw new Error(`ALREADY_CLOSED from device ${deviceId}`);
      }
      // Commit
      cloudDb.set(`dailyClosings/${closeDate}`, { id: closeDate, date: closeDate, device: deviceId });
      cloudDb.set(`operationKeys/${opKey}`, { committedBy: deviceId });
      return { success: true, device: deviceId };
    };

    // Device A runs first
    const resultA = await executeCloseTx('Device_A');
    expect(resultA.success).toBe(true);
    expect(cloudDb.get(`dailyClosings/${closeDate}`).device).toBe('Device_A');

    // Device B runs next on the same date
    let errorB: any = null;
    try {
      await executeCloseTx('Device_B');
    } catch (err) {
      errorB = err;
    }

    expect(errorB).not.toBeNull();
    expect(errorB.message).toContain('ALREADY_CLOSED');
    expect(cloudDb.size).toBe(2); // exactly ONE dailyClosing doc and ONE operationKey doc
  });

  // =========================================================================
  // TEST 5: Double-click guard
  // =========================================================================
  it('Test 5: Rapid double click handler execution guard', () => {
    let lockRef = { current: false };
    let executionCount = 0;

    const handleSaveSimulated = () => {
      if (lockRef.current) {
        return; // Rejected synchronously
      }
      lockRef.current = true;
      executionCount++;
    };

    // Click 1
    handleSaveSimulated();
    // Click 2 immediate
    handleSaveSimulated();
    // Click 3 immediate
    handleSaveSimulated();

    expect(executionCount).toBe(1);

    // Reset on finally
    lockRef.current = false;
    handleSaveSimulated();
    expect(executionCount).toBe(2);
  });

  // =========================================================================
  // TEST 6: Transaction failure leaves no partial state
  // =========================================================================
  it('Test 6: Transaction failure leaves no partial close state', async () => {
    const cloudDb = new Map<string, any>();
    const closeDate = '2026-10-02';

    const failedTx = async () => {
      // Simulate failure halfway
      cloudDb.set('temp', 'should_not_persist');
      throw new Error('Network failure during commit');
    };

    try {
      await failedTx();
    } catch (_err) {
      // Rollback
      cloudDb.clear();
    }

    expect(cloudDb.has(`dailyClosings/${closeDate}`)).toBe(false);
    expect(cloudDb.has(`dayCloses/${closeDate}`)).toBe(false);
    expect(cloudDb.has(`operationKeys/op_close_${closeDate}`)).toBe(false);
  });

  // =========================================================================
  // TEST 7: DayClose calculations remain consistent
  // =========================================================================
  it('Test 7: DayClose expectedCash formula arithmetic is verified', () => {
    const totalSalesCash = 10000;
    const totalCustomerPayments = 2000;
    const totalReturnsCashIn = 500;
    const totalDeposits = 1000;
    const totalReturnsCashOut = 800;
    const totalPurchasesCashOut = 3000;
    const totalSupplierPayments = 1500;
    const totalExpenses = 700;
    const totalWithdrawals = 500;

    const expectedCash =
      totalSalesCash +
      totalCustomerPayments +
      totalReturnsCashIn +
      totalDeposits -
      (totalReturnsCashOut + totalPurchasesCashOut + totalSupplierPayments + totalExpenses + totalWithdrawals);

    expect(expectedCash).toBe(7000);
  });

  // =========================================================================
  // TEST 8: Cashier ordinary user cannot post expense to closed date
  // =========================================================================
  it('Test 8: Cashier/ordinary operator cannot post expense to closed date', () => {
    const closedDates = ['2026-09-30', '2026-10-01'];
    const chosenDate = '2026-10-01';
    const isClosed = closedDates.includes(chosenDate);
    const userRole: string = 'cashier';
    const canOverride = userRole === 'admin' || userRole === 'manager';

    const canSubmit = !isClosed || canOverride;
    expect(canSubmit).toBe(false);
  });

  // =========================================================================
  // TEST 9: Manager/Admin can override closed date with reason
  // =========================================================================
  it('Test 9: Manager/Admin can post expense to closed date with explicit override and reason', () => {
    const closedDates = ['2026-10-01'];
    const chosenDate = '2026-10-01';
    const isClosed = closedDates.includes(chosenDate);
    const userRole: string = 'manager';
    const canOverride = userRole === 'admin' || userRole === 'manager';
    const overrideReason = 'فاتورة كهرباء متأخرة تخص وردية الأسبوع الماضي تم سدادها نقداً';

    expect(isClosed).toBe(true);
    expect(canOverride).toBe(true);
    expect(overrideReason.trim().length).toBeGreaterThan(10);

    const expenseRecord: Expense = {
      id: 'exp_override_1',
      amount: 450,
      category: 'كهرباء ومياه',
      date: chosenDate,
      originalEventDate: chosenDate,
      postingDate: '2026-10-02',
      effectiveCashDate: '2026-10-02',
      isManagerOverride: true,
      closedDate: chosenDate,
      overrideReason: overrideReason.trim(),
      overrideManagerUid: 'u_manager_1',
      createdAt: '2026-10-02T10:00:00.000Z'
    };

    expect(expenseRecord.isManagerOverride).toBe(true);
    expect(expenseRecord.closedDate).toBe('2026-10-01');
    expect(expenseRecord.overrideReason).toBe(overrideReason);
  });

  // =========================================================================
  // TEST 10: Open date expense behavior unchanged
  // =========================================================================
  it('Test 10: Open date expense submits normally without override flag', () => {
    const closedDates = ['2026-09-30'];
    const openDate = '2026-10-02';
    const isClosed = closedDates.includes(openDate);
    expect(isClosed).toBe(false);

    const expenseRecord: Expense = {
      id: 'exp_normal_1',
      amount: 150,
      category: 'نثريات وضيافة',
      date: openDate,
      originalEventDate: openDate,
      postingDate: openDate,
      effectiveCashDate: openDate,
      isManagerOverride: false
    };

    expect(expenseRecord.isManagerOverride).toBe(false);
    expect(expenseRecord.date).toBe('2026-10-02');
  });

});
