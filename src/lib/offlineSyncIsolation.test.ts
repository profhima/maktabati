import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineSyncManager, QueuedOfflineOperation } from './offlineSync';

// Mock localStorage for Node test environment
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

describe('Item A: Offline Queue Identity & Isolation Suite (OFF-01 & Multi-Domain)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('OFF-01: User B goes offline and enqueues sale -> verifies ownerUid is B', () => {
    // 1. Simulating User B authenticated
    const userBUid = 'auth_uid_user_B';
    const invoiceData: any = {
      invoice: {
        id: 'inv_off_01',
        number: 801,
        date: '2026-10-06',
        total: 250,
        paidAmount: 250,
        items: [{ productId: 'p1', qty: 2, price: 125 }],
        actorUid: userBUid,
        createdBy: userBUid
      },
      stockDeductions: [{ productId: 'p1', delta: -2, name: 'دفتر', newQty: 8 }],
      stockMovements: []
    };

    // Spy on localStorage or enqueue directly
    const op = OfflineSyncManager.enqueueInvoice(invoiceData);

    // 2. Verify operation has ownerUid bound to User B
    expect(op.ownerUid).toBeDefined();
    expect(op.status).toBe('pending');
    expect(op.type).toBe('invoice');

    const queue = OfflineSyncManager.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].id).toBe('op_inv_off_01');
    expect(queue[0].payload.invoice.actorUid).toBe(userBUid);
  });

  it('OFF-01 Execution & Isolation: User B operations are NOT executed when User C triggers sync', async () => {
    const userBUid = 'auth_uid_user_B';
    const userCUid = 'auth_uid_user_C';

    // Queue operation for User B
    const opB: QueuedOfflineOperation = {
      id: 'op_user_B_1',
      type: 'invoice',
      title: 'فاتورة المستخدم B',
      createdAt: new Date().toISOString(),
      ownerUid: userBUid,
      payload: {
        invoice: {
          id: 'inv_b',
          number: 101,
          total: 100,
          actorUid: userBUid,
          createdBy: userBUid
        }
      },
      status: 'pending',
      retryCount: 0
    };
    OfflineSyncManager.saveQueue([opB]);

    // Mock syncSingleOperation
    const syncSpy = vi.spyOn(OfflineSyncManager, 'syncSingleOperation').mockResolvedValue(true);

    // Now User C triggers syncAllPending
    // Simulate fsauth.currentUser = User C
    const { fsauth } = await import('./firebase');
    Object.defineProperty(fsauth, 'currentUser', {
      value: { uid: userCUid },
      configurable: true,
      writable: true
    });

    const result = await OfflineSyncManager.syncAllPending();

    // Verify User B operation was SKIPPED and NOT executed under User C
    expect(result.synced).toBe(0);
    expect(result.skippedOtherUser).toBe(1);
    expect(syncSpy).not.toHaveBeenCalled();

    // Verify queue still safely preserves User B operation as pending
    const remainingQueue = OfflineSyncManager.getQueue();
    expect(remainingQueue.length).toBe(1);
    expect(remainingQueue[0].id).toBe('op_user_B_1');
    expect(remainingQueue[0].ownerUid).toBe(userBUid);
    expect(remainingQueue[0].status).toBe('pending');
  });

  it('OFF-01 Matching: User B operations ARE executed when User B is the authenticated operator', async () => {
    const userBUid = 'auth_uid_user_B';

    const opB: QueuedOfflineOperation = {
      id: 'op_user_B_2',
      type: 'invoice',
      title: 'فاتورة المستخدم B للتنفيذ',
      createdAt: new Date().toISOString(),
      ownerUid: userBUid,
      payload: {
        invoice: {
          id: 'inv_b_sync',
          number: 102,
          total: 100,
          actorUid: userBUid,
          createdBy: userBUid
        }
      },
      status: 'pending',
      retryCount: 0
    };
    OfflineSyncManager.saveQueue([opB]);

    const syncSpy = vi.spyOn(OfflineSyncManager, 'syncSingleOperation').mockResolvedValue(true);

    const { fsauth } = await import('./firebase');
    Object.defineProperty(fsauth, 'currentUser', {
      value: { uid: userBUid },
      configurable: true,
      writable: true
    });

    const result = await OfflineSyncManager.syncAllPending();

    expect(result.synced).toBe(1);
    expect(result.skippedOtherUser).toBe(0);
    expect(syncSpy).toHaveBeenCalledTimes(1);
  });

  it('Legacy operations without ownerUid are NOT synced automatically and remain pending', async () => {
    const legacyOp: QueuedOfflineOperation = {
      id: 'op_legacy_no_owner',
      type: 'invoice',
      title: 'فاتورة قديمة بلا صاحب',
      createdAt: new Date().toISOString(),
      // ownerUid is undefined!
      payload: { invoice: { id: 'inv_legacy', number: 50, total: 50 } },
      status: 'pending',
      retryCount: 0
    };
    OfflineSyncManager.saveQueue([legacyOp]);

    const syncSpy = vi.spyOn(OfflineSyncManager, 'syncSingleOperation').mockResolvedValue(true);

    const { fsauth } = await import('./firebase');
    Object.defineProperty(fsauth, 'currentUser', {
      value: { uid: 'some_active_user' },
      configurable: true,
      writable: true
    });

    const result = await OfflineSyncManager.syncAllPending();

    // Must be skipped to avoid impersonation
    expect(result.synced).toBe(0);
    expect(result.skippedOtherUser).toBe(1);
    expect(syncSpy).not.toHaveBeenCalled();

    const remaining = OfflineSyncManager.getQueue();
    expect(remaining.length).toBe(1);
    expect(remaining[0].status).toBe('pending');
  });

  it('Payment offline enqueue (Customer & Supplier) enforces ownerUid binding', async () => {
    const userUid = 'auth_uid_accountant';
    const { fsauth } = await import('./firebase');
    Object.defineProperty(fsauth, 'currentUser', {
      value: { uid: userUid },
      configurable: true,
      writable: true
    });

    const custPayOp = OfflineSyncManager.enqueueCustomerPayment({
      id: 'cpay_off_1',
      customerId: 'c1',
      customerName: 'عميل',
      amount: 300,
      operationId: 'op_cpay_1',
      date: '2026-10-06'
    });

    expect(custPayOp.ownerUid).toBe(userUid);
    expect(custPayOp.payload.payment.actorUid).toBe(userUid);

    const suppPayOp = OfflineSyncManager.enqueueSupplierPayment({
      id: 'spay_off_1',
      supplierId: 's1',
      supplierName: 'مورد',
      amount: 500,
      operationId: 'op_spay_1',
      date: '2026-10-06'
    });

    expect(suppPayOp.ownerUid).toBe(userUid);
    expect(suppPayOp.payload.payment.actorUid).toBe(userUid);
  });
});
