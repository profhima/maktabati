export interface FinancialInput {
  items?: Array<{
    qty?: number;
    price?: number;
    originalPrice?: number;
    cost?: number;
  }>;
  discountType?: string;
  discountValue?: number;
  discount?: number;
  usedPoints?: number;
}

export interface FinancialCalculationResult {
  originalSubtotal: number;
  subtotal: number;
  categoryDiscounts: number;
  generalDiscount: number;
  usedPoints: number;
  netSales: number;
  costOfGoodsSold: number;
  grossProfit: number;
  grossMargin: number;
}

const n = (v: any): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const roundMoney = (v: number): number => {
  return Math.round((n(v) + Number.EPSILON) * 100) / 100;
};

export function calculateSale(input: FinancialInput): FinancialCalculationResult {
  const items = Array.isArray(input?.items) ? input.items : [];

  const originalSubtotal = roundMoney(
    items.reduce((s, it) => s + n(it.qty) * n(it.originalPrice ?? it.price), 0)
  );
  const subtotal = roundMoney(
    items.reduce((s, it) => s + n(it.qty) * n(it.price), 0)
  );
  const categoryDiscounts = roundMoney(Math.max(0, originalSubtotal - subtotal));

  let generalDiscount = 0;
  if (input?.discountType === 'percent') {
    generalDiscount = roundMoney(Math.min(subtotal, (subtotal * n(input.discountValue)) / 100));
  } else {
    generalDiscount = roundMoney(
      Math.min(subtotal, Math.max(0, n(input?.discountValue ?? input?.discount)))
    );
  }

  const afterDiscount = roundMoney(Math.max(0, subtotal - generalDiscount));
  const usedPoints = roundMoney(Math.min(afterDiscount, Math.max(0, n(input?.usedPoints))));
  const total = roundMoney(Math.max(0, afterDiscount - usedPoints));

  const costOfGoodsSold = roundMoney(
    items.reduce((s, it) => s + n(it.qty) * n(it.cost), 0)
  );
  const grossProfit = roundMoney(total - costOfGoodsSold);
  const grossMargin = total ? roundMoney((grossProfit / total) * 100) : 0;

  return {
    originalSubtotal,
    subtotal,
    categoryDiscounts,
    generalDiscount,
    usedPoints,
    netSales: total,
    costOfGoodsSold,
    grossProfit,
    grossMargin
  };
}

export function compareSale(
  current: { netSales?: number; costOfGoodsSold?: number; grossProfit?: number },
  shadow: { netSales?: number; costOfGoodsSold?: number; grossProfit?: number },
  tolerance = 0.01
) {
  const fields = ['netSales', 'costOfGoodsSold', 'grossProfit'] as const;
  const differences: Array<{
    field: string;
    current: number;
    shadow: number;
    difference: number;
  }> = [];

  fields.forEach(k => {
    const a = roundMoney(current?.[k] || 0);
    const b = roundMoney(shadow?.[k] || 0);
    if (Math.abs(a - b) > tolerance) {
      differences.push({ field: k, current: a, shadow: b, difference: roundMoney(b - a) });
    }
  });

  return {
    match: differences.length === 0,
    differences
  };
}

export const FinancialEngineShadow = {
  version: '2.0-shadow',
  calculateSale,
  compareSale,
  round: roundMoney
};

export interface DayCloseCashBreakdown {
  cashSales: number;
  customerPayments: number;
  returnsCashIn?: number;
  purchaseReturnsCashIn?: number;
  deposits?: number;
  returnsCashOut: number;
  purchasesCashOut: number;
  supplierPayments: number;
  expenses: number;
  withdrawals?: number;
}

export function calculateDayCloseExpectedCash(b: DayCloseCashBreakdown): {
  totalIn: number;
  totalOut: number;
  expectedCash: number;
} {
  const totalIn = roundMoney(
    n(b.cashSales) +
    n(b.customerPayments) +
    n(b.returnsCashIn) +
    n(b.purchaseReturnsCashIn) +
    n(b.deposits)
  );
  const totalOut = roundMoney(
    n(b.returnsCashOut) +
    n(b.purchasesCashOut) +
    n(b.supplierPayments) +
    n(b.expenses) +
    n(b.withdrawals)
  );
  const expectedCash = roundMoney(totalIn - totalOut);
  return { totalIn, totalOut, expectedCash };
}
