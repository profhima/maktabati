import { describe, it, expect } from 'vitest';
import { calculateSale, compareSale, roundMoney, calculateDayCloseExpectedCash } from './financialEngine';

describe('Central Financial Engine (financialEngine.ts)', () => {
  it('correctly rounds values using roundMoney', () => {
    expect(roundMoney(10.555)).toBe(10.56);
    expect(roundMoney(10.554)).toBe(10.55);
    expect(roundMoney(0)).toBe(0);
    expect(roundMoney(-5.555)).toBe(-5.55);
  });

  it('calculates standard sale correctly without discount', () => {
    const items = [
      { qty: 2, price: 100, originalPrice: 100, cost: 70 },
      { qty: 1, price: 50, originalPrice: 50, cost: 30 }
    ];

    const result = calculateSale({
      items,
      discountType: 'fixed',
      discountValue: 0,
      usedPoints: 0
    });

    expect(result.originalSubtotal).toBe(250);
    expect(result.subtotal).toBe(250);
    expect(result.categoryDiscounts).toBe(0);
    expect(result.generalDiscount).toBe(0);
    expect(result.netSales).toBe(250);
    expect(result.costOfGoodsSold).toBe(170); // (2*70) + (1*30) = 140 + 30
    expect(result.grossProfit).toBe(80); // 250 - 170
    expect(result.grossMargin).toBe(32); // (80/250)*100
  });

  it('calculates fixed discount safely and prevents negative net sales', () => {
    const items = [
      { qty: 1, price: 100, originalPrice: 100, cost: 60 }
    ];

    // Standard fixed discount
    const standard = calculateSale({
      items,
      discountType: 'fixed',
      discountValue: 20
    });
    expect(standard.subtotal).toBe(100);
    expect(standard.generalDiscount).toBe(20);
    expect(standard.netSales).toBe(80);
    expect(standard.grossProfit).toBe(20); // 80 - 60

    // Excessive discount capping
    const capped = calculateSale({
      items,
      discountType: 'fixed',
      discountValue: 150
    });
    expect(capped.generalDiscount).toBe(100);
    expect(capped.netSales).toBe(0);
    expect(capped.grossProfit).toBe(-60); // 0 - 60
  });

  it('calculates percentage discount accurately', () => {
    const items = [
      { qty: 3, price: 200, originalPrice: 200, cost: 120 }
    ];

    const result = calculateSale({
      items,
      discountType: 'percent',
      discountValue: 15 // 15% of 600 = 90
    });

    expect(result.subtotal).toBe(600);
    expect(result.generalDiscount).toBe(90);
    expect(result.netSales).toBe(510);
    expect(result.costOfGoodsSold).toBe(360);
    expect(result.grossProfit).toBe(150);
  });

  it('applies category discounts and used loyalty points correctly', () => {
    const items = [
      { qty: 2, price: 90, originalPrice: 100, cost: 50 } // 20 discount from category
    ];

    const result = calculateSale({
      items,
      discountType: 'fixed',
      discountValue: 10,
      usedPoints: 20
    });

    expect(result.originalSubtotal).toBe(200);
    expect(result.subtotal).toBe(180);
    expect(result.categoryDiscounts).toBe(20);
    expect(result.generalDiscount).toBe(10);
    expect(result.usedPoints).toBe(20);
    expect(result.netSales).toBe(150); // 180 - 10 - 20 = 150
    expect(result.costOfGoodsSold).toBe(100);
    expect(result.grossProfit).toBe(50);
  });

  it('protects against negative discount input values (security edge-case)', () => {
    const items = [
      { qty: 1, price: 100, originalPrice: 100, cost: 50 }
    ];

    // Attempting to send negative discount to inflate price
    const result = calculateSale({
      items,
      discountType: 'fixed',
      discountValue: -50
    });

    expect(result.generalDiscount).toBe(0);
    expect(result.netSales).toBe(100);
  });

  it('caps used loyalty points at afterDiscount to protect customer point balance', () => {
    const items = [
      { qty: 1, price: 100, originalPrice: 100, cost: 50 }
    ];

    // Customer has 500 points, but bill after discount is only 100 EGP
    const result = calculateSale({
      items,
      discountType: 'fixed',
      discountValue: 0,
      usedPoints: 500
    });

    expect(result.subtotal).toBe(100);
    expect(result.generalDiscount).toBe(0);
    expect(result.usedPoints).toBe(100); // capped at 100
    expect(result.netSales).toBe(0);
  });

  it('correctly compares two calculations with tolerance', () => {
    const current = { netSales: 100, costOfGoodsSold: 60, grossProfit: 40 };
    const shadowSame = { netSales: 100, costOfGoodsSold: 60, grossProfit: 40 };
    const shadowDiff = { netSales: 100, costOfGoodsSold: 65, grossProfit: 35 };

    const comp1 = compareSale(current, shadowSame);
    expect(comp1.match).toBe(true);
    expect(comp1.differences.length).toBe(0);

    const comp2 = compareSale(current, shadowDiff);
    expect(comp2.match).toBe(false);
    expect(comp2.differences.length).toBe(2);
  });

  it('Financial Regression Scenario: +10000 Cash Sales, +2000 Customer Payments, -500 Cash Returns, -3000 Cash Purchases, -1000 Supplier Payments, -500 Expenses -> expectedCash = 7000', () => {
    const result = calculateDayCloseExpectedCash({
      cashSales: 10000,
      customerPayments: 2000,
      returnsCashOut: 500,
      purchasesCashOut: 3000,
      supplierPayments: 1000,
      expenses: 500
    });

    expect(result.totalIn).toBe(12000);
    expect(result.totalOut).toBe(5000);
    expect(result.expectedCash).toBe(7000);
  });
});
