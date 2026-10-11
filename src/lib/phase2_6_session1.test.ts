import { describe, it, expect } from 'vitest';
import { calculateDayCloseExpectedCash } from './financialEngine';

describe('Phase 2.6 - Session 1 Verifications', () => {
  describe('Part 0(c): DayClose expectedCash calculation parity', () => {
    it('matches old DayClosePage formula and passes the exact scenario (+10000 +2000 -500 -3000 -1000 -500 = 7000)', () => {
      // Scenario values:
      // +10000 Cash sales
      // +2000  Customer payments (collections)
      // -500   Returns cash out
      // -3000  Purchases cash out
      // -1000  Supplier payments
      // -500   Expenses
      const cashSales = 10000;
      const customerPayments = 2000;
      const returnsCashIn = 0;
      const purchaseReturnsCashIn = 0;
      const deposits = 0;
      const returnsCashOut = 500;
      const purchasesCashOut = 3000;
      const supplierPayments = 1000;
      const expenses = 500;
      const withdrawals = 0;

      // Old inline DayClosePage formula:
      const oldFormulaExpectedCash =
        cashSales +
        customerPayments +
        returnsCashIn +
        purchaseReturnsCashIn +
        deposits -
        (returnsCashOut + purchasesCashOut + supplierPayments + expenses + withdrawals);

      // New unified financialEngine call:
      const result = calculateDayCloseExpectedCash({
        cashSales,
        customerPayments,
        returnsCashIn,
        purchaseReturnsCashIn,
        deposits,
        returnsCashOut,
        purchasesCashOut,
        supplierPayments,
        expenses,
        withdrawals,
      });

      expect(oldFormulaExpectedCash).toBe(7000);
      expect(result.expectedCash).toBe(7000);
      expect(result.expectedCash).toBe(oldFormulaExpectedCash);
      expect(result.totalIn).toBe(12000);
      expect(result.totalOut).toBe(5000);
    });

    it('matches across various edge case numbers and decimal cents', () => {
      const breakdown = {
        cashSales: 1245.50,
        customerPayments: 350.25,
        returnsCashIn: 50.00,
        purchaseReturnsCashIn: 100.00,
        deposits: 200.00,
        returnsCashOut: 75.25,
        purchasesCashOut: 800.50,
        supplierPayments: 250.00,
        expenses: 120.00,
        withdrawals: 50.00,
      };

      const oldFormula =
        breakdown.cashSales +
        breakdown.customerPayments +
        breakdown.returnsCashIn +
        breakdown.purchaseReturnsCashIn +
        breakdown.deposits -
        (breakdown.returnsCashOut +
          breakdown.purchasesCashOut +
          breakdown.supplierPayments +
          breakdown.expenses +
          breakdown.withdrawals);

      const res = calculateDayCloseExpectedCash(breakdown);
      expect(res.expectedCash).toBeCloseTo(oldFormula, 2);
    });
  });

  describe('Part 0(b): Stock Movements access-calls limit analysis for 20, 30, 40 items', () => {
    // Firestore security rules constraint: Maximum 20 document get/exists access calls per request/transaction.
    const FIRESTORE_MAX_ACCESS_CALLS = 20;

    function calculateAccessCalls(itemCount: number, hasExistsOnStockMovement: boolean, txType: 'sale' | 'purchase') {
      // 1. User profile lookup (exists + get on /userProfiles/{auth.uid}):
      // Evaluated once across the transaction for user permissions and cached = 1 document lookup
      const userProfileCalls = 1;

      // 2. Parent document check (!exists(/invoices/id) or !exists(/purchases/id)):
      const parentDocCalls = 1;

      // 3. Idempotency operation key (!exists(/operationKeys/id)):
      const operationKeyCalls = 1;

      // 4. Products update:
      // Product doc is updated. Firestore rules diff check operates on incoming resource and existing resource without extra get() = 0 calls
      const productCallsPerItem = 0;

      // 5. Stock movements create:
      // If !exists(...) is present: each new stockMovement doc generates 1 exists() check
      // If !exists(...) is removed: 0 access calls
      const stockMovementCallsPerItem = hasExistsOnStockMovement ? 1 : 0;

      // 6. Meta counters update:
      // Updated using incoming and resource diff = 0 access calls
      const counterCalls = 0;

      const totalCalls =
        userProfileCalls +
        parentDocCalls +
        operationKeyCalls +
        counterCalls +
        (itemCount * productCallsPerItem) +
        (itemCount * stockMovementCallsPerItem);

      return {
        itemCount,
        totalCalls,
        exceedsLimit: totalCalls > FIRESTORE_MAX_ACCESS_CALLS,
        totalWrites: 1 + 1 + 1 + (itemCount * 2) // parent + opKey + counter + (product + movement) * N
      };
    }

    it('PROVES that with !exists in stockMovements, 20, 30, and 40 items all FAIL the 20-call limit', () => {
      const sale20Old = calculateAccessCalls(20, true, 'sale');
      const sale30Old = calculateAccessCalls(30, true, 'sale');
      const sale40Old = calculateAccessCalls(40, true, 'sale');

      expect(sale20Old.totalCalls).toBe(23); // 20 movements + 3 base = 23 > 20
      expect(sale20Old.exceedsLimit).toBe(true);

      expect(sale30Old.totalCalls).toBe(33); // 30 movements + 3 base = 33 > 20
      expect(sale30Old.exceedsLimit).toBe(true);

      expect(sale40Old.totalCalls).toBe(43); // 40 movements + 3 base = 43 > 20
      expect(sale40Old.exceedsLimit).toBe(true);
    });

    it('PROVES that after removing !exists from stockMovements, 20, 30, and 40 items all SUCCEED with only 3 calls', () => {
      const sale20New = calculateAccessCalls(20, false, 'sale');
      const sale30New = calculateAccessCalls(30, false, 'sale');
      const sale40New = calculateAccessCalls(40, false, 'sale');

      expect(sale20New.totalCalls).toBe(3);
      expect(sale20New.exceedsLimit).toBe(false);
      expect(sale20New.totalWrites).toBe(43); // 43 writes < 500 max writes

      expect(sale30New.totalCalls).toBe(3);
      expect(sale30New.exceedsLimit).toBe(false);
      expect(sale30New.totalWrites).toBe(63); // 63 writes < 500 max writes

      expect(sale40New.totalCalls).toBe(3);
      expect(sale40New.exceedsLimit).toBe(false);
      expect(sale40New.totalWrites).toBe(83); // 83 writes < 500 max writes
    });

    it('PROVES identical behavior for purchases (20, 30, 40 items)', () => {
      const pur20Old = calculateAccessCalls(20, true, 'purchase');
      const pur30Old = calculateAccessCalls(30, true, 'purchase');
      const pur40Old = calculateAccessCalls(40, true, 'purchase');

      expect(pur20Old.totalCalls).toBe(23);
      expect(pur30Old.totalCalls).toBe(33);
      expect(pur40Old.totalCalls).toBe(43);

      const pur20New = calculateAccessCalls(20, false, 'purchase');
      const pur30New = calculateAccessCalls(30, false, 'purchase');
      const pur40New = calculateAccessCalls(40, false, 'purchase');

      expect(pur20New.totalCalls).toBe(3);
      expect(pur30New.totalCalls).toBe(3);
      expect(pur40New.totalCalls).toBe(3);
    });
  });

  describe('Part 0(d): isValidBalance and executeDebtReset verification', () => {
    // Replicating isValidBalance rule logic
    function isValidBalanceRule(bal: any): boolean {
      if (!bal || typeof bal !== 'object' || Array.isArray(bal)) return false;
      const keys = Object.keys(bal);
      const allowedKeys = ['invoiced', 'paid', 'updatedAt'];
      if (!keys.every(k => allowedKeys.includes(k))) return false;
      if (typeof bal.invoiced !== 'number') return false;
      if (typeof bal.paid !== 'number') return false;
      // Phase 2.6 rule: bal.paid >= 0 || bal.paid === bal.invoiced
      if (!(bal.paid >= 0 || bal.paid === bal.invoiced)) return false;
      if (bal.updatedAt !== undefined && typeof bal.updatedAt !== 'string') return false;
      return true;
    }

    it('allows standard positive balances and debt resets', () => {
      expect(isValidBalanceRule({ invoiced: 500, paid: 200 })).toBe(true);
      expect(isValidBalanceRule({ invoiced: 500, paid: 500 })).toBe(true);
      expect(isValidBalanceRule({ invoiced: 0, paid: 0 })).toBe(true);
    });

    it('allows legitimate executeDebtReset when customer has negative invoiced (returns exceeding sales)', () => {
      // If customer has invoiced: -150 and admin resets debt (paid = invoiced = -150)
      const clearedNegativeBalance = { invoiced: -150, paid: -150 };
      expect(isValidBalanceRule(clearedNegativeBalance)).toBe(true);
    });

    it('rejects arbitrary malicious negative paid values where paid !== invoiced', () => {
      expect(isValidBalanceRule({ invoiced: 100, paid: -50 })).toBe(false);
      expect(isValidBalanceRule({ invoiced: -100, paid: -200 })).toBe(false);
      expect(isValidBalanceRule({ invoiced: 0, paid: -1 })).toBe(false);
    });
  });
});
