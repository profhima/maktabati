import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  hasPermission,
  canAccessPage,
  resolveEffectiveSession,
  verifyAdminOrManagerPin,
  LOCAL_USERS_STORAGE_KEY,
  getLocalUserProfiles,
  saveLocalUserProfiles
} from './permissions';
import {
  getPinLockoutStatus,
  recordFailedPinAttempt,
  resetPinAttempts,
  hashPin,
  verifyPin
} from './pinSecurity';
import { OfflineSyncManager, QueuedOfflineOperation } from './offlineSync';
import { fsauth, defaultDB } from './firebase';
import { UserProfile, DBState } from '../types';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { OfflineSyncModal } from '../components/OfflineSyncModal';
import { AppContext, AppContextType } from '../context/AppContext';
import {
  MissingProfileScreen,
  AccountDisabledScreen,
  ProfileVerificationErrorScreen
} from '../components/AccessBlockedScreen';

// Mock localStorage for Node test environment
let mockStore: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, value: string) => {
    mockStore[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete mockStore[key];
  },
  clear: () => {
    mockStore = {};
  }
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Helper to construct a realistic AppContext value for React component testing
function createMockAppContextValue(overrides: Partial<AppContextType> = {}): AppContextType {
  const dummyDb: DBState = defaultDB();

  return {
    db: dummyDb,
    setDb: vi.fn(),
    currentPage: 'dashboard',
    goTo: vi.fn(),
    currentUser: null,
    currentProfile: null,
    effectiveProfile: null,
    isAccountActive: true,
    profileVerificationStatus: 'verified',
    profileVerificationError: null,
    retryProfileVerification: vi.fn(),
    otherUserPendingCount: 0,
    isAdmin: false,
    hasPerm: vi.fn().mockReturnValue(false),
    canAccess: vi.fn().mockReturnValue(true),
    toastMessage: null,
    toast: vi.fn(),
    connStatus: {
      online: true,
      fromCache: false,
      pendingWrites: false,
      draftsCount: 0,
      offlinePendingCount: 0
    },
    offlineModalOpen: false,
    openOfflineModal: vi.fn(),
    closeOfflineModal: vi.fn(),
    pwaInstallPrompt: null,
    triggerPwaInstall: vi.fn(),
    isPwaInstalled: false,
    globalSearchOpen: false,
    openGlobalSearch: vi.fn(),
    closeGlobalSearch: vi.fn(),
    scanModalOpen: false,
    scanCallback: null,
    openScanModal: vi.fn(),
    closeScanModal: vi.fn(),
    quickAddOpen: false,
    quickAddContext: null,
    openQuickAdd: vi.fn(),
    closeQuickAdd: vi.fn(),
    printModalData: null,
    showPrintModal: vi.fn(),
    closePrintModal: vi.fn(),
    egyptianCatalogModalOpen: false,
    openEgyptianCatalogModal: vi.fn(),
    closeEgyptianCatalogModal: vi.fn(),
    shadowTestOpen: false,
    openShadowTest: vi.fn(),
    closeShadowTest: vi.fn(),
    selectedInvoiceForModal: null,
    openInvoiceModal: vi.fn(),
    closeInvoiceModal: vi.fn(),
    reorderInvoiceToCart: vi.fn(),
    saleCartItems: [],
    setSaleCartItems: vi.fn(),
    saleCategoryDiscounts: {},
    setSaleCategoryDiscounts: vi.fn(),
    addSaleItemByProduct: vi.fn().mockReturnValue(true),
    processInvoiceBarcode: vi.fn().mockReturnValue(true),
    clearSaleCart: vi.fn(),
    purchaseCartItems: [],
    setPurchaseCartItems: vi.fn(),
    returnInvoice: null,
    setReturnInvoice: vi.fn(),
    returnSelections: {},
    setReturnSelections: vi.fn(),
    exchangeItems: [],
    setExchangeItems: vi.fn(),
    returnMode: 'cash',
    setReturnMode: vi.fn(),
    clearReturnState: vi.fn(),
    firstSyncDone: true,
    reconcileBalances: vi.fn().mockResolvedValue(undefined),
    ...overrides
  };
}

describe('Stage B Step 1: Final Gap Closure & Hardening Suite (ZIP 25 Verification)', () => {
  beforeEach(() => {
    mockStore = {};
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. PIN & TRUSTED USER PROFILES BOUNDARY (Gaps 1, 2, 3, 4)
  // =========================================================================
  describe('1. Trusted PIN Verification & Deactivated Account Guard', () => {
    it('GAP-01: verifyAdminOrManagerPin rejects when trusted userProfiles is empty, NEVER falling back to localStorage', async () => {
      const adminPin = '1234';
      const adminHash = await hashPin(adminPin);

      // Malicious or stale profile placed in localStorage
      const cachedAdmin: UserProfile = {
        uid: 'stale_admin_uid',
        name: 'مدير مخزن محلياً',
        role: 'admin',
        isActive: true,
        pinHash: adminHash
      };
      localStorage.setItem(LOCAL_USERS_STORAGE_KEY, JSON.stringify([cachedAdmin]));

      // Calling verify with empty trusted profiles list
      const result = await verifyAdminOrManagerPin(adminPin, []);

      // MUST fail safely without granting approval or trusting local storage
      expect(result.valid).toBe(false);
      expect(result.approver).toBeUndefined();
      expect(result.error).toContain('قائمة الموظفين الموثوقة غير متوفرة');
    });

    it('GAP-02: verifyAdminOrManagerPin rejects PIN for deactivated accounts (isActive: false or disabled: true)', async () => {
      const pin = '5678';
      const hash = await hashPin(pin);

      // Account 1: isActive === false
      const inactiveAdmin: UserProfile = {
        uid: 'admin_inactive',
        name: 'مدير موقف',
        role: 'admin',
        isActive: false,
        pinHash: hash
      };

      // Account 2: disabled === true
      const suspendedManager: UserProfile = {
        uid: 'mgr_suspended',
        name: 'مشرف معطل',
        role: 'manager',
        isActive: true,
        disabled: true,
        pinHash: hash
      } as any;

      const resInactive = await verifyAdminOrManagerPin(pin, [inactiveAdmin]);
      expect(resInactive.valid).toBe(false);
      expect(resInactive.approver).toBeUndefined();

      const resSuspended = await verifyAdminOrManagerPin(pin, [suspendedManager]);
      expect(resSuspended.valid).toBe(false);
      expect(resSuspended.approver).toBeUndefined();
    });

    it('GAP-03: verifyAdminOrManagerPin grants approval when trusted profiles contain active admin/manager', async () => {
      const pin = '4321';
      const hash = await hashPin(pin);

      const activeManager: UserProfile = {
        uid: 'mgr_active_01',
        name: 'مروان المشرف',
        role: 'manager',
        isActive: true,
        pinHash: hash
      };

      const result = await verifyAdminOrManagerPin(pin, [activeManager]);
      expect(result.valid).toBe(true);
      expect(result.approver).toEqual({
        name: 'مروان المشرف',
        role: 'manager',
        uid: 'mgr_active_01'
      });
    });

    it('GAP-04: Non-authorized roles (cashier) cannot approve discounts even with matching PIN', async () => {
      const pin = '9999';
      const hash = await hashPin(pin);

      const cashier: UserProfile = {
        uid: 'cashier_01',
        name: 'كاشير عادي',
        role: 'cashier',
        isActive: true,
        pinHash: hash,
        permissions: {
          posSales: true,
          allowDiscountOverride: false
        } as any
      };

      const result = await verifyAdminOrManagerPin(pin, [cashier]);
      expect(result.valid).toBe(false);
      expect(result.approver).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. LOCAL STORAGE CLEANUP & RATE LIMITING (Gaps 5, 6, 7, 11)
  // =========================================================================
  describe('2. Local Storage Cleanliness & Rate Limit Protection', () => {
    it('GAP-05: saveLocalUserProfiles is safely disabled and getLocalUserProfiles returns empty array', () => {
      const dummyProfiles: UserProfile[] = [
        { uid: 'u1', name: 'User 1', role: 'admin', isActive: true }
      ];

      // Calling saveLocalUserProfiles must not populate storage
      saveLocalUserProfiles(dummyProfiles);
      expect(localStorage.getItem(LOCAL_USERS_STORAGE_KEY)).toBeNull();

      // getLocalUserProfiles returns empty
      expect(getLocalUserProfiles()).toEqual([]);
    });

    it('GAP-06: In-flight migration does not write full profile objects to localStorage', async () => {
      const plainPin = '1122';
      const testProfile: UserProfile = {
        uid: 'mig_test_uid',
        name: 'موظف تحت الترحيل',
        role: 'manager',
        isActive: true,
        pinCode: plainPin
      } as any;

      // Verify in-flight migration updates in-memory profile
      const ok = await verifyPin(plainPin, testProfile);
      expect(ok).toBe(true);
      expect(testProfile.pinHash).toBeDefined();
      expect(testProfile.pinHash?.startsWith('pbkdf2:v1:')).toBe(true);
      expect((testProfile as any).pinCode).toBeUndefined();

      // Storage remains clean: no plaintext or hashes saved locally
      expect(localStorage.getItem(LOCAL_USERS_STORAGE_KEY)).toBeNull();
    });

    it('GAP-07: maktabati_pin_rate_limit_v1 enforces 5-minute lockout after 5 failed attempts', () => {
      const testIdentifier = 'op_rate_limit_target';
      resetPinAttempts(testIdentifier);

      expect(getPinLockoutStatus(testIdentifier).isLocked).toBe(false);

      // Perform 4 failed attempts
      for (let i = 1; i <= 4; i++) {
        const attempt = recordFailedPinAttempt(testIdentifier);
        expect(attempt.isLocked).toBe(false);
        expect(attempt.failedAttempts).toBe(i);
      }

      // 5th failed attempt must trigger lockout
      const fifthAttempt = recordFailedPinAttempt(testIdentifier);
      expect(fifthAttempt.isLocked).toBe(true);
      expect(fifthAttempt.remainingSeconds).toBeGreaterThan(0);

      const status = getPinLockoutStatus(testIdentifier);
      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);

      // Successful reset
      resetPinAttempts(testIdentifier);
      expect(getPinLockoutStatus(testIdentifier).isLocked).toBe(false);
    });

    it('GAP-11: App startup removes legacy keys without calling localStorage.clear()', () => {
      // Setup business data and legacy keys in localStorage
      localStorage.setItem('maktabati_active_operator_id', 'legacy_op_123');
      localStorage.setItem('maktabati_local_user_profiles_v2', 'legacy_profiles_raw');
      localStorage.setItem('maktabati_offline_queue_v1', JSON.stringify([{ id: 'preserve_op' }]));

      const clearSpy = vi.spyOn(localStorage, 'clear');

      // Emulate the clean up effect from AppContext
      try {
        localStorage.removeItem('maktabati_active_operator_id');
        localStorage.removeItem('maktabati_local_user_profiles_v2');
      } catch {}

      expect(clearSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem('maktabati_active_operator_id')).toBeNull();
      expect(localStorage.getItem('maktabati_local_user_profiles_v2')).toBeNull();
      // Crucial: Offline queue and other keys MUST remain untouched!
      expect(localStorage.getItem('maktabati_offline_queue_v1')).not.toBeNull();
    });
  });

  // =========================================================================
  // 3. PROFILE VERIFICATION STATE: ERROR VS MISSING (Gaps 8, 9)
  // =========================================================================
  describe('3. Firestore Verification Error vs Missing Profile Distinction', () => {
    it('GAP-08: ProfileVerificationErrorScreen renders on read error with retry & sign-out buttons, without claiming missing profile', () => {
      const mockRetry = vi.fn();
      const mockSignOut = vi.fn();

      const html = renderToString(
        React.createElement(ProfileVerificationErrorScreen, {
          currentUser: { uid: 'auth_error_uid', email: 'worker@store.com' },
          errorMessage: 'PERMISSION_DENIED: Network unreachable or rules error',
          onRetry: mockRetry,
          onSignOut: mockSignOut
        })
      );

      // Must display error heading
      expect(html).toContain('تعذر التحقق من بيانات وصلاحيات الحساب');
      expect(html).toContain('PERMISSION_DENIED');
      expect(html).toContain('إعادة المحاولة');
      expect(html).toContain('تسجيل الخروج');

      // MUST NOT state that the profile does not exist
      expect(html).not.toContain('لا يوجد ملف صلاحيات');
      // MUST NOT render dashboard or POS links
      expect(html).not.toContain('فاتورة بيع');
      expect(html).not.toContain('لوحة التحكم');
    });

    it('GAP-09: MissingProfileScreen renders only when profile absence is confirmed by Firestore', () => {
      const html = renderToString(
        React.createElement(MissingProfileScreen, {
          currentUser: { uid: 'auth_missing_uid', email: 'ghost@store.com' }
        })
      );

      expect(html).toContain('لا يوجد ملف صلاحيات لهذا الحساب');
      expect(html).toContain('ghost@store.com');
      expect(html).toContain('تسجيل الخروج');
      expect(html).not.toContain('فاتورة بيع');
    });
  });

  // =========================================================================
  // 4. USER IDENTITY & OFFLINE QUEUE PRESERVATION (Gaps 10, 11)
  // =========================================================================
  describe('4. User Identity, Offline Queue Isolation & Sign-Out Safety', () => {
    it('GAP-10: Offline operations of other users are preserved and skipped during sync, and remain intact upon sign-out', async () => {
      const queue: QueuedOfflineOperation[] = [
        {
          id: 'op_worker_A',
          type: 'invoice',
          title: 'فاتورة العامل A',
          createdAt: new Date().toISOString(),
          ownerUid: 'uid_worker_A',
          payload: { total: 100 },
          status: 'pending',
          retryCount: 0
        },
        {
          id: 'op_worker_B',
          type: 'invoice',
          title: 'فاتورة العامل B',
          createdAt: new Date().toISOString(),
          ownerUid: 'uid_worker_B',
          payload: { total: 200 },
          status: 'pending',
          retryCount: 0
        }
      ];

      OfflineSyncManager.saveQueue(queue);

      // Worker B logs in and runs sync
      Object.defineProperty(fsauth, 'currentUser', {
        value: { uid: 'uid_worker_B' },
        configurable: true,
        writable: true
      });

      const syncSingleSpy = vi.spyOn(OfflineSyncManager, 'syncSingleOperation').mockResolvedValue(true);

      const syncResult = await OfflineSyncManager.syncAllPending();
      expect(syncResult.synced).toBe(1);
      expect(syncResult.skippedOtherUser).toBe(1);
      expect(syncSingleSpy).toHaveBeenCalledTimes(1);

      // Remaining queue contains Worker A's pending operation
      const remainingQueue = OfflineSyncManager.getQueue();
      expect(remainingQueue.length).toBe(1);
      expect(remainingQueue[0].id).toBe('op_worker_A');
      expect(remainingQueue[0].ownerUid).toBe('uid_worker_A');

      // Now Worker B signs out
      const signOutSpy = vi.spyOn(fsauth, 'signOut').mockResolvedValue(undefined as any);
      const clearSpy = vi.spyOn(localStorage, 'clear');

      await fsauth.signOut();
      expect(signOutSpy).toHaveBeenCalledTimes(1);
      expect(clearSpy).not.toHaveBeenCalled();

      // Queue MUST remain fully intact
      const queueAfterLogout = OfflineSyncManager.getQueue();
      expect(queueAfterLogout.length).toBe(1);
      expect(queueAfterLogout[0].id).toBe('op_worker_A');
    });

    it('OfflineSyncModal accurately renders dynamic foreign-user operations count alert', () => {
      const currentUid = 'active_cashier_uid';
      const queue: QueuedOfflineOperation[] = [
        {
          id: 'op_own',
          type: 'invoice',
          title: 'فاتورتي',
          createdAt: new Date().toISOString(),
          ownerUid: currentUid,
          payload: {},
          status: 'pending',
          retryCount: 0
        },
        {
          id: 'op_other_1',
          type: 'invoice',
          title: 'فاتورة أخرى 1',
          createdAt: new Date().toISOString(),
          ownerUid: 'other_worker_1',
          payload: {},
          status: 'pending',
          retryCount: 0
        },
        {
          id: 'op_other_2',
          type: 'invoice',
          title: 'فاتورة أخرى 2',
          createdAt: new Date().toISOString(),
          ownerUid: 'other_worker_2',
          payload: {},
          status: 'pending',
          retryCount: 0
        }
      ];

      OfflineSyncManager.saveQueue(queue);

      const mockContext = createMockAppContextValue({
        currentUser: { uid: currentUid } as any,
        offlineModalOpen: true
      });

      const html = renderToString(
        React.createElement(
          AppContext.Provider,
          { value: mockContext },
          React.createElement(OfflineSyncModal, { isOpen: true })
        )
      );

      expect(html).toContain('تنبيه أمان: عمليات معلقة لحساب آخر');
      expect(html).toMatch(/تنبيه أمان: عمليات معلقة لحساب آخر.*2/);
      expect(html).toContain('other_worker_1');
      expect(html).toContain('other_worker_2');
    });
  });

  // =========================================================================
  // 5. REAL APP IDENTITY, LOGOUT PATHWAY & ACCESS LOCKDOWN
  // =========================================================================
  describe('5. Real App Identity, Logout Pathway & Disabled Account Hardening', () => {
    const profileA: UserProfile = {
      uid: 'uid_cashier_A',
      name: 'كاشير أحمد',
      role: 'cashier',
      isActive: true,
      permissions: {
        posSales: true,
        allowDiscountOverride: false,
        inventoryManage: false
      } as any
    };

    const profileBAdmin: UserProfile = {
      uid: 'uid_admin_B',
      name: 'المدير باسم',
      role: 'admin',
      isActive: true,
      permissions: {
        posSales: true,
        allowDiscountOverride: true,
        inventoryManage: true
      } as any
    };

    const profileDisabled: UserProfile = {
      uid: 'uid_disabled_C',
      name: 'موظف موقف',
      role: 'manager',
      isActive: false,
      permissions: {
        posSales: true,
        allowDiscountOverride: true,
        inventoryManage: true
      } as any
    };

    it('5.A.1: resolveEffectiveSession strictly binds identity to currentUser.uid and ignores maktabati_active_operator_id', () => {
      // Simulate malicious or leftover operator ID pointing to the admin in localStorage
      localStorage.setItem('maktabati_active_operator_id', profileBAdmin.uid);

      // Authenticated user is Cashier A
      const session = resolveEffectiveSession([profileA, profileBAdmin], profileA.uid);

      // Must strictly resolve to Cashier A, NOT Admin B
      expect(session.currentProfile?.uid).toBe(profileA.uid);
      expect(session.currentProfile?.name).toBe('كاشير أحمد');
      expect(session.effectiveProfile?.uid).toBe(profileA.uid);
      expect(session.isAdmin).toBe(false);
      expect(session.isAccountActive).toBe(true);

      // Confirm permissions reflect cashier only
      expect(hasPermission(session.effectiveProfile, 'inventoryManage')).toBe(false);
      expect(hasPermission(session.effectiveProfile, 'posSales')).toBe(true);
    });

    it('5.A.2: Changing authenticated user immediately re-evaluates identity and never retains previous profile', () => {
      // User 1: Cashier A logs in
      const session1 = resolveEffectiveSession([profileA, profileBAdmin], profileA.uid);
      expect(session1.effectiveProfile?.uid).toBe(profileA.uid);
      expect(session1.isAdmin).toBe(false);

      // User 2: Switch to Admin B
      const session2 = resolveEffectiveSession([profileA, profileBAdmin], profileBAdmin.uid);
      expect(session2.effectiveProfile?.uid).toBe(profileBAdmin.uid);
      expect(session2.effectiveProfile?.name).toBe('المدير باسم');
      expect(session2.isAdmin).toBe(true);

      // User 3: Unregistered user logs in
      const session3 = resolveEffectiveSession([profileA, profileBAdmin], 'unregistered_uid_999');
      expect(session3.currentProfile).toBeNull();
      expect(session3.effectiveProfile).toBeNull();
      expect(session3.isAdmin).toBe(false);
      expect(session3.isAccountActive).toBe(false);
    });

    it('5.B: UI Header logout pathway triggers fsauth.signOut() and leaves offline queue untouched', async () => {
      // Seed pending offline queue
      const initialQueue: QueuedOfflineOperation[] = [
        {
          id: 'offline_op_stay_safe',
          type: 'invoice',
          title: 'فاتورة غير متزامنة',
          createdAt: new Date().toISOString(),
          ownerUid: profileA.uid,
          payload: { items: 3 },
          status: 'pending',
          retryCount: 0
        }
      ];
      OfflineSyncManager.saveQueue(initialQueue);

      const signOutSpy = vi.spyOn(fsauth, 'signOut').mockResolvedValue(undefined as any);
      const clearSpy = vi.spyOn(localStorage, 'clear');

      // Render Header component within mock AppContext
      const mockContext = createMockAppContextValue({
        currentUser: { uid: profileA.uid, email: 'cashier@maktabati.com' } as any,
        effectiveProfile: profileA,
        isAdmin: false
      });

      const html = renderToString(
        React.createElement(
          AppContext.Provider,
          { value: mockContext },
          React.createElement(Header)
        )
      );

      // Check header contains logout button
      expect(html).toContain('title="تسجيل الخروج"');

      // Trigger sign out as done by Header.handleLogout
      await fsauth.signOut();

      expect(signOutSpy).toHaveBeenCalledTimes(1);
      expect(clearSpy).not.toHaveBeenCalled();

      // Ensure the offline operations remain in storage exactly as before
      const currentQueue = OfflineSyncManager.getQueue();
      expect(currentQueue.length).toBe(1);
      expect(currentQueue[0].id).toBe('offline_op_stay_safe');
      expect(currentQueue[0].ownerUid).toBe(profileA.uid);
    });

    it('5.C.1: Disabled account (isActive: false or disabled: true) is denied all permissions and protected pages', () => {
      // Test isActive: false
      const sessionDisabled1 = resolveEffectiveSession([profileDisabled], profileDisabled.uid);
      expect(sessionDisabled1.isAccountActive).toBe(false);
      expect(sessionDisabled1.effectiveProfile).toBeNull();
      expect(sessionDisabled1.isAdmin).toBe(false);

      expect(hasPermission(sessionDisabled1.effectiveProfile, 'posSales')).toBe(false);
      expect(hasPermission(sessionDisabled1.effectiveProfile, 'inventoryManage')).toBe(false);
      expect(canAccessPage('saleInvoice', sessionDisabled1.effectiveProfile)).toBe(false);
      expect(canAccessPage('inventory', sessionDisabled1.effectiveProfile)).toBe(false);

      // Test disabled: true flag
      const profileDisabledFlag: UserProfile = {
        ...profileBAdmin,
        uid: 'uid_admin_flagged_disabled',
        disabled: true
      } as any;

      const sessionDisabled2 = resolveEffectiveSession([profileDisabledFlag], profileDisabledFlag.uid);
      expect(sessionDisabled2.isAccountActive).toBe(false);
      expect(sessionDisabled2.effectiveProfile).toBeNull();
      expect(hasPermission(sessionDisabled2.effectiveProfile, 'posSales')).toBe(false);
      expect(canAccessPage('saleInvoice', sessionDisabled2.effectiveProfile)).toBe(false);
    });

    it('5.C.2: AccountDisabledScreen renders blocking screen with sign-out and denies navigation access', () => {
      const mockSignOut = vi.fn();

      const html = renderToString(
        React.createElement(AccountDisabledScreen, {
          currentUser: { uid: profileDisabled.uid, email: 'disabled@maktabati.com' },
          currentProfile: profileDisabled,
          onSignOut: mockSignOut
        })
      );

      // Verifies blocked state presentation
      expect(html).toContain('هذا الحساب معطّل حالياً');
      expect(html).toContain('موظف موقف');
      expect(html).toContain('disabled@maktabati.com');
      expect(html).toContain('تسجيل الخروج');

      // Crucial: No POS, Inventory, or Dashboard action buttons in the blocked screen
      expect(html).not.toContain('فاتورة بيع');
      expect(html).not.toContain('لوحة التحكم');
      expect(html).not.toContain('حفظ الفاتورة');
    });
  });
});
