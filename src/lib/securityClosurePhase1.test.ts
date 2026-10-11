import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_CASHIER_PERMISSIONS,
  DEFAULT_STOCKKEEPER_PERMISSIONS,
  hasPermission
} from './permissions';
import {
  hashPin,
  verifyPin,
  generateEmployeeSalt,
  getPinLockoutStatus,
  resetPinAttempts,
  hashPinLegacy
} from './pinSecurity';
import {
  computeRecordHash,
  computeLegacyRecordHash,
  verifyAuditChain
} from './auditEngine';
import { UserProfile, AuditLog } from '../types';

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

describe('PHASE 1.1 — SECURITY CLOSURE TEST SUITE', () => {

  // =========================================================
  // 1. PERMISSION MODEL TESTS (Separation of posSales vs editHistoricalSales)
  // =========================================================
  describe('1. Permission Model: Invoices & Sensitive Financial Access', () => {
    const cashierProfile: UserProfile = {
      uid: 'u_cashier',
      name: 'Cashier Test',
      role: 'cashier',
      permissions: DEFAULT_CASHIER_PERMISSIONS,
      isActive: true
    };

    const managerProfile: UserProfile = {
      uid: 'u_manager',
      name: 'Manager Test',
      role: 'manager',
      permissions: DEFAULT_MANAGER_PERMISSIONS,
      isActive: true
    };

    const adminProfile: UserProfile = {
      uid: 'u_admin',
      name: 'Admin Test',
      role: 'admin',
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      isActive: true
    };

    const stockkeeperProfile: UserProfile = {
      uid: 'u_stockkeeper',
      name: 'Stockkeeper Test',
      role: 'stockkeeper',
      permissions: DEFAULT_STOCKKEEPER_PERMISSIONS,
      isActive: true
    };

    it('Cashier CAN create new sales invoices (posSales = true)', () => {
      expect(hasPermission(cashierProfile, 'posSales')).toBe(true);
    });

    it('Cashier CANNOT edit historical sales invoices (editHistoricalSales = false)', () => {
      expect(hasPermission(cashierProfile, 'editHistoricalSales')).toBe(false);
    });

    it('Cashier CANNOT delete invoices (deleteInvoices = false)', () => {
      expect(hasPermission(cashierProfile, 'deleteInvoices')).toBe(false);
    });

    it('Cashier CANNOT view cost price or profit margins', () => {
      expect(hasPermission(cashierProfile, 'viewCostPrice')).toBe(false);
      expect(hasPermission(cashierProfile, 'viewProfits')).toBe(false);
    });

    it('Admin CAN create, edit historical invoices, delete invoices, and view all costs & profits', () => {
      expect(hasPermission(adminProfile, 'posSales')).toBe(true);
      expect(hasPermission(adminProfile, 'editHistoricalSales')).toBe(true);
      expect(hasPermission(adminProfile, 'deleteInvoices')).toBe(true);
      expect(hasPermission(adminProfile, 'viewCostPrice')).toBe(true);
      expect(hasPermission(adminProfile, 'viewProfits')).toBe(true);
    });

    it('Manager has posSales but CANNOT edit historical sales or delete invoices by default', () => {
      expect(hasPermission(managerProfile, 'posSales')).toBe(true);
      expect(hasPermission(managerProfile, 'editHistoricalSales')).toBe(false);
      expect(hasPermission(managerProfile, 'deleteInvoices')).toBe(false);
      expect(hasPermission(managerProfile, 'viewCostPrice')).toBe(true);
      expect(hasPermission(managerProfile, 'viewProfits')).toBe(false); // Hidden by default for branch managers
    });

    it('Stockkeeper CANNOT create sales or edit sales, but can manage inventory', () => {
      expect(hasPermission(stockkeeperProfile, 'posSales')).toBe(false);
      expect(hasPermission(stockkeeperProfile, 'editHistoricalSales')).toBe(false);
      expect(hasPermission(stockkeeperProfile, 'inventoryManage')).toBe(true);
      expect(hasPermission(stockkeeperProfile, 'viewCostPrice')).toBe(false);
      expect(hasPermission(stockkeeperProfile, 'viewProfits')).toBe(false);
    });

    it('Fail-closed: inactive or undefined profile is denied all permissions', () => {
      expect(hasPermission(null, 'posSales')).toBe(false);
      expect(hasPermission(undefined, 'editHistoricalSales')).toBe(false);
      expect(hasPermission({ ...cashierProfile, isActive: false }, 'posSales')).toBe(false);
    });
  });

  // =========================================================
  // 2. PIN SECURITY & HARDENING TESTS (PBKDF2, Salt, Lockout, Migration)
  // =========================================================
  describe('2. PIN Security Engine: PBKDF2, Salting, Lockout & In-flight Migration', () => {
    const testUid = 'test_emp_001';

    beforeEach(() => {
      localStorage.clear();
      resetPinAttempts(testUid);
    });

    it('Generates unique salts per employee', () => {
      const salt1 = generateEmployeeSalt('user_A');
      const salt2 = generateEmployeeSalt('user_B');
      expect(salt1).not.toBe(salt2);
      expect(salt1.length).toBeGreaterThan(16);
    });

    it('Hashes PIN using PBKDF2-HMAC-SHA256 format with embedded unique salt', async () => {
      const pin = '482910';
      const hash = await hashPin(pin);
      expect(hash.startsWith('pbkdf2:v1:')).toBe(true);
      const parts = hash.split(':');
      expect(parts.length).toBe(4);
      expect(parts[2].length).toBeGreaterThan(10); // Unique salt
      expect(parts[3].length).toBe(64); // 256-bit hex
    });

    it('Verifies correct PIN and rejects incorrect PIN with PBKDF2', async () => {
      const pin = '5884';
      const hash = await hashPin(pin);
      const profile: UserProfile = {
        uid: testUid,
        name: 'Test Cashier',
        role: 'cashier',
        pinHash: hash
      };

      const valid = await verifyPin('5884', profile);
      expect(valid).toBe(true);

      const invalid = await verifyPin('9999', profile);
      expect(invalid).toBe(false);
    });

    it('Backward compatibility: verifies legacy SHA-256 PIN and automatically migrates to PBKDF2 in-flight', async () => {
      const pin = '123456';
      const legacyHash = await hashPinLegacy(pin);
      expect(legacyHash.startsWith('pbkdf2:')).toBe(false);

      const profile: UserProfile = {
        uid: testUid,
        name: 'Legacy Cashier',
        role: 'cashier',
        pinHash: legacyHash
      };

      const valid = await verifyPin('123456', profile);
      expect(valid).toBe(true);

      // In-flight migration happened:
      expect(profile.pinHash?.startsWith('pbkdf2:v1:')).toBe(true);
      expect(profile.pinSalt).toBeDefined();

      // Subsequent check works with the new PBKDF2 hash
      const validSecondTime = await verifyPin('123456', profile);
      expect(validSecondTime).toBe(true);
    });

    it('Backward compatibility: verifies legacy plaintext pinCode and migrates to PBKDF2 in-flight', async () => {
      const profile: UserProfile = {
        uid: testUid,
        name: 'Plaintext Cashier',
        role: 'cashier',
        pinCode: '778899'
      };

      const valid = await verifyPin('778899', profile);
      expect(valid).toBe(true);

      // In-flight migration happened:
      expect(profile.pinHash?.startsWith('pbkdf2:v1:')).toBe(true);
      expect(profile.pinCode).toBeUndefined(); // Plaintext eradicated
    });

    it('Local rate limiting: 5 consecutive failed attempts trigger a 5-minute lockout', async () => {
      const hash = await hashPin('112233');
      const profile: UserProfile = {
        uid: testUid,
        name: 'Rate Limit Cashier',
        role: 'cashier',
        pinHash: hash
      };

      // 4 wrong attempts: not locked yet
      for (let i = 0; i < 4; i++) {
        const res = await verifyPin('000000', profile);
        expect(res).toBe(false);
        const status = getPinLockoutStatus(testUid);
        expect(status.isLocked).toBe(false);
        expect(status.failedAttempts).toBe(i + 1);
      }

      // 5th wrong attempt: triggers lockout
      const fifthAttempt = await verifyPin('000000', profile);
      expect(fifthAttempt).toBe(false);
      const lockedStatus = getPinLockoutStatus(testUid);
      expect(lockedStatus.isLocked).toBe(true);
      expect(lockedStatus.remainingSeconds).toBeGreaterThan(250);

      // During lockout: even the correct PIN is rejected immediately!
      const attemptDuringLockout = await verifyPin('112233', profile);
      expect(attemptDuringLockout).toBe(false);
    });
  });

  // =========================================================
  // 3. AUDIT ENGINE TESTS (SHA-256, Tamper Detection, Concurrency Safety)
  // =========================================================
  describe('3. Audit Engine: SHA-256 & Concurrency-Safe Chaining', () => {
    it('Computes valid cryptographic SHA-256 hash for audit record', async () => {
      const payload = {
        action: 'تعديل سعر',
        entity: 'products',
        details: { productId: 'p1', oldPrice: 10, newPrice: 15 },
        actorUid: 'u_admin',
        date: '2026-09-27',
        createdAt: '2026-09-27T10:00:00.000Z',
        sessionId: 'sess_1',
        localSequence: 1
      };

      const hash = await computeRecordHash(payload, 'GENESIS_00000000');
      expect(hash.startsWith('sha256_')).toBe(true);
      expect(hash.length).toBe(71); // 'sha256_' (7 chars) + 64 hex chars = 71 chars
    });

    it('Detects content tampering in audit records', async () => {
      const log1: AuditLog = {
        id: 'log_1',
        action: 'بيع',
        entity: 'invoices',
        details: { total: 100 },
        actorUid: 'cashier_1',
        date: '2026-09-27',
        createdAt: '2026-09-27T10:00:00.000Z',
        prevHash: 'GENESIS_00000000',
        sessionId: 'sess_1',
        localSequence: 1
      };
      log1.hash = await computeRecordHash(log1, log1.prevHash);

      // Verify authentic log
      const resClean = await verifyAuditChain([log1]);
      expect(resClean.valid).toBe(true);
      expect(resClean.tamperedCount).toBe(0);

      // Tamper with the details
      const tamperedLog: AuditLog = {
        ...log1,
        details: { total: 500 } // Tampered amount!
      };
      const resTampered = await verifyAuditChain([tamperedLog]);
      expect(resTampered.valid).toBe(false);
      expect(resTampered.tamperedCount).toBe(1);
    });

    it('Concurrency-safe: does not produce false positives between concurrent sessions/devices', async () => {
      // Device A session
      const logA1: AuditLog = {
        id: 'log_A1',
        action: 'sale',
        entity: 'invoices',
        details: { dev: 'A' },
        actorUid: 'cashier_A',
        date: '2026-09-27',
        createdAt: '2026-09-27T10:00:01.000Z',
        prevHash: 'GENESIS_00000000',
        sessionId: 'session_Device_A',
        localSequence: 1
      };
      logA1.hash = await computeRecordHash(logA1, logA1.prevHash);

      const logA2: AuditLog = {
        id: 'log_A2',
        action: 'sale',
        entity: 'invoices',
        details: { dev: 'A' },
        actorUid: 'cashier_A',
        date: '2026-09-27',
        createdAt: '2026-09-27T10:00:03.000Z',
        prevHash: logA1.hash,
        sessionId: 'session_Device_A',
        localSequence: 2
      };
      logA2.hash = await computeRecordHash(logA2, logA2.prevHash);

      // Concurrent Device B session writing at the exact same seconds
      const logB1: AuditLog = {
        id: 'log_B1',
        action: 'purchase',
        entity: 'purchases',
        details: { dev: 'B' },
        actorUid: 'manager_B',
        date: '2026-09-27',
        createdAt: '2026-09-27T10:00:02.000Z', // In between A1 and A2!
        prevHash: 'GENESIS_00000000',
        sessionId: 'session_Device_B',
        localSequence: 1
      };
      logB1.hash = await computeRecordHash(logB1, logB1.prevHash);

      // Both devices write to the same Firestore collection
      const combinedLogs = [logA1, logB1, logA2];

      // Verification must recognize both session streams and NOT flag a false positive!
      const verifyResult = await verifyAuditChain(combinedLogs);
      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.tamperedCount).toBe(0);
    });

    it('Backward compatibility: verifies historical records with legacy hash_ algorithm', async () => {
      const legacyLog: AuditLog = {
        id: 'leg_1',
        action: 'تعديل صنف',
        entity: 'products',
        details: { name: 'قلم جاف' },
        actorUid: 'u_admin',
        date: '2026-08-01',
        createdAt: '2026-08-01T12:00:00.000Z',
        prevHash: 'GENESIS_BLOCK'
      };
      legacyLog.hash = computeLegacyRecordHash(legacyLog, legacyLog.prevHash);
      expect(legacyLog.hash.startsWith('hash_')).toBe(true);

      const res = await verifyAuditChain([legacyLog]);
      expect(res.valid).toBe(true);
      expect(res.tamperedCount).toBe(0);
    });
  });
});
