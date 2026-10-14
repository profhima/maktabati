import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleProfileDocumentSnapshot,
  ProfileSnapshotHandlerOptions
} from './AppContext';
import { UserProfile } from '../types';

describe('AppContext Profile Snapshot Verification (Cache vs Server & 8s Timeout)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // Case 1: غياب الملف من الكاش (Cache miss, waiting for server)
  // =========================================================================
  it('Case 1: when snap.exists is false and snap.metadata.fromCache is true, stays in loading and DOES NOT transition to not_found', () => {
    let currentTimer: any = null;
    const setTimer = (t: any) => {
      currentTimer = t;
    };

    const onVerified = vi.fn();
    const onNotFound = vi.fn();
    const onError = vi.fn();
    const onLoading = vi.fn();

    const options: ProfileSnapshotHandlerOptions = {
      onVerified,
      onNotFound,
      onError,
      onLoading,
      timeoutMs: 8000
    };

    // Cache-only snapshot indicates missing in cache
    const cacheMissSnap = {
      exists: false,
      metadata: { fromCache: true }
    };

    handleProfileDocumentSnapshot(
      cacheMissSnap,
      currentTimer,
      setTimer,
      options,
      () => false
    );

    // 1. Must NOT transition to not_found
    expect(onNotFound).not.toHaveBeenCalled();
    // 2. Must stay in loading state waiting for authoritative server response
    expect(onLoading).toHaveBeenCalledTimes(1);
    // 3. Must not report error immediately
    expect(onError).not.toHaveBeenCalled();
    // 4. Must start the 8-second timer
    expect(currentTimer).not.toBeNull();
  });

  // =========================================================================
  // Case 2: تأخر رد الخادم (Server response delayed > 8 seconds)
  // =========================================================================
  it('Case 2: if server response does not arrive within 8 seconds, transitions to error with connection and retry guidance', () => {
    let currentTimer: any = null;
    const setTimer = (t: any) => {
      currentTimer = t;
    };

    const onVerified = vi.fn();
    const onNotFound = vi.fn();
    const onError = vi.fn();
    const onLoading = vi.fn();

    const options: ProfileSnapshotHandlerOptions = {
      onVerified,
      onNotFound,
      onError,
      onLoading,
      timeoutMs: 8000
    };

    // Initial cache miss
    const cacheMissSnap = {
      exists: false,
      metadata: { fromCache: true }
    };

    handleProfileDocumentSnapshot(
      cacheMissSnap,
      currentTimer,
      setTimer,
      options,
      () => false
    );

    // Fast-forward by 7999ms: still waiting
    vi.advanceTimersByTime(7999);
    expect(onError).not.toHaveBeenCalled();
    expect(onNotFound).not.toHaveBeenCalled();

    // Advance 1ms more (reaching 8000ms): timer fires
    vi.advanceTimersByTime(1);
    expect(onError).toHaveBeenCalledTimes(1);
    // Error message must guide user to check internet and retry
    expect(onError.mock.calls[0][0]).toContain('تعذر التحقق من الصلاحيات من الخادم');
    expect(onError.mock.calls[0][0]).toContain('التحقق من اتصال الإنترنت');
    expect(onError.mock.calls[0][0]).toContain('إعادة المحاولة');
    // Still must NOT claim the profile does not exist
    expect(onNotFound).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Case 3: تأكيد الخادم أن الملف غير موجود (Authoritative server not_found)
  // =========================================================================
  it('Case 3: transitions to not_found ONLY when snap.exists is false and snap.metadata.fromCache is false', () => {
    let currentTimer: any = null;
    const setTimer = (t: any) => {
      currentTimer = t;
    };

    const onVerified = vi.fn();
    const onNotFound = vi.fn();
    const onError = vi.fn();
    const onLoading = vi.fn();

    const options: ProfileSnapshotHandlerOptions = {
      onVerified,
      onNotFound,
      onError,
      onLoading,
      timeoutMs: 8000
    };

    // First, cache miss occurred, timer started
    handleProfileDocumentSnapshot(
      { exists: false, metadata: { fromCache: true } },
      currentTimer,
      setTimer,
      options,
      () => false
    );
    expect(currentTimer).not.toBeNull();

    // Now, authoritative server response arrives (fromCache: false) confirming document is absent
    const serverMissingSnap = {
      exists: false,
      metadata: { fromCache: false }
    };

    handleProfileDocumentSnapshot(
      serverMissingSnap,
      currentTimer,
      setTimer,
      options,
      () => false
    );

    // 1. Must clear the timeout timer
    expect(currentTimer).toBeNull();
    // 2. Must transition to not_found
    expect(onNotFound).toHaveBeenCalledTimes(1);
    // 3. Must not report error
    expect(onError).not.toHaveBeenCalled();

    // Advancing past 8s should not trigger any late error
    vi.advanceTimersByTime(10000);
    expect(onError).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Case 4: وصول رد الخادم المؤكد بوجود الملف قبل انتهاء المهلة
  // =========================================================================
  it('Case 4: when server confirms document exists before 8s, clears timer and sets verified', () => {
    let currentTimer: any = null;
    const setTimer = (t: any) => {
      currentTimer = t;
    };

    const onVerified = vi.fn();
    const onNotFound = vi.fn();
    const onError = vi.fn();

    const options: ProfileSnapshotHandlerOptions = {
      onVerified,
      onNotFound,
      onError,
      timeoutMs: 8000
    };

    // Step A: cache miss
    handleProfileDocumentSnapshot(
      { exists: false, metadata: { fromCache: true } },
      currentTimer,
      setTimer,
      options,
      () => false
    );
    expect(currentTimer).not.toBeNull();

    // Advance 3 seconds
    vi.advanceTimersByTime(3000);

    // Step B: server confirms document exists
    const validProfile: UserProfile = {
      uid: 'user_123',
      name: 'أحمد المحاسب',
      role: 'cashier',
      isActive: true
    };

    handleProfileDocumentSnapshot(
      {
        exists: true,
        id: 'user_123',
        data: () => validProfile,
        metadata: { fromCache: false }
      },
      currentTimer,
      setTimer,
      options,
      () => false
    );

    // Timer cleared
    expect(currentTimer).toBeNull();
    // Verified called with profile data
    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledWith(expect.objectContaining({
      uid: 'user_123',
      name: 'أحمد المحاسب',
      role: 'cashier'
    }));
    expect(onNotFound).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    // Advancing past 8s should not trigger any late error
    vi.advanceTimersByTime(10000);
    expect(onError).not.toHaveBeenCalled();
  });

  // =========================================================================
  // Case 5: تنظيف المؤقت ومنع أي تحديث لحالة المكوّن بعد إلغاء الاشتراك
  // =========================================================================
  it('Case 5: cleans up timer and prevents any state update after unsubscription/cleanup', () => {
    let currentTimer: any = null;
    const setTimer = (t: any) => {
      currentTimer = t;
    };

    const onVerified = vi.fn();
    const onNotFound = vi.fn();
    const onError = vi.fn();
    const onLoading = vi.fn();

    let isCleanedUp = false;

    const options: ProfileSnapshotHandlerOptions = {
      onVerified,
      onNotFound,
      onError,
      onLoading,
      timeoutMs: 8000
    };

    // Cache miss starts timer
    handleProfileDocumentSnapshot(
      { exists: false, metadata: { fromCache: true } },
      currentTimer,
      setTimer,
      options,
      () => isCleanedUp
    );
    expect(currentTimer).not.toBeNull();

    // Simulate unsubscription/cleanup
    isCleanedUp = true;
    clearTimeout(currentTimer);
    setTimer(null);

    // Advance timers
    vi.advanceTimersByTime(10000);
    expect(onError).not.toHaveBeenCalled();

    // Late snapshot arriving after unsubscription
    handleProfileDocumentSnapshot(
      { exists: true, id: 'user_late', data: () => ({ name: 'late' }), metadata: { fromCache: false } },
      currentTimer,
      setTimer,
      options,
      () => isCleanedUp
    );

    // No callbacks called after isCleanedUp
    expect(onVerified).not.toHaveBeenCalled();
    expect(onNotFound).not.toHaveBeenCalled();
  });
});
