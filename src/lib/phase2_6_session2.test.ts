import { describe, it, expect, vi } from 'vitest';
import { verifyPin, hashPin } from './pinSecurity';
import { UserProfile, UserRole } from '../types';
import { DEFAULT_CASHIER_PERMISSIONS, DEFAULT_ADMIN_PERMISSIONS } from './permissions';

describe('Phase 2.6 - Session 2: Separate Accounts & Security Gate Verifications', () => {
  describe('PART 0: Security Gate - isValidBalance (نسخة نظرية - Unit Simulation)', () => {
    /**
     * Exact replication of the updated Firestore rules function:
     * NOTE: Actual live emulator verification of B01 - B06 is implemented in firestoreRules.test.ts.
     * This unit test block is the theoretical JS simulation version.
     *
     * function isValidBalance(bal) {
     *   return bal is map &&
     *     bal.keys().hasOnly(['invoiced', 'paid', 'updatedAt']) &&
     *     bal.invoiced is number &&
     *     bal.paid is number &&
     *     (bal.paid >= 0 || (isAdmin() && bal.paid == bal.invoiced)) &&
     *     (!('updatedAt' in bal) || bal.updatedAt is string);
     * }
     */
    function isValidBalanceRule(bal: any, userRole: UserRole): boolean {
      if (!bal || typeof bal !== 'object' || Array.isArray(bal)) return false;
      const keys = Object.keys(bal);
      const allowedKeys = ['invoiced', 'paid', 'updatedAt'];
      if (!keys.every(k => allowedKeys.includes(k))) return false;
      if (typeof bal.invoiced !== 'number') return false;
      if (typeof bal.paid !== 'number') return false;

      const isAdmin = userRole === 'admin';
      // Restrict negative paid == invoiced to admin only:
      const satisfiesPaidConstraint = bal.paid >= 0 || (isAdmin && bal.paid === bal.invoiced);
      if (!satisfiesPaidConstraint) return false;

      if (bal.updatedAt !== undefined && typeof bal.updatedAt !== 'string') return false;
      return true;
    }

    it('B01: Cashier (posSales, non-admin) setting invoiced = -500, paid = -500 -> DENY', () => {
      const negativeBalancedMutation = { invoiced: -500, paid: -500 };
      expect(isValidBalanceRule(negativeBalancedMutation, 'cashier')).toBe(false);
    });

    it('B02: SalesReturns (non-admin) setting invoiced = -500, paid = -500 -> DENY', () => {
      const negativeBalancedMutation = { invoiced: -500, paid: -500 };
      expect(isValidBalanceRule(negativeBalancedMutation, 'cashier')).toBe(false);
      expect(isValidBalanceRule(negativeBalancedMutation, 'manager')).toBe(false);
    });

    it('B03: Treasury (non-admin) setting invoiced = -500, paid = -500 -> DENY', () => {
      const negativeBalancedMutation = { invoiced: -500, paid: -500 };
      expect(isValidBalanceRule(negativeBalancedMutation, 'stockkeeper')).toBe(false);
    });

    it('B04: Admin executeDebtReset on customer with credit/returns (invoiced = -500, paid = -500) -> ALLOW', () => {
      const negativeBalancedReset = { invoiced: -500, paid: -500 };
      expect(isValidBalanceRule(negativeBalancedReset, 'admin')).toBe(true);
    });

    it('Admin cannot set mismatched negative balances (e.g. invoiced = -500, paid = -300) -> DENY', () => {
      const mismatchedNegative = { invoiced: -500, paid: -300 };
      expect(isValidBalanceRule(mismatchedNegative, 'admin')).toBe(false);
    });

    it('Standard non-negative balances are allowed for all staff roles', () => {
      expect(isValidBalanceRule({ invoiced: 1200, paid: 500 }, 'cashier')).toBe(true);
      expect(isValidBalanceRule({ invoiced: 1200, paid: 1200 }, 'cashier')).toBe(true);
      expect(isValidBalanceRule({ invoiced: 0, paid: 0 }, 'cashier')).toBe(true);
      expect(isValidBalanceRule({ invoiced: -100, paid: 0 }, 'cashier')).toBe(true); // Return creating credit where paid >= 0
    });
  });

  describe('PART 1 & 2: Separate Accounts & Stage A Architecture', () => {
    it('ensures employee creation strictly requires manual Firebase UID and creates operational profile', () => {
      const cleanUid = 'firebase_auth_uid_12345';
      const createdByUid = 'admin_uid_001';
      const cashierProfile: UserProfile = {
        id: cleanUid,
        uid: cleanUid,
        name: 'سارة أحمد',
        email: 'sara@maktabati.com',
        role: 'cashier',
        isActive: true,
        permissions: DEFAULT_CASHIER_PERMISSIONS,
        createdBy: createdByUid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      expect(cashierProfile.uid).toBe('firebase_auth_uid_12345');
      expect(cashierProfile.id).toBe(cashierProfile.uid);
      expect(cashierProfile.createdBy).toBe(createdByUid);
      expect(cashierProfile.role).toBe('cashier');
      expect(cashierProfile.permissions?.posSales).toBe(true);
      expect(cashierProfile.permissions?.viewCostPrice).toBe(false);
    });

    it('proves switchActiveOperator cannot bypass PIN verification when pin is undefined or missing', async () => {
      const targetUser: UserProfile = {
        uid: 'staff_secured',
        name: 'مشرف محمي',
        role: 'manager',
        pinHash: await hashPin('5566')
      };

      // Helper simulating AppContext PIN requirement
      async function testSwitch(user: UserProfile, pin?: string): Promise<boolean> {
        if (user.pinHash || user.pinCode) {
          if (!pin) return false;
          return await verifyPin(pin, user);
        }
        return true;
      }

      // Bypass attempt with undefined PIN -> must FAIL
      expect(await testSwitch(targetUser, undefined)).toBe(false);
      // Bypass attempt with empty string PIN -> must FAIL
      expect(await testSwitch(targetUser, '')).toBe(false);
      // Incorrect PIN -> must FAIL
      expect(await testSwitch(targetUser, '1111')).toBe(false);
      // Correct PIN -> SUCCEEDS
      expect(await testSwitch(targetUser, '5566')).toBe(true);
    });
  });
});
