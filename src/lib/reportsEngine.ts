import { DBState, Product } from '../types';
import { productFullName } from './utils';

export interface ReportCalculationsParams {
  db: DBState;
  filterMonth: string;
  seasonalMultiplier?: number;
}

export function computeReportsData({ db, filterMonth, seasonalMultiplier = 2.0 }: ReportCalculationsParams) {
  const allProducts = db.products || [];

  // Filter by selected month
  const monthInvoices = (db.invoices || []).filter(
    inv => (inv.date || '').startsWith(filterMonth) && inv.status !== 'refunded'
  );

  const monthReturns = (db.salesReturns || []).filter(r => (r.date || '').startsWith(filterMonth));
  const monthExpenses = (db.expenses || []).filter(e => (e.date || '').startsWith(filterMonth));

  // Velocity map: units sold in last 30 days
  const velocityMap = new Map<string, number>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  (db.invoices || [])
    .filter(inv => inv.status !== 'refunded' && (inv.date || '') >= cutoffStr)
    .forEach(inv => {
      (inv.items || []).forEach((it: any) => {
        const key = it.productId || it.name;
        velocityMap.set(key, (velocityMap.get(key) || 0) + (Number(it.qty) || 0));
      });
    });

  (db.salesReturns || [])
    .filter(r => (r.date || '') >= cutoffStr)
    .forEach(r => {
      (r.items || []).forEach((it: any) => {
        const key = it.productId || it.name;
        velocityMap.set(key, Math.max(0, (velocityMap.get(key) || 0) - (Number(it.qty) || 0)));
      });
    });

  // 1. Stockout Forecast
  const stockoutData = allProducts
    .map(p => {
      const sold30 = velocityMap.get(p.id) || velocityMap.get(p.name) || 0;
      const dailyVelocity = sold30 / 30;
      const daysRemaining = dailyVelocity > 0 ? Math.floor(p.qty / dailyVelocity) : 999;
      const suggestedQty = Math.max(0, Math.ceil(dailyVelocity * 30 * 1.2) - p.qty);

      return {
        id: p.id,
        name: productFullName(p),
        category: p.category,
        qty: p.qty,
        minQty: p.minQty || 0,
        costPrice: p.costPrice,
        sellPrice: p.sellPrice,
        sold30,
        dailyVelocity: Number(dailyVelocity.toFixed(2)),
        daysRemaining,
        suggestedQty,
        status:
          p.qty <= 0
            ? 'نفد تماماً'
            : daysRemaining <= 5
            ? 'خطر نفاد وشيك'
            : daysRemaining <= 15
            ? 'طلب قريب'
            : 'مستقر'
      };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  // 2. Purchase Plan
  const purchasePlanData = stockoutData
    .filter(p => p.qty <= p.minQty || p.daysRemaining <= 15)
    .map(p => ({
      ...p,
      orderQty: p.suggestedQty > 0 ? p.suggestedQty : Math.max(p.minQty * 2 - p.qty, 10),
      estimatedCost:
        (p.suggestedQty > 0 ? p.suggestedQty : Math.max(p.minQty * 2 - p.qty, 10)) * p.costPrice
    }));

  // 3. Seasonal Surge
  const seasonalSurgeData = allProducts
    .filter(p => {
      const cat = (p.category || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      return (
        cat.includes('أدوات') ||
        cat.includes('كشاكيل') ||
        cat.includes('مدرسي') ||
        name.includes('كشكول') ||
        name.includes('كراس') ||
        name.includes('قلم') ||
        name.includes('مسطرة') ||
        name.includes('براية') ||
        name.includes('ألوان')
      );
    })
    .map(p => {
      const baseSales = velocityMap.get(p.id) || 10;
      const seasonalDemand = Math.ceil(baseSales * seasonalMultiplier);
      const needed = Math.max(0, seasonalDemand - p.qty);
      const costToStock = needed * p.costPrice;
      const expectedProfit = needed * (p.sellPrice - p.costPrice);

      return {
        id: p.id,
        name: productFullName(p),
        category: p.category,
        currentQty: p.qty,
        baseDemand: baseSales,
        seasonalDemand,
        neededQty: needed,
        costToStock,
        expectedProfit
      };
    })
    .sort((a, b) => b.costToStock - a.costToStock);

  // 4. Fast Movers
  const fastMoversData = stockoutData
    .filter(p => p.sold30 >= 5 && p.daysRemaining <= 10)
    .sort((a, b) => b.sold30 - a.sold30);

  // 5. Bulk Savings
  const bulkSavingsData = allProducts
    .map(p => {
      const wholesaleEstCost = p.costPrice * 0.85;
      const savingsPer100 = (p.costPrice - wholesaleEstCost) * 100;
      const marginGain =
        ((p.sellPrice - wholesaleEstCost) / p.sellPrice) * 100 -
        ((p.sellPrice - p.costPrice) / p.sellPrice) * 100;

      return {
        id: p.id,
        name: productFullName(p),
        singleCost: p.costPrice,
        bulkCostEst: wholesaleEstCost,
        sellPrice: p.sellPrice,
        savingsPer100,
        marginGain: Number(marginGain.toFixed(1))
      };
    })
    .sort((a, b) => b.savingsPer100 - a.savingsPer100)
    .slice(0, 30);

  // 6. ABC Analysis
  const itemSales: Array<{ id: string; name: string; category: string; revenue: number; qtySold: number }> = [];
  let totalAbcRevenue = 0;

  allProducts.forEach(p => {
    const sold = velocityMap.get(p.id) || 0;
    const rev = sold * p.sellPrice;
    totalAbcRevenue += rev;
    itemSales.push({
      id: p.id,
      name: productFullName(p),
      category: p.category,
      revenue: rev,
      qtySold: sold
    });
  });

  itemSales.sort((a, b) => b.revenue - a.revenue);

  let cumulativeRev = 0;
  const abcData = itemSales.map(item => {
    cumulativeRev += item.revenue;
    const share = totalAbcRevenue > 0 ? (cumulativeRev / totalAbcRevenue) * 100 : 0;
    const tier: 'A' | 'B' | 'C' = share <= 80 ? 'A' : share <= 95 ? 'B' : 'C';

    return {
      ...item,
      revenueShare: totalAbcRevenue > 0 ? ((item.revenue / totalAbcRevenue) * 100).toFixed(1) : '0',
      cumulativeShare: share.toFixed(1),
      tier
    };
  });

  // 7. Dead Stock
  const activeIds = new Set(velocityMap.keys());
  const deadStockData = allProducts
    .filter(p => p.qty > 0 && !activeIds.has(p.id) && !activeIds.has(p.name))
    .map(p => ({
      id: p.id,
      name: productFullName(p),
      category: p.category,
      qty: p.qty,
      costPrice: p.costPrice,
      sellPrice: p.sellPrice,
      tiedCapital: p.qty * p.costPrice
    }))
    .sort((a, b) => b.tiedCapital - a.tiedCapital);

  // 8. Stock Valuation
  const totalCost = allProducts.reduce((s, p) => s + (p.qty || 0) * (p.costPrice || 0), 0);
  const totalRetail = allProducts.reduce((s, p) => s + (p.qty || 0) * (p.sellPrice || 0), 0);
  const totalProfit = totalRetail - totalCost;
  const totalUnits = allProducts.reduce((s, p) => s + (p.qty || 0), 0);

  const byCategory = new Map<string, { count: number; units: number; cost: number; retail: number }>();
  allProducts.forEach(p => {
    const c = byCategory.get(p.category) || { count: 0, units: 0, cost: 0, retail: 0 };
    c.count += 1;
    c.units += p.qty || 0;
    c.cost += (p.qty || 0) * (p.costPrice || 0);
    c.retail += (p.qty || 0) * (p.sellPrice || 0);
    byCategory.set(p.category, c);
  });

  const stockValuationData = {
    totalCost,
    totalRetail,
    totalProfit,
    totalUnits,
    categories: Array.from(byCategory.entries()).map(([name, data]) => ({
      name,
      ...data,
      margin: data.retail > 0 ? (((data.retail - data.cost) / data.retail) * 100).toFixed(1) : '0'
    }))
  };

  // 9. P&L Statement
  const grossSales = monthInvoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const returnsValue = monthReturns.reduce((s, r) => s + (r.netReturn || 0), 0);
  const netSales = Math.max(0, grossSales - returnsValue);

  const salesCost = monthInvoices.reduce(
    (s, inv) =>
      s +
      (inv.items || []).reduce(
        (is: number, it: any) => is + (Number(it.qty) || 0) * (Number(it.cost) || 0),
        0
      ),
    0
  );
  const returnsCost = monthReturns.reduce(
    (s, r) =>
      s +
      (r.items || []).reduce(
        (is: number, it: any) => is + (Number(it.qty) || 0) * (Number(it.cost) || 0),
        0
      ),
    0
  );
  const cogs = Math.max(0, salesCost - returnsCost);
  const grossProfit = netSales - cogs;
  const totalOperatingExpenses = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const netOperatingProfit = grossProfit - totalOperatingExpenses;
  const netMargin = netSales > 0 ? (netOperatingProfit / netSales) * 100 : 0;

  const pnlData = {
    grossSales,
    returnsValue,
    netSales,
    cogs,
    grossProfit,
    totalOperatingExpenses,
    netOperatingProfit,
    netMargin
  };

  // 10. Best Sellers
  const itemMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
  monthInvoices.forEach(inv => {
    (inv.items || []).forEach((it: any) => {
      const id = String(it.productId || it.name);
      const existing = itemMap.get(id) || {
        name: it.name,
        qty: 0,
        revenue: 0,
        profit: 0
      };
      const q = Number(it.qty) || 0;
      const rev = q * (Number(it.price) || 0);
      const cost = q * (Number(it.cost) || 0);
      existing.qty += q;
      existing.revenue += rev;
      existing.profit += rev - cost;
      itemMap.set(id, existing);
    });
  });
  const bestSellersData = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty);

  // 11. Receivables
  const receivablesData = (db.customers || [])
    .map(c => {
      const invoiced = c.balance?.invoiced || 0;
      const paid = c.balance?.paid || 0;
      const due = Math.max(0, invoiced - paid);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone || 'غير مسجل',
        points: c.loyaltyPoints || 0,
        invoiced,
        paid,
        due
      };
    })
    .filter(c => c.due > 0 || c.invoiced > 0)
    .sort((a, b) => b.due - a.due);

  // 12. Supplier Balances
  const supplierBalancesData = (db.suppliers || [])
    .map(s => {
      const invoiced = s.balance?.invoiced || 0;
      const paid = s.balance?.paid || 0;
      const net = invoiced - paid;
      const due = Math.max(0, net);
      const credit = Math.max(0, -net);
      return {
        id: s.id,
        name: s.name,
        phone: s.phone || 'غير مسجل',
        invoiced,
        paid,
        due,
        credit,
        net
      };
    })
    .sort((a, b) => b.due - a.due);

  // 13. Expense Breakdown
  const expMap = new Map<string, number>();
  monthExpenses.forEach(e => {
    const cat = e.category || 'نثريات متنوعة';
    expMap.set(cat, (expMap.get(cat) || 0) + (Number(e.amount) || 0));
  });
  const totalExp = Array.from(expMap.values()).reduce((s, v) => s + v, 0);
  const expenseBreakdownData = Array.from(expMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      share: totalExp > 0 ? ((amount / totalExp) * 100).toFixed(1) : '0'
    }))
    .sort((a, b) => b.amount - a.amount);

  // 14. Inventory Turnover
  const inventoryTurnoverData = allProducts
    .map(p => {
      const soldUnits = velocityMap.get(p.id) || velocityMap.get(p.name) || 0;
      const cogsProduct = soldUnits * (p.costPrice || 0);
      const avgInventoryValue = Math.max((p.qty || 0) * (p.costPrice || 0), p.costPrice || 1);
      const turnoverRatio = Number((cogsProduct / avgInventoryValue).toFixed(2));
      const daysOfInventory = turnoverRatio > 0 ? Math.round(30 / turnoverRatio) : 999;

      return {
        id: p.id,
        name: productFullName(p),
        category: p.category,
        qty: p.qty,
        costPrice: p.costPrice,
        soldUnits,
        cogsProduct,
        turnoverRatio,
        daysOfInventory,
        speed:
          turnoverRatio >= 2
            ? 'دوران سريع جداً'
            : turnoverRatio >= 0.8
            ? 'دوران متوسط'
            : turnoverRatio > 0
            ? 'بطيء الحركة'
            : 'عديم الحركة'
      };
    })
    .sort((a, b) => b.turnoverRatio - a.turnoverRatio);

  // 15. Margin By Product
  const marginByProductData = allProducts
    .map(p => {
      const cost = p.costPrice || 0;
      const sell = p.sellPrice || 0;
      const profitPerUnit = sell - cost;
      const marginPercent = sell > 0 ? (profitPerUnit / sell) * 100 : 0;
      const soldUnits = velocityMap.get(p.id) || velocityMap.get(p.name) || 0;
      const totalP = soldUnits * profitPerUnit;

      return {
        id: p.id,
        name: productFullName(p),
        category: p.category,
        brand: (p as any).brand || 'عام',
        cost,
        sell,
        profitPerUnit,
        marginPercent: Number(marginPercent.toFixed(1)),
        soldUnits,
        totalProfit: totalP
      };
    })
    .sort((a, b) => b.marginPercent - a.marginPercent);

  // 16. Category Sales
  const catMap = new Map<string, { count: number; qtySold: number; revenue: number; cost: number }>();
  allProducts.forEach(p => {
    const cat = p.category || 'عام';
    if (!catMap.has(cat)) {
      catMap.set(cat, { count: 0, qtySold: 0, revenue: 0, cost: 0 });
    }
    const cur = catMap.get(cat)!;
    cur.count += 1;
  });

  monthInvoices.forEach(inv => {
    (inv.items || []).forEach((it: any) => {
      const prod = allProducts.find(p => p.id === it.productId || p.name === it.name);
      const cat = prod?.category || it.category || 'عام';
      if (!catMap.has(cat)) {
        catMap.set(cat, { count: 1, qtySold: 0, revenue: 0, cost: 0 });
      }
      const cur = catMap.get(cat)!;
      const q = Number(it.qty) || 0;
      const rev = q * (Number(it.price) || 0);
      const c = q * (Number(it.cost) || 0);
      cur.qtySold += q;
      cur.revenue += rev;
      cur.cost += c;
    });
  });

  const totalCatRev = Array.from(catMap.values()).reduce((s, c) => s + c.revenue, 0);
  const categorySalesData = Array.from(catMap.entries())
    .map(([category, d]) => {
      const profit = d.revenue - d.cost;
      const margin = d.revenue > 0 ? (profit / d.revenue) * 100 : 0;
      const share = totalCatRev > 0 ? (d.revenue / totalCatRev) * 100 : 0;

      return {
        category,
        count: d.count,
        qtySold: d.qtySold,
        revenue: d.revenue,
        profit,
        margin: Number(margin.toFixed(1)),
        share: Number(share.toFixed(1))
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  // 17. Printing Services
  let printRev = 0;
  let printCost = 0;
  let printPages = 0;
  const printItems: Array<{ name: string; qty: number; revenue: number; cost: number; profit: number }> = [];

  monthInvoices.forEach(inv => {
    (inv.items || []).forEach((it: any) => {
      const name = (it.name || '').toLowerCase();
      const cat = (it.category || '').toLowerCase();
      const isPrint =
        name.includes('تصوير') ||
        name.includes('طباعة') ||
        name.includes('تجليد') ||
        name.includes('سكانر') ||
        name.includes('فايل') ||
        cat.includes('خدمات') ||
        cat.includes('طباعة');

      if (isPrint) {
        const q = Number(it.qty) || 0;
        const rev = q * (Number(it.price) || 0);
        const c = q * (Number(it.cost) || 0);
        printRev += rev;
        printCost += c;
        printPages += q;
        printItems.push({
          name: it.name,
          qty: q,
          revenue: rev,
          cost: c,
          profit: rev - c
        });
      }
    });
  });

  const printingServicesData = {
    totalRevenue: printRev,
    totalCost: printCost,
    totalProfit: printRev - printCost,
    totalPages: printPages,
    items: printItems
  };

  // 18. VIP Customers
  const custMap = new Map<
    string,
    { id: string; name: string; phone: string; invoicesCount: number; totalSpent: number; totalProfit: number; points: number }
  >();

  (db.customers || []).forEach(c => {
    custMap.set(c.id, {
      id: c.id,
      name: c.name,
      phone: c.phone || 'غير مسجل',
      invoicesCount: 0,
      totalSpent: 0,
      totalProfit: 0,
      points: c.loyaltyPoints || 0
    });
  });

  monthInvoices.forEach(inv => {
    const cId = inv.customerId;
    const cName = inv.customerName || 'عميل نقدي';
    const key = cId || cName;

    if (!custMap.has(key)) {
      custMap.set(key, {
        id: key,
        name: cName,
        phone: 'غير مسجل',
        invoicesCount: 0,
        totalSpent: 0,
        totalProfit: 0,
        points: 0
      });
    }

    const cur = custMap.get(key)!;
    cur.invoicesCount += 1;
    const rev = Number(inv.total) || 0;
    const cost = (inv.items || []).reduce(
      (s: number, it: any) => s + (Number(it.qty) || 0) * (Number(it.cost) || 0),
      0
    );
    cur.totalSpent += rev;
    cur.totalProfit += rev - cost;
  });

  const vipCustomersData = Array.from(custMap.values())
    .filter(c => c.totalSpent > 0 || c.invoicesCount > 0)
    .sort((a, b) => b.totalSpent - a.totalSpent);

  // 19. Cash Flow
  const cashSales = monthInvoices
    .filter(inv => (inv.paymentMethod || 'cash') === 'cash' || !inv.paymentMethod)
    .reduce((s, inv) => s + (inv.paidAmount !== undefined ? inv.paidAmount : inv.total || 0), 0);

  const electronicSales = monthInvoices
    .filter(inv => ['visa', 'card', 'instapay', 'vodafone_cash'].includes(inv.paymentMethod || ''))
    .reduce((s, inv) => s + (inv.paidAmount !== undefined ? inv.paidAmount : inv.total || 0), 0);

  const totalCashIn = cashSales + electronicSales;
  const expensesPaid = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const supplierPaid = (db.suppliers || []).reduce((s, sp) => s + (sp.balance?.paid || 0), 0);
  const returnsPaid = monthReturns.reduce((s, r) => s + (Number(r.netReturn) || 0), 0);
  const totalCashOut = expensesPaid + supplierPaid + returnsPaid;

  const cashFlowData = {
    cashSales,
    electronicSales,
    totalCashIn,
    expensesPaid,
    supplierPaid,
    returnsPaid,
    totalCashOut,
    netCashFlow: totalCashIn - totalCashOut
  };

  // 20. Returns Impact
  const totalReturnsVal = monthReturns.reduce((s, r) => s + (r.netReturn || 0), 0);
  const returnRate = grossSales > 0 ? (totalReturnsVal / grossSales) * 100 : 0;
  const returnItemsMap = new Map<string, { name: string; qty: number; totalLoss: number; reason: string }>();

  monthReturns.forEach(r => {
    (r.items || []).forEach((it: any) => {
      const id = it.productId || it.name;
      const cur = returnItemsMap.get(id) || { name: it.name, qty: 0, totalLoss: 0, reason: (r as any).reason || 'استرجاع عام' };
      const q = Number(it.qty) || 0;
      cur.qty += q;
      cur.totalLoss += q * (Number(it.price) || 0);
      returnItemsMap.set(id, cur);
    });
  });

  const returnsImpactData = {
    totalSalesRev: grossSales,
    totalReturnsVal,
    returnRate: Number(returnRate.toFixed(2)),
    countReturns: monthReturns.length,
    items: Array.from(returnItemsMap.values()).sort((a, b) => b.totalLoss - a.totalLoss)
  };

  // 21. Executive & Decision Hub
  const activeInvoices = (db.invoices || []).filter(i => i.status !== 'refunded');
  const execSales = activeInvoices.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const execPaid = activeInvoices.reduce(
    (s, i) => s + (i.paidAmount !== undefined && i.paidAmount !== null ? Number(i.paidAmount) : Number(i.total) || 0),
    0
  );
  const execReceivable = Math.max(0, execSales - execPaid);
  const execCollectionRate = execSales > 0 ? (execPaid / execSales) * 100 : 0;

  const execStockCost = allProducts.reduce((s, p) => s + (Number(p.qty) || 0) * (Number(p.costPrice) || 0), 0);
  const execStockRetail = allProducts.reduce((s, p) => s + (Number(p.qty) || 0) * (Number(p.sellPrice) || 0), 0);
  const execGrossPotential = execStockRetail - execStockCost;
  const execMargin = execStockRetail > 0 ? (execGrossPotential / execStockRetail) * 100 : 0;

  const execLowStockProducts = allProducts.filter(p => (Number(p.qty) || 0) <= (Number(p.minQty) || 0));
  const execOverStockProducts = allProducts.filter(
    p => (Number(p.qty) || 0) > Math.max(0, (Number(p.minQty) || 0) * 3)
  );
  const execStockedCount = allProducts.filter(p => (Number(p.qty) || 0) > 0).length;
  const execGrossPurchases = (db.purchases || []).reduce((s, p) => s + (Number(p.total) || 0), 0);
  const execPurchaseReturnsTotal = ((db as any).purchaseReturns || []).reduce((s: number, pr: any) => s + (Number(pr.totalRefund) || 0), 0);
  const execPurchaseTotal = Math.max(0, execGrossPurchases - execPurchaseReturnsTotal);
  const execExpenseTotal = (db.expenses || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const execNegativeStock = allProducts.filter(p => (Number(p.qty) || 0) < 0);
  const execNoPriceProducts = allProducts.filter(
    p => (Number(p.qty) || 0) > 0 && (!(Number(p.sellPrice) > 0) || !(Number(p.costPrice) >= 0))
  );
  const execDeadCandidates = allProducts.filter(
    p =>
      (Number(p.qty) || 0) > 0 &&
      (Number(p.minQty) || 0) > 0 &&
      (Number(p.qty) || 0) > (Number(p.minQty) || 0) * 3
  ).length;

  // Smart Alerts
  const smartAlertsData: Array<{
    level: 'critical' | 'missing' | 'purchase' | 'overstock' | 'collection' | 'margin' | 'stable';
    levelLabel: string;
    levelBadge: string;
    message: string;
    action: string;
    iconType: 'critical' | 'warning' | 'info' | 'success';
  }> = [];

  if (execNegativeStock.length > 0) {
    smartAlertsData.push({
      level: 'critical',
      levelLabel: 'حرج',
      levelBadge: 'bg-rose-100 text-rose-800 border-rose-300',
      message: `رصيد مخزون سالب في ${execNegativeStock.length} صنف — يحتاج مراجعة فورية`,
      action: 'مراجعة حركة المخزون وتسوية الأرصدة الفعلية فوراً لمنع الأخطاء المحاسبية',
      iconType: 'critical'
    });
  }

  if (execNoPriceProducts.length > 0) {
    smartAlertsData.push({
      level: 'missing',
      levelLabel: 'بيانات ناقصة',
      levelBadge: 'bg-rose-100 text-rose-800 border-rose-300',
      message: `${execNoPriceProducts.length} صنف مخزونها موجود لكن السعر غير مكتمل — راجع بطاقة الصنف`,
      action: 'تحديد أسعار التكلفة وسعر البيع لتفادي تشوه حسابات الأرباح والتقارير',
      iconType: 'critical'
    });
  }

  if (execLowStockProducts.length > 0) {
    smartAlertsData.push({
      level: 'purchase',
      levelLabel: 'شراء',
      levelBadge: 'bg-amber-100 text-amber-900 border-amber-300',
      message: `${execLowStockProducts.length} صنف عند/تحت الحد الأدنى — راجع إعادة الطلب`,
      action: 'إصدار مسودة أمر توريد وتجهيز قائمة الشراء لتفادي نفاد البضاعة وضياع المبيعات',
      iconType: 'warning'
    });
  }

  if (execOverStockProducts.length > 0) {
    smartAlertsData.push({
      level: 'overstock',
      levelLabel: 'مخزون زائد',
      levelBadge: 'bg-yellow-100 text-yellow-900 border-yellow-300',
      message: `${execOverStockProducts.length} صنف تتجاوز كميتها 3× الحد الأدنى — أوقف الشراء مؤقتًا`,
      action: 'تجميد الشراء للأصناف المتكدسة وتفعيل عروض ترويجية لتسييل رأس المال المعطل',
      iconType: 'warning'
    });
  }

  if (execReceivable > 0) {
    smartAlertsData.push({
      level: 'collection',
      levelLabel: 'تحصيل',
      levelBadge: 'bg-amber-100 text-amber-900 border-amber-300',
      message: `مستحقات بقيمة ${execReceivable.toLocaleString('ar-EG')} ج.م غير محصلة — راجع العملاء`,
      action: 'متابعة الذمم الآجلة وإرسال إشعارات ومطالبات تحصيل للعملاء المدينين',
      iconType: 'warning'
    });
  }

  if (execStockCost > 0 && execStockRetail > 0 && execMargin < 20) {
    smartAlertsData.push({
      level: 'margin',
      levelLabel: 'هامش',
      levelBadge: 'bg-yellow-100 text-yellow-900 border-yellow-300',
      message: `الهامش النظري للمخزون أقل من 20% (${execMargin.toFixed(1)}%) — راجع التسعير`,
      action: 'مراجعة تسعير البيع والتفاوض مع الموردين للحصول على خصومات كمية وتجارية',
      iconType: 'warning'
    });
  }

  if (smartAlertsData.length === 0) {
    smartAlertsData.push({
      level: 'stable',
      levelLabel: 'الحالة',
      levelBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      message: 'لا توجد تنبيهات حرجة — الوضع مستقر',
      action: 'كافة المؤشرات في النطاق الآمن، استمر في المتابعة الدورية للأداء',
      iconType: 'success'
    });
  }

  // Decision Center
  const decisionCenterData: Array<{
    level: string;
    levelBadge: string;
    decision: string;
    priority: 'عاجل' | 'مرتفع' | 'متابعة' | 'جيد';
    priorityBadge: string;
    recommendedAction: string;
  }> = [];

  if (execLowStockProducts.length > 0) {
    decisionCenterData.push({
      level: 'شراء',
      levelBadge: 'bg-rose-100 text-rose-800 border-rose-300',
      decision: `راجع ${execLowStockProducts.length} صنف عند/تحت الحد الأدنى`,
      priority: 'عاجل',
      priorityBadge: 'bg-rose-600 text-white',
      recommendedAction: 'تجهيز وإرسال طلبيات الشراء للنواقص فوراً لمنع تعطل المبيعات وضياع العملاء'
    });
  }

  if (execOverStockProducts.length > 0) {
    decisionCenterData.push({
      level: 'مخزون',
      levelBadge: 'bg-amber-100 text-amber-900 border-amber-300',
      decision: `راجع ${execOverStockProducts.length} صنف ذات مخزون مرتفع قبل إعادة الشراء`,
      priority: 'مرتفع',
      priorityBadge: 'bg-amber-600 text-white',
      recommendedAction: 'إيقاف الشراء وعمل عروض ترويجية وباقات مجمعة لتسييل المخزون وتحرير السيولة'
    });
  }

  if (execReceivable > 0) {
    decisionCenterData.push({
      level: 'تحصيل',
      levelBadge: 'bg-amber-100 text-amber-900 border-amber-300',
      decision: `هناك مستحقات غير محصلة من الفواتير بقيمة ${execReceivable.toLocaleString('ar-EG')} ج.م`,
      priority: 'متابعة',
      priorityBadge: 'bg-amber-500 text-white',
      recommendedAction: 'إرسال كشوف الحسابات والتواصل المباشر مع العملاء الآجلين لتسريع التحصيل'
    });
  }

  if (execStockCost > 0 && execStockRetail > 0 && execStockCost / execStockRetail > 0.8) {
    decisionCenterData.push({
      level: 'هامش',
      levelBadge: 'bg-yellow-100 text-yellow-900 border-yellow-300',
      decision: 'هامش الربح النظري منخفض نسبيًا؛ راجع التسعير',
      priority: 'متابعة',
      priorityBadge: 'bg-yellow-600 text-white',
      recommendedAction: 'مراجعة سياسة التسعير وزيادة أسعار البيع أو التفاوض للحصول على بوانص وخصومات شراء'
    });
  }

  if (decisionCenterData.length === 0) {
    decisionCenterData.push({
      level: 'عام',
      levelBadge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      decision: 'لا توجد قرارات حرجة من المؤشرات الحالية',
      priority: 'جيد',
      priorityBadge: 'bg-emerald-600 text-white',
      recommendedAction: 'المؤشرات التشغيلية والمالية متوازنة، استمر في تنفيذ الخطة الحالية بنفس الكفاءة'
    });
  }

  // Executive Dashboard Data
  const textAlerts: Array<{ text: string; type: 'rose' | 'amber' | 'yellow' | 'emerald' }> = [];

  if (execLowStockProducts.length > 0) {
    textAlerts.push({
      text: `${execLowStockProducts.length} صنف عند/تحت الحد الأدنى — راجع الشراء`,
      type: 'rose'
    });
  }

  if (execOverStockProducts.length > 0) {
    textAlerts.push({
      text: `${execOverStockProducts.length} صنف يبدو مخزونه مرتفعًا — راجع سرعة الدوران`,
      type: 'amber'
    });
  }

  if (execCollectionRate < 80 && execSales > 0) {
    textAlerts.push({
      text: `نسبة التحصيل ${execCollectionRate.toFixed(1)}% — راجع الآجل والمستحقات`,
      type: 'yellow'
    });
  }

  if (execMargin < 20 && execStockRetail > 0) {
    textAlerts.push({
      text: `هامش الربح النظري للمخزون منخفض نسبيًا (${execMargin.toFixed(1)}%)`,
      type: 'yellow'
    });
  }

  if (textAlerts.length === 0) {
    textAlerts.push({
      text: 'لا توجد إشارة تحذير رئيسية — الأداء التشغيلي والمالي متوازن',
      type: 'emerald'
    });
  }

  const executiveDashboardData = {
    cards: [
      { label: 'المخزون بالتكلفة', val: execStockCost, unit: 'ج.م', color: 'slate' },
      { label: 'قيمة البيع المحتملة', val: execStockRetail, unit: 'ج.م', color: 'blue' },
      { label: 'المبيعات', val: execSales, unit: 'ج.م', color: 'emerald' },
      { label: 'المحصل', val: execPaid, unit: 'ج.م', color: 'emerald' },
      { label: 'المستحقات', val: execReceivable, unit: 'ج.م', color: 'amber' },
      { label: 'المشتريات', val: execPurchaseTotal, unit: 'ج.م', color: 'purple' },
      { label: 'المصروفات', val: execExpenseTotal, unit: 'ج.م', color: 'rose' }
    ],
    textAlerts,
    tableRows: [
      { label: 'إجمالي المبيعات', value: `${execSales.toLocaleString('ar-EG')} ج.م`, note: 'من واقع فواتير المبيعات النشطة' },
      { label: 'المبالغ المحصلة', value: `${execPaid.toLocaleString('ar-EG')} ج.م`, note: 'المقبوضات الفعلية' },
      { label: 'نسبة التحصيل %', value: `${execCollectionRate.toFixed(1)}%`, note: 'نسبة المسدد من إجمالي المبيعات' },
      { label: 'المخزون بالتكلفة', value: `${execStockCost.toLocaleString('ar-EG')} ج.م`, note: 'رأس المال المستثمر في البضاعة' },
      { label: 'قيمة المخزون بسعر البيع', value: `${execStockRetail.toLocaleString('ar-EG')} ج.م`, note: 'القيمة السوقية المتوقعة للبضاعة' },
      { label: 'الربح المحتمل للمخزون', value: `+${execGrossPotential.toLocaleString('ar-EG')} ج.م`, note: 'الفرق بين سعر البيع والتكلفة' },
      { label: 'هامش الربح النظري %', value: `${execMargin.toFixed(1)}%`, note: 'نسبة مجمل الربح على سعر البيع' },
      { label: 'أصناف عند/تحت الحد الأدنى', value: `${execLowStockProducts.length} صنف`, note: 'أصناف تحتاج إعادة طلب' },
      { label: 'أصناف ذات مخزون مرتفع', value: `${execOverStockProducts.length} صنف`, note: 'أصناف تتجاوز 3 أضعاف الحد الأدنى' },
      { label: 'إجمالي المشتريات', value: `${execPurchaseTotal.toLocaleString('ar-EG')} ج.م`, note: 'فواتير التوريد المسجلة' },
      { label: 'إجمالي المصروفات', value: `${execExpenseTotal.toLocaleString('ar-EG')} ج.م`, note: 'المصروفات التشغيلية والنثرية' }
    ]
  };

  // Health Score
  const marginScore = Math.min(25, Math.max(0, execMargin / 2));
  const collectionScore = Math.min(25, Math.max(0, execCollectionRate / 4));
  const stockScore =
    execStockedCount > 0
      ? Math.max(0, 20 - (execLowStockProducts.length / Math.max(1, execStockedCount)) * 20)
      : 10;
  const deadScore =
    execStockedCount > 0
      ? Math.max(0, 15 - (execDeadCandidates / Math.max(1, execStockedCount)) * 15)
      : 7;
  const activityScore = Math.min(15, execSales > 0 ? 15 : 0);

  const score = Math.round(marginScore + collectionScore + stockScore + deadScore + activityScore);

  let rating: { title: string; color: string; bg: string; border: string; desc: string };
  if (score >= 80) {
    rating = {
      title: 'ممتاز 🟢',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-300',
      desc: 'أداء مالي وتشغيلي قوي جداً، هوامش ربحية صحية ونسبة تحصيل وتدوير مخزون ممتازة.'
    };
  } else if (score >= 65) {
    rating = {
      title: 'جيد 🟡',
      color: 'text-yellow-700',
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      desc: 'النشاط يسير بشكل جيد ومستقر، مع وجود بعض الفرص لتحسين التحصيل وتسريع حركة النواقص.'
    };
  } else if (score >= 50) {
    rating = {
      title: 'يحتاج متابعة 🟠',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      desc: 'توجد مؤشرات تحتاج إلى تدخل إداري عاجل، مثل تراكم المستحقات أو بطء دوران بعض الأصناف.'
    };
  } else {
    rating = {
      title: 'يحتاج تدخل 🔴',
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-300',
      desc: 'يتطلب مراجعة فورية لهيكل التسعير وسياسات البيع الآجل وتصفية الرواكد لإنعاش السيولة.'
    };
  }

  const healthScoreData = {
    score,
    components: [
      { label: 'كفاءة الهوامش والأرباح', score: Math.round(marginScore), max: 25, unit: 'نقطة', desc: `مبني على هامش ${execMargin.toFixed(1)}%` },
      { label: 'كفاءة التحصيل والسيولة', score: Math.round(collectionScore), max: 25, unit: 'نقطة', desc: `نسبة التحصيل ${execCollectionRate.toFixed(1)}%` },
      { label: 'وفرة المخزون وسرعة الإمداد', score: Math.round(stockScore), max: 20, unit: 'نقطة', desc: `${execLowStockProducts.length} صنف عند الحد الأدنى` },
      { label: 'سلامة المخزون وتفادي التكدس', score: Math.round(deadScore), max: 15, unit: 'نقطة', desc: `${execDeadCandidates} صنف متكدس / راكد` },
      { label: 'فاعلية النشاط والمبيعات', score: Math.round(activityScore), max: 15, unit: 'نقطة', desc: execSales > 0 ? 'توجد حركة مبيعات مسجلة' : 'لا توجد مبيعات' }
    ],
    rating,
    tableRows: [
      { label: 'مؤشر صحة النشاط (score/100)', value: `${score} / 100`, note: 'مقياس إجمالي شامل لكافة الجوانب' },
      { label: 'هامش الربح النظري %', value: `${execMargin.toFixed(1)}%`, note: 'متوسط الهامش الإجمالي للمخزون' },
      { label: 'نسبة التحصيل %', value: `${execCollectionRate.toFixed(1)}%`, note: 'المحصل مقارنة بإجمالي المبيعات' },
      { label: 'عدد الأصناف عند/تحت الحد الأدنى', value: `${execLowStockProducts.length} صنف`, note: 'النواقص التي قد تسبب تعطل المبيعات' },
      { label: 'عدد الأصناف المرشحة لزيادة مخزون', value: `${execDeadCandidates} صنف`, note: 'أصناف تفوق 3 أضعاف الحد الأدنى' },
      { label: 'قيمة المخزون بالتكلفة', value: `${execStockCost.toLocaleString('ar-EG')} ج.م`, note: 'رأس المال المحبوس في المخزن' },
      { label: 'قيمة المخزون بسعر البيع', value: `${execStockRetail.toLocaleString('ar-EG')} ج.م`, note: 'القيمة السوقية عند تصريف كامل البضاعة' },
      { label: 'إجمالي المبيعات', value: `${execSales.toLocaleString('ar-EG')} ج.م`, note: 'فواتير المبيعات النشطة' },
      { label: 'المحصل', value: `${execPaid.toLocaleString('ar-EG')} ج.م`, note: 'النقدية والمقبوضات الفعلية' },
      { label: 'المشتريات', value: `${execPurchaseTotal.toLocaleString('ar-EG')} ج.م`, note: 'فواتير التوريد المدخلة' },
      { label: 'المصروفات', value: `${execExpenseTotal.toLocaleString('ar-EG')} ج.م`, note: 'المصروفات النثرية والتشغيلية' },
      { label: 'التقييم النهائي', value: rating.title, note: rating.desc, isHighlight: true }
    ]
  };

  return {
    stockoutData,
    purchasePlanData,
    seasonalSurgeData,
    fastMoversData,
    bulkSavingsData,
    abcData,
    deadStockData,
    stockValuationData,
    pnlData,
    bestSellersData,
    receivablesData,
    supplierBalancesData,
    expenseBreakdownData,
    inventoryTurnoverData,
    marginByProductData,
    categorySalesData,
    printingServicesData,
    vipCustomersData,
    cashFlowData,
    returnsImpactData,
    smartAlertsData,
    decisionCenterData,
    executiveDashboardData,
    healthScoreData
  };
}
