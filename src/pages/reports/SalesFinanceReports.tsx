import React from 'react';
import { fmt } from '../../lib/utils';
import { Printer, TrendingUp, TrendingDown, DollarSign, CheckCircle2 } from 'lucide-react';

interface SalesFinanceReportsProps {
  reportId: string;
  filterMonth: string;
  pnlData: {
    grossSales: number;
    returnsValue: number;
    netSales: number;
    cogs: number;
    grossProfit: number;
    totalOperatingExpenses: number;
    netOperatingProfit: number;
    netMargin: number;
  };
  bestSellersData: any[];
  categorySalesData: any[];
  printingServicesData: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    items: any[];
  };
  vipCustomersData: any[];
  receivablesData: any[];
  supplierBalancesData: any[];
  expenseBreakdownData: any[];
  cashFlowData: {
    cashSales: number;
    electronicSales: number;
    totalCashIn: number;
    expensesPaid: number;
    supplierPaid: number;
    returnsPaid: number;
    totalCashOut: number;
    netCashFlow: number;
  };
  returnsImpactData: {
    totalSalesRev: number;
    totalReturnsVal: number;
    returnRate: number;
    countReturns: number;
    items: any[];
  };
}

export const SalesFinanceReports: React.FC<SalesFinanceReportsProps> = ({
  reportId,
  filterMonth,
  pnlData,
  bestSellersData,
  categorySalesData,
  printingServicesData,
  vipCustomersData,
  receivablesData,
  supplierBalancesData,
  expenseBreakdownData,
  cashFlowData,
  returnsImpactData
}) => {
  if (reportId === 'pnl') {
    return (
      <div className="space-y-4">
        <h4 className="font-bold text-base text-slate-900 pb-2 border-b border-slate-100">
          قائمة الأرباح والخسائر الشاملة لشهر ({filterMonth})
        </h4>

        <div className="divide-y divide-slate-100 text-sm">
          <div className="py-3 flex justify-between">
            <span className="font-semibold text-slate-800">إجمالي المبيعات الإجمالية</span>
            <span className="font-mono font-bold text-slate-900">{fmt(pnlData.grossSales)} ج.م</span>
          </div>
          <div className="py-3 flex justify-between text-rose-700 bg-rose-50/50 px-2 rounded-lg">
            <span>(-) مردودات ومسموحات المبيعات</span>
            <span className="font-mono font-bold">-{fmt(pnlData.returnsValue)} ج.م</span>
          </div>
          <div className="py-3.5 flex justify-between font-bold bg-slate-100 px-3 rounded-xl text-slate-900">
            <span>صافي إيرادات المبيعات النشطة</span>
            <span className="font-mono font-black text-base">{fmt(pnlData.netSales)} ج.م</span>
          </div>
          <div className="py-3 flex justify-between text-rose-700 bg-rose-50/50 px-2 rounded-lg">
            <span>(-) تكلفة البضاعة المباعة (COGS)</span>
            <span className="font-mono font-bold">-{fmt(pnlData.cogs)} ج.م</span>
          </div>
          <div className="py-3.5 flex justify-between font-bold bg-emerald-50 px-3 rounded-xl text-emerald-800 border border-emerald-200">
            <span>مجمل الربح التجاري (Gross Profit)</span>
            <span className="font-mono font-black text-base">+{fmt(pnlData.grossProfit)} ج.م</span>
          </div>
          <div className="py-3 flex justify-between text-rose-700 bg-rose-50/50 px-2 rounded-lg">
            <span>(-) المصروفات التشغيلية والإدارية والنثرية</span>
            <span className="font-mono font-bold">-{fmt(pnlData.totalOperatingExpenses)} ج.م</span>
          </div>
          <div className="py-4 flex justify-between font-bold text-lg bg-amber-500 text-white px-4 rounded-2xl shadow-md shadow-amber-500/20">
            <span>صافي أرباح النشاط النهائي (Net Operating Profit)</span>
            <span className="font-mono font-black">
              +{fmt(pnlData.netOperatingProfit)} ج.م ({pnlData.netMargin.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (reportId === 'bestsellers') {
    return (
      <div className="space-y-4">
        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الترتيب</th>
                <th className="p-3">الصنف</th>
                <th className="p-3 text-center">الكمية المباعة</th>
                <th className="p-3 text-center">إجمالي الإيراد</th>
                <th className="p-3 text-center">هامش الربح المحقق</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bestSellersData.map((it, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-bold font-mono">
                    <span className="w-6 h-6 rounded-lg bg-amber-600 text-white text-xs font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-900 text-sm">{it.name}</td>
                  <td className="p-3 text-center font-mono font-black text-amber-700 text-sm">{it.qty}</td>
                  <td className="p-3 text-center font-mono font-bold text-slate-800">{fmt(it.revenue)} ج</td>
                  <td className="p-3 text-center font-mono text-emerald-600 font-black text-sm">
                    +{fmt(it.profit)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'receivables_aging') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex justify-between items-center">
          <span className="text-xs text-blue-900 font-bold">إجمالي الذمم والديون الآجلة المستحقة طرف العملاء:</span>
          <b className="text-2xl font-black text-blue-950 font-mono">
            {fmt(receivablesData.reduce((s, c) => s + c.due, 0))} ج.م
          </b>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">اسم العميل</th>
                <th className="p-3">رقم الهاتف</th>
                <th className="p-3 text-center">إجمالي المسحوبات الآجلة</th>
                <th className="p-3 text-center">المسدد فعلياً</th>
                <th className="p-3 text-center">الرصيد المتبقي المستحق</th>
                <th className="p-3 text-center">نقاط الولاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receivablesData.map(c => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{c.name}</td>
                  <td className="p-3 font-mono text-slate-600">{c.phone}</td>
                  <td className="p-3 text-center font-mono font-bold">{fmt(c.invoiced)} ج</td>
                  <td className="p-3 text-center font-mono text-emerald-600 font-bold">{fmt(c.paid)} ج</td>
                  <td className="p-3 text-center font-mono font-black text-rose-600 text-sm">
                    {fmt(c.due)} ج.م
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-amber-700">{c.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'supplier_balances') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 flex justify-between items-center">
          <span className="text-xs text-purple-900 font-bold">إجمالي المستحقات والمديونيات للموردين:</span>
          <b className="text-2xl font-black text-purple-950 font-mono">
            {fmt(supplierBalancesData.reduce((s, sp) => s + sp.due, 0))} ج.م
          </b>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">اسم المورد / الشركة</th>
                <th className="p-3">رقم الهاتف</th>
                <th className="p-3 text-center">إجمالي فواتير الشراء</th>
                <th className="p-3 text-center">المدفوع للمورد</th>
                <th className="p-3 text-center">المتبقي المطلوب سداده</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supplierBalancesData.map(sp => (
                <tr key={sp.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{sp.name}</td>
                  <td className="p-3 font-mono text-slate-600">{sp.phone}</td>
                  <td className="p-3 text-center font-mono font-bold">{fmt(sp.invoiced)} ج</td>
                  <td className="p-3 text-center font-mono text-emerald-600 font-bold">{fmt(sp.paid)} ج</td>
                  <td className="p-3 text-center font-mono font-black text-purple-700 text-sm">
                    {fmt(sp.due)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'expense_breakdown') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center">
          <span className="text-xs text-slate-700 font-bold">إجمالي المصروفات لشهر ({filterMonth}):</span>
          <b className="text-2xl font-black text-slate-900 font-mono">
            {fmt(expenseBreakdownData.reduce((s, e) => s + e.amount, 0))} ج.م
          </b>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-200">
              <tr>
                <th className="p-3">بند المصروف</th>
                <th className="p-3 text-center">المبلغ المنصرف</th>
                <th className="p-3 text-center">النسبة من إجمالي المصروفات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenseBreakdownData.map((e, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{e.category}</td>
                  <td className="p-3 text-center font-mono font-black text-rose-600 text-sm">
                    {fmt(e.amount)} ج.م
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-slate-700">%{e.share}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'category_sales') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs text-slate-500 font-bold block">عدد الأقسام النشطة</span>
            <b className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {categorySalesData.length}
            </b>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
            <span className="text-xs text-emerald-800 font-bold block">إجمالي مبيعات الأقسام</span>
            <b className="text-2xl font-black text-emerald-900 font-mono mt-1 block">
              {fmt(categorySalesData.reduce((s, c) => s + c.revenue, 0))} ج.م
            </b>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <span className="text-xs text-amber-800 font-bold block">صافي أرباح الأقسام</span>
            <b className="text-2xl font-black text-amber-900 font-mono mt-1 block">
              +{fmt(categorySalesData.reduce((s, c) => s + c.profit, 0))} ج.م
            </b>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
            <span className="text-xs text-blue-800 font-bold block">القسم الأكثر مبيعاً</span>
            <b className="text-sm font-black text-blue-900 mt-1 block line-clamp-1">
              {categorySalesData[0]?.category || 'لا توجد بيانات'}
            </b>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-200">
              <tr>
                <th className="p-3">القسم / الفئة</th>
                <th className="p-3 text-center">عدد الأصناف</th>
                <th className="p-3 text-center">القطع المباعة</th>
                <th className="p-3 text-center">إجمالي الإيرادات</th>
                <th className="p-3 text-center">الأرباح المحققة</th>
                <th className="p-3 text-center">هامش الربح</th>
                <th className="p-3 text-center">المساهمة في المبيعات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {categorySalesData.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900 text-sm">{c.category}</td>
                  <td className="p-3 text-center font-mono">{c.count}</td>
                  <td className="p-3 text-center font-mono font-bold text-amber-700">{c.qtySold}</td>
                  <td className="p-3 text-center font-mono font-bold text-slate-900">{fmt(c.revenue)} ج</td>
                  <td className="p-3 text-center font-mono font-black text-emerald-600 text-sm">
                    +{fmt(c.profit)} ج.م
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-blue-700">%{c.margin}</td>
                  <td className="p-3 text-center font-mono font-black text-slate-800">
                    <div className="flex items-center justify-center gap-1.5">
                      <div className="w-12 bg-slate-200 h-2 rounded-full overflow-hidden hidden sm:block">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, c.share)}%` }} />
                      </div>
                      <span>%{c.share}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'printing_services') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
            <span className="text-xs text-emerald-800 font-bold block">إيراد خدمات التصوير والطباعة</span>
            <b className="text-2xl font-black text-emerald-900 font-mono mt-1 block">
              {fmt(printingServicesData.totalRevenue)} ج.م
            </b>
          </div>
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
            <span className="text-xs text-rose-800 font-bold block">التكلفة التشغيلية (أحبار وورق)</span>
            <b className="text-2xl font-black text-rose-900 font-mono mt-1 block">
              {fmt(printingServicesData.totalCost)} ج.م
            </b>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <span className="text-xs text-amber-800 font-bold block">صافي أرباح ماكينات التصوير</span>
            <b className="text-2xl font-black text-amber-900 font-mono mt-1 block">
              +{fmt(printingServicesData.totalProfit)} ج.م
            </b>
          </div>
        </div>

        {printingServicesData.items.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[450px]">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3">الخدمة / البند</th>
                  <th className="p-3 text-center">الكمية المنفذة (ورقة / خدمة)</th>
                  <th className="p-3 text-center">الإيراد المحقق</th>
                  <th className="p-3 text-center">التكلفة</th>
                  <th className="p-3 text-center">صافي الربح المحقق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printingServicesData.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{it.name}</td>
                    <td className="p-3 text-center font-mono font-bold text-amber-700">{it.qty}</td>
                    <td className="p-3 text-center font-mono font-bold">{fmt(it.revenue)} ج</td>
                    <td className="p-3 text-center font-mono text-rose-600">{fmt(it.cost)} ج</td>
                    <td className="p-3 text-center font-mono font-black text-emerald-600 text-sm">
                      +{fmt(it.profit)} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
            <Printer className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <h5 className="font-bold text-slate-800 text-sm">لم يتم تسجيل خدمات طباعة أو تصوير في فواتير هذا الشهر بعد</h5>
            <p className="text-xs text-slate-500 font-medium mt-1">عند بيع خدمات التصوير والطباعة والتجليد ستظهر تفاصيلها وأرباحها فوراً هنا</p>
          </div>
        )}
      </div>
    );
  }

  if (reportId === 'vip_customers') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <b className="text-sm font-bold text-amber-950 block">قائمة كبار العملاء الأكثر شراءً وإيراداً (VIP)</b>
            <p className="text-xs text-amber-800 font-medium">
              ترتيب العملاء حسب إجمالي المبالغ المنفقة وصافي الأرباح المحققة مع نقاط الولاء المجمعة.
            </p>
          </div>
          <span className="font-bold text-amber-900 bg-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-mono">
            {vipCustomersData.length} عميل
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الترتيب</th>
                <th className="p-3">اسم العميل</th>
                <th className="p-3">رقم الهاتف</th>
                <th className="p-3 text-center">عدد الفواتير</th>
                <th className="p-3 text-center">إجمالي المشتريات</th>
                <th className="p-3 text-center">صافي الأرباح المحققة</th>
                <th className="p-3 text-center">نقاط الولاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vipCustomersData.map((c, idx) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold font-mono">
                    <span className="w-6 h-6 rounded-lg bg-amber-600 text-white text-xs font-black flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-900 text-sm">{c.name}</td>
                  <td className="p-3 font-mono text-slate-600">{c.phone}</td>
                  <td className="p-3 text-center font-mono font-bold">{c.invoicesCount}</td>
                  <td className="p-3 text-center font-mono font-black text-slate-900 text-sm">
                    {fmt(c.totalSpent)} ج.م
                  </td>
                  <td className="p-3 text-center font-mono font-black text-emerald-600 text-sm">
                    +{fmt(c.totalProfit)} ج.م
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-amber-700">{c.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'cash_flow') {
    return (
      <div className="space-y-4">
        <h4 className="font-bold text-base text-slate-900 pb-2 border-b border-slate-100">
          حركة السيولة والتدفق النقدي الفعلي للخزينة لشهر ({filterMonth})
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Cash In */}
          <div className="p-5 rounded-3xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <b className="text-sm font-bold text-emerald-950">المقبوضات الداخلة (Cash In)</b>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="space-y-2 text-xs divide-y divide-emerald-200/60">
              <div className="pt-2 flex justify-between">
                <span className="text-slate-700">المبيعات النقدية (كاش الخزينة):</span>
                <b className="font-mono font-bold text-emerald-900">{fmt(cashFlowData.cashSales)} ج</b>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-700">المبيعات الإلكترونية (فيزا / محافظ):</span>
                <b className="font-mono font-bold text-emerald-900">{fmt(cashFlowData.electronicSales)} ج</b>
              </div>
            </div>
            <div className="pt-3 border-t border-emerald-300 flex justify-between items-center font-bold">
              <span className="text-emerald-950 text-xs">إجمالي التدفق الداخل:</span>
              <b className="text-lg font-black font-mono text-emerald-800">+{fmt(cashFlowData.totalCashIn)} ج.م</b>
            </div>
          </div>

          {/* Cash Out */}
          <div className="p-5 rounded-3xl bg-rose-50/70 border border-rose-200 space-y-3">
            <div className="flex items-center justify-between">
              <b className="text-sm font-bold text-rose-950">المدفوعات الخارجة (Cash Out)</b>
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
            <div className="space-y-2 text-xs divide-y divide-rose-200/60">
              <div className="pt-2 flex justify-between">
                <span className="text-slate-700">المصروفات التشغيلية والنثرية:</span>
                <b className="font-mono font-bold text-rose-900">{fmt(cashFlowData.expensesPaid)} ج</b>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-700">سداد فواتير الموردين:</span>
                <b className="font-mono font-bold text-rose-900">{fmt(cashFlowData.supplierPaid)} ج</b>
              </div>
              <div className="pt-2 flex justify-between">
                <span className="text-slate-700">المبالغ المستردة للمرتجعات:</span>
                <b className="font-mono font-bold text-rose-900">{fmt(cashFlowData.returnsPaid)} ج</b>
              </div>
            </div>
            <div className="pt-3 border-t border-rose-300 flex justify-between items-center font-bold">
              <span className="text-rose-950 text-xs">إجمالي التدفق الخارج:</span>
              <b className="text-lg font-black font-mono text-rose-800">-{fmt(cashFlowData.totalCashOut)} ج.م</b>
            </div>
          </div>

          {/* Net Cash Flow */}
          <div className="p-5 rounded-3xl bg-slate-900 text-white space-y-4 flex flex-col justify-between shadow-md">
            <div>
              <div className="flex items-center justify-between mb-2">
                <b className="text-sm font-bold text-slate-100">صافي التدفق النقدي الفعلي</b>
                <DollarSign className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-xs text-slate-400 font-medium">
                الفائض أو العجز النقدي الفعلي المتحرك في الخزينة والحسابات خلال الشهر
              </p>
            </div>
            <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-center">
              <span className="text-xs text-slate-400 block mb-1">صافي السيولة النقدية المتولدة:</span>
              <b className={`text-2xl font-black font-mono ${cashFlowData.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {cashFlowData.netCashFlow >= 0 ? '+' : ''}{fmt(cashFlowData.netCashFlow)} ج.م
              </b>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (reportId === 'returns_impact') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs text-slate-500 font-bold block">إجمالي مبيعات الشهر</span>
            <b className="text-xl font-bold text-slate-900 font-mono mt-1 block">
              {fmt(returnsImpactData.totalSalesRev)} ج.م
            </b>
          </div>
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
            <span className="text-xs text-rose-800 font-bold block">قيمة المرتجعات</span>
            <b className="text-xl font-black text-rose-900 font-mono mt-1 block">
              -{fmt(returnsImpactData.totalReturnsVal)} ج.م
            </b>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <span className="text-xs text-amber-800 font-bold block">نسبة الارتجاع المالي</span>
            <b className="text-xl font-black text-amber-900 font-mono mt-1 block">
              %{returnsImpactData.returnRate}
            </b>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
            <span className="text-xs text-blue-800 font-bold block">عدد الفواتير المرتجعة</span>
            <b className="text-xl font-bold text-blue-900 font-mono mt-1 block">
              {returnsImpactData.countReturns} عملية
            </b>
          </div>
        </div>

        {returnsImpactData.items.length > 0 ? (
          <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[450px]">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3">الصنف المرتجع</th>
                  <th className="p-3 text-center">الكمية المرتجعة</th>
                  <th className="p-3 text-center">الخسارة المالية الإجمالية</th>
                  <th className="p-3">السبب المسجل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {returnsImpactData.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{it.name}</td>
                    <td className="p-3 text-center font-mono font-bold text-rose-600">{it.qty}</td>
                    <td className="p-3 text-center font-mono font-black text-rose-700 text-sm">
                      -{fmt(it.totalLoss)} ج.م
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{it.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <h5 className="font-bold text-slate-800 text-sm">لا توجد أي مرتجعات مسجلة في هذا الشهر حتى الآن</h5>
            <p className="text-xs text-slate-500 font-medium mt-1">معدل الإرجاع ممتاز (0%) ولا يوجد تسرب مالي مسجل</p>
          </div>
        )}
      </div>
    );
  }

  return null;
};
