import * as XLSX from 'xlsx';
import { productFullName } from '../utils';

export function exportReportToExcel({
  reportId,
  meta,
  filterMonth,
  reportsData,
  allProducts,
  toast
}: {
  reportId: string;
  meta: any;
  filterMonth: string;
  reportsData: any;
  allProducts: any[];
  toast: (msg: string) => void;
}) {
  if (!meta) return;

  const title = `${meta.title} - شهر (${filterMonth})`;
  let rows: any[][] = [];

  const {
    stockoutData,
    purchasePlanData,
    seasonalSurgeData,
    fastMoversData,
    bulkSavingsData,
    abcData,
    deadStockData,
    inventoryTurnoverData,
    stockValuationData,
    marginByProductData,
    pnlData,
    bestSellersData,
    categorySalesData,
    printingServicesData,
    vipCustomersData,
    receivablesData,
    supplierBalancesData,
    expenseBreakdownData,
    cashFlowData,
    returnsImpactData,
    smartAlertsData,
    decisionCenterData,
    executiveDashboardData,
    healthScoreData
  } = reportsData;

  if (reportId === 'forecast_stockout') {
    rows = [
      [title],
      ['الصنف', 'الفئة', 'الرصيد الحالي', 'مبيعات 30 يوم', 'السحب اليومي', 'الأيام المتبقية', 'الكمية المقترحة للشراء', 'الحالة'],
      ...stockoutData.map((p: any) => [
        p.name,
        p.category,
        p.qty,
        p.sold30,
        p.dailyVelocity,
        p.daysRemaining === 999 ? 'غير محدد' : p.daysRemaining,
        p.suggestedQty,
        p.status
      ])
    ];
  } else if (reportId === 'purchase_order_plan') {
    rows = [
      [title],
      ['الصنف', 'الفئة', 'الرصيد الحالي', 'حد الطلب الأدنى', 'الكمية المقترحة للطلب', 'سعر التكلفة المتوقع', 'إجمالي التكلفة المقدرة'],
      ...purchasePlanData.map((p: any) => [
        p.name,
        p.category,
        p.qty,
        p.minQty,
        p.orderQty,
        p.costPrice,
        p.estimatedCost
      ])
    ];
  } else if (reportId === 'seasonal_surge') {
    rows = [
      [title],
      ['الصنف', 'الفئة', 'المتوفر حالياً', 'الطلب العادي الشهري', 'الطلب الموسمي المقدر', 'الكمية الإضافية المطلوبة', 'تكلفة التجهيز', 'الأرباح المتوقعة'],
      ...seasonalSurgeData.map((p: any) => [
        p.name,
        p.category,
        p.currentQty,
        p.baseDemand,
        p.seasonalDemand,
        p.neededQty,
        p.costToStock,
        p.expectedProfit
      ])
    ];
  } else if (reportId === 'fast_movers') {
    rows = [
      [title],
      ['الصنف', 'الفئة', 'المباع في 30 يوم', 'معدل السحب اليومي', 'المتبقي في الرف', 'أيام الصمود المتوقعة', 'الإجراء الموصى به'],
      ...fastMoversData.map((p: any) => [
        p.name,
        p.category,
        p.sold30,
        p.dailyVelocity,
        p.qty,
        p.daysRemaining,
        'طلب عاجل الآن'
      ])
    ];
  } else if (reportId === 'bulk_savings') {
    rows = [
      [title],
      ['الصنف', 'تكلفة القطعة الحالية', 'تكلفة الجملة المقدرة', 'سعر البيع للجمهور', 'الوفر المالي لكل 100 قطعة', 'زيادة هامش الربح'],
      ...bulkSavingsData.map((p: any) => [
        p.name,
        p.singleCost,
        p.bulkCostEst,
        p.sellPrice,
        p.savingsPer100,
        `+${p.marginGain}%`
      ])
    ];
  } else if (reportId === 'abc_analysis') {
    rows = [
      [title],
      ['الفئة ABC', 'الصنف', 'القسم', 'الكمية المباعة', 'الإيراد المحقق', 'النسبة من الإجمالي', 'النسبة التراكمية'],
      ...abcData.map((p: any) => [
        p.tier,
        p.name,
        p.category,
        p.qtySold,
        p.revenue,
        `${p.revenueShare}%`,
        `${p.cumulativeShare}%`
      ])
    ];
  } else if (reportId === 'deadstock') {
    rows = [
      [title],
      ['الصنف', 'الفئة', 'الكمية الراكدة', 'سعر التكلفة', 'سعر البيع المقترح', 'رأس المال المعطل'],
      ...deadStockData.map((p: any) => [
        p.name,
        p.category,
        p.qty,
        p.costPrice,
        p.sellPrice,
        p.tiedCapital
      ])
    ];
  } else if (reportId === 'inventory_turnover') {
    rows = [
      [title],
      ['الصنف', 'الفئة', 'الرصيد بالمخزن', 'تكلفة القطعة', 'القطع المباعة', 'معدل دوران المخزون', 'أيام بقاء المخزون', 'تقييم السرعة'],
      ...inventoryTurnoverData.map((p: any) => [
        p.name,
        p.category,
        p.qty,
        p.costPrice,
        p.soldUnits,
        p.turnoverRatio,
        p.daysOfInventory === 999 ? 'غير محدد' : p.daysOfInventory,
        p.speed
      ])
    ];
  } else if (reportId === 'stock_valuation') {
    rows = [
      [title],
      ['إجمالي القطع', stockValuationData.totalUnits],
      ['إجمالي التكلفة (رأس المال)', stockValuationData.totalCost],
      ['إجمالي القيمة بسعر البيع', stockValuationData.totalRetail],
      ['الأرباح الكامنة المتوقعة', stockValuationData.totalProfit],
      [],
      ['الفئة / القسم', 'عدد الأصناف', 'إجمالي القطع', 'القيمة بالتكلفة', 'القيمة بسعر البيع', 'نسبة هامش الربح'],
      ...stockValuationData.categories.map((c: any) => [
        c.name,
        c.count,
        c.units,
        c.cost,
        c.retail,
        `%${c.margin}`
      ])
    ];
  } else if (reportId === 'margin_by_product') {
    rows = [
      [title],
      ['الصنف', 'القسم', 'الماركة', 'سعر التكلفة', 'سعر البيع', 'ربح القطعة', 'نسبة هامش الربح', 'المبيعات', 'إجمالي الأرباح المحققة'],
      ...marginByProductData.map((p: any) => [
        p.name,
        p.category,
        p.brand,
        p.cost,
        p.sell,
        p.profitPerUnit,
        `%${p.marginPercent}`,
        p.soldUnits,
        p.totalProfit
      ])
    ];
  } else if (reportId === 'pnl') {
    rows = [
      [title],
      ['البند', 'القيمة (ج.م)'],
      ['إجمالي المبيعات الإجمالية', pnlData.grossSales],
      ['(-) مردودات المبيعات', pnlData.returnsValue],
      ['صافي إيراد المبيعات', pnlData.netSales],
      ['(-) تكلفة البضاعة المباعة COGS', pnlData.cogs],
      ['مجمل الربح Gross Profit', pnlData.grossProfit],
      ['(-) المصروفات التشغيلية', pnlData.totalOperatingExpenses],
      ['صافي أرباح النشاط Net Profit', pnlData.netOperatingProfit],
      ['نسبة هامش الربح الصافي', `${pnlData.netMargin.toFixed(2)}%`]
    ];
  } else if (reportId === 'bestsellers') {
    rows = [
      [title],
      ['الترتيب', 'الصنف', 'الكمية المباعة', 'إجمالي الإيراد', 'صافي الأرباح المحققة'],
      ...bestSellersData.map((p: any, idx: number) => [
        idx + 1,
        p.name,
        p.qty,
        p.revenue,
        p.profit
      ])
    ];
  } else if (reportId === 'category_sales') {
    rows = [
      [title],
      ['القسم / الفئة', 'عدد الأصناف', 'الكمية المباعة', 'إجمالي الإيرادات', 'الأرباح المحققة', 'هامش الربح', 'النسبة من إجمالي المبيعات'],
      ...categorySalesData.map((c: any) => [
        c.category,
        c.count,
        c.qtySold,
        c.revenue,
        c.profit,
        `%${c.margin}`,
        `%${c.share}`
      ])
    ];
  } else if (reportId === 'printing_services') {
    rows = [
      [title],
      ['إجمالي الإيرادات', printingServicesData.totalRevenue],
      ['التكلفة التشغيلية', printingServicesData.totalCost],
      ['صافي ربح خدمات الطباعة', printingServicesData.totalProfit],
      [],
      ['الخدمة / البند', 'الكمية المنفذة', 'الإيراد المحقق', 'التكلفة', 'صافي الربح'],
      ...printingServicesData.items.map((it: any) => [
        it.name,
        it.qty,
        it.revenue,
        it.cost,
        it.profit
      ])
    ];
  } else if (reportId === 'vip_customers') {
    rows = [
      [title],
      ['الترتيب', 'اسم العميل', 'رقم الهاتف', 'عدد الفواتير', 'إجمالي المشتريات', 'صافي الربح المحقق', 'نقاط الولاء'],
      ...vipCustomersData.map((c: any, idx: number) => [
        idx + 1,
        c.name,
        c.phone,
        c.invoicesCount,
        c.totalSpent,
        c.totalProfit,
        c.points
      ])
    ];
  } else if (reportId === 'receivables_aging') {
    rows = [
      [title],
      ['اسم العميل', 'رقم الهاتف', 'إجمالي المسحوبات الآجلة', 'المسدد فعلياً', 'الرصيد المتبقي المستحق', 'نقاط الولاء'],
      ...receivablesData.map((c: any) => [
        c.name,
        c.phone,
        c.invoiced,
        c.paid,
        c.due,
        c.points
      ])
    ];
  } else if (reportId === 'supplier_balances') {
    rows = [
      [title],
      ['اسم المورد / الشركة', 'رقم الهاتف', 'إجمالي فواتير الشراء', 'المدفوع للمورد', 'المتبقي المطلوب سداده'],
      ...supplierBalancesData.map((sp: any) => [
        sp.name,
        sp.phone,
        sp.invoiced,
        sp.paid,
        sp.due
      ])
    ];
  } else if (reportId === 'expense_breakdown') {
    rows = [
      [title],
      ['بند المصروف', 'المبلغ المنصرف', 'النسبة من إجمالي المصروفات'],
      ...expenseBreakdownData.map((e: any) => [
        e.category,
        e.amount,
        `%${e.share}`
      ])
    ];
  } else if (reportId === 'cash_flow') {
    rows = [
      [title],
      ['المقبوضات النقدية (الكاش)', cashFlowData.cashSales],
      ['المقبوضات الإلكترونية (فيزا / فودافون كاش / انستاباي)', cashFlowData.electronicSales],
      ['إجمالي التدفق النقدي الداخل (Cash In)', cashFlowData.totalCashIn],
      [],
      ['المصروفات التشغيلية المدفوعة', cashFlowData.expensesPaid],
      ['المدفوعات للموردين', cashFlowData.supplierPaid],
      ['المبالغ المستردة للعملاء (المرتجعات)', cashFlowData.returnsPaid],
      ['إجمالي التدفق النقدي الخارج (Cash Out)', cashFlowData.totalCashOut],
      [],
      ['صافي التدفق النقدي (Net Cash Flow)', cashFlowData.netCashFlow]
    ];
  } else if (reportId === 'returns_impact') {
    rows = [
      [title],
      ['إجمالي المبيعات', returnsImpactData.totalSalesRev],
      ['إجمالي قيمة المرتجعات', returnsImpactData.totalReturnsVal],
      ['معدل الارتجاع المالي', `%${returnsImpactData.returnRate}`],
      ['عدد عمليات الإرجاع', returnsImpactData.countReturns],
      [],
      ['الصنف المرتجع', 'الكمية المسترجعة', 'الخسارة المالية الإجمالية', 'السبب المسجل'],
      ...returnsImpactData.items.map((it: any) => [
        it.name,
        it.qty,
        it.totalLoss,
        it.reason
      ])
    ];
  } else if (reportId === 'smart_alerts') {
    rows = [
      [title],
      ['المستوى', 'نص التنبيه الرقابي', 'الإجراء الموصى به'],
      ...smartAlertsData.map((a: any) => [a.levelLabel, a.message, a.action])
    ];
  } else if (reportId === 'decision_center') {
    rows = [
      [title],
      ['الأولوية', 'المجال', 'القرار المقترح', 'الإجراء الإداري الموصى به'],
      ...decisionCenterData.map((d: any) => [d.priority, d.level, d.decision, d.recommendedAction])
    ];
  } else if (reportId === 'executive_dashboard') {
    rows = [
      [title],
      ['المؤشر التنفيذي', 'القيمة', 'ملاحظات'],
      ...executiveDashboardData.tableRows.map((r: any) => [r.label, r.value, r.note]),
      [],
      ['التنبيهات والإشارات التحذيرية'],
      ...executiveDashboardData.textAlerts.map((a: any) => [a.text])
    ];
  } else if (reportId === 'business_health_score') {
    rows = [
      [title],
      ['مؤشر صحة النشاط النهائي', `${healthScoreData.score} / 100`, healthScoreData.rating.title],
      [],
      ['المكون التفصيلي', 'النقاط المحققة', 'الحد الأقصى', 'التفاصيل'],
      ...healthScoreData.components.map((c: any) => [c.label, c.score, c.max, c.desc]),
      [],
      ['المؤشر', 'القيمة', 'ملاحظات'],
      ...healthScoreData.tableRows.map((r: any) => [r.label, r.value, r.note])
    ];
  } else {
    rows = [
      [title],
      ['الصنف/البند', 'البيانات'],
      ...allProducts.slice(0, 50).map((p: any) => [productFullName(p), p.qty, p.costPrice, p.sellPrice])
    ];
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'التقرير');
  XLSX.writeFile(wb, `${meta.id}-${filterMonth}.xlsx`);
  toast('تم تصدير التقرير إلى ملف Excel بنجاح');
}
