import React from 'react';
import { fmt } from '../../lib/utils';

interface InventoryReportsProps {
  reportId: string;
  abcData: any[];
  deadStockData: any[];
  stockValuationData: {
    totalUnits: number;
    totalCost: number;
    totalRetail: number;
    totalProfit: number;
    categories: any[];
  };
  inventoryTurnoverData: any[];
  marginByProductData: any[];
}

export const InventoryReports: React.FC<InventoryReportsProps> = ({
  reportId,
  abcData,
  deadStockData,
  stockValuationData,
  inventoryTurnoverData,
  marginByProductData
}) => {
  if (reportId === 'abc_analysis') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
            <b className="text-emerald-900 text-sm block">الفئة A (العمود الفقري)</b>
            <p className="text-emerald-700 mt-1">
              تولد 80% من إجمالي الإيرادات. يجب عدم السماح بنفادها أبداً ومراقبتها يومياً.
            </p>
            <b className="text-lg font-mono text-emerald-900 mt-2 block">
              {abcData.filter(p => p.tier === 'A').length} صنف
            </b>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <b className="text-amber-900 text-sm block">الفئة B (الأصناف المتوسطة)</b>
            <p className="text-amber-700 mt-1">تولد 15% من الإيرادات. إدارة دورية أسبوعية.</p>
            <b className="text-lg font-mono text-amber-900 mt-2 block">
              {abcData.filter(p => p.tier === 'B').length} صنف
            </b>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <b className="text-slate-800 text-sm block">الفئة C (الأصناف الهامشية)</b>
            <p className="text-slate-600 mt-1">تولد 5% فقط من الإيرادات. تقليل كميات الشراء لتوفير سيولة.</p>
            <b className="text-lg font-mono text-slate-800 mt-2 block">
              {abcData.filter(p => p.tier === 'C').length} صنف
            </b>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الفئة (ABC)</th>
                <th className="p-3">الصنف</th>
                <th className="p-3">القسم</th>
                <th className="p-3 text-center">الكمية المباعة</th>
                <th className="p-3 text-center">الإيراد المحقق</th>
                <th className="p-3 text-center">النسبة من الإجمالي</th>
                <th className="p-3 text-center">النسبة التراكمية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {abcData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3">
                    <span
                      className={`w-7 h-7 rounded-xl font-black text-xs flex items-center justify-center ${
                        p.tier === 'A'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : p.tier === 'B'
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {p.tier}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600 font-medium">{p.category}</td>
                  <td className="p-3 text-center font-mono font-bold">{p.qtySold}</td>
                  <td className="p-3 text-center font-mono font-bold text-slate-900">{fmt(p.revenue)} ج</td>
                  <td className="p-3 text-center font-mono text-slate-600">{p.revenueShare}%</td>
                  <td className="p-3 text-center font-mono font-bold text-slate-800">{p.cumulativeShare}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'deadstock') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <b className="text-sm font-bold text-rose-950 block">
              الأصناف الراكدة المعطلة للسيولة ({deadStockData.length} صنف)
            </b>
            <p className="text-xs text-rose-800 font-medium">
              أصناف لم تسجل أي حركة سحب أو بيع خلال آخر 60 يوماً. يوصى بخصومات ومهرجانات عروض فورية.
            </p>
          </div>
          <div className="text-left">
            <span className="text-xs text-slate-600 font-bold block">إجمالي رأس المال المعطل:</span>
            <b className="text-2xl font-black text-rose-700 font-mono">
              {fmt(deadStockData.reduce((s, p) => s + p.tiedCapital, 0))} ج.م
            </b>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الصنف</th>
                <th className="p-3">الفئة</th>
                <th className="p-3 text-center">الكمية المعطلة</th>
                <th className="p-3 text-center">سعر التكلفة</th>
                <th className="p-3 text-center">سعر البيع المقترح</th>
                <th className="p-3 text-center">رأس المال المجمد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deadStockData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600 font-medium">{p.category}</td>
                  <td className="p-3 text-center font-black text-rose-600 font-mono">{p.qty}</td>
                  <td className="p-3 text-center font-mono">{fmt(p.costPrice)} ج</td>
                  <td className="p-3 text-center font-mono text-slate-700">{fmt(p.sellPrice)} ج</td>
                  <td className="p-3 text-center font-black text-rose-700 font-mono text-sm">
                    {fmt(p.tiedCapital)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'stock_valuation') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs text-slate-500 font-bold block">إجمالي عدد القطع بالمخزن</span>
            <b className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {stockValuationData.totalUnits}
            </b>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <span className="text-xs text-amber-800 font-bold block">قيمة المخزون بالتكلفة (رأس المال)</span>
            <b className="text-2xl font-black text-amber-900 font-mono mt-1 block">
              {fmt(stockValuationData.totalCost)} ج.م
            </b>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
            <span className="text-xs text-blue-800 font-bold block">قيمة المخزون بسعر البيع (المتوقع)</span>
            <b className="text-2xl font-black text-blue-900 font-mono mt-1 block">
              {fmt(stockValuationData.totalRetail)} ج.م
            </b>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
            <span className="text-xs text-emerald-800 font-bold block">الأرباح الكامنة بالمخزن</span>
            <b className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
              +{fmt(stockValuationData.totalProfit)} ج.م
            </b>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-200">
              <tr>
                <th className="p-3">الفئة / القسم</th>
                <th className="p-3 text-center">عدد الأصناف</th>
                <th className="p-3 text-center">إجمالي القطع</th>
                <th className="p-3 text-center">القيمة بالتكلفة</th>
                <th className="p-3 text-center">القيمة بسعر البيع</th>
                <th className="p-3 text-center">نسبة هامش الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockValuationData.categories.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{c.name}</td>
                  <td className="p-3 text-center font-mono">{c.count}</td>
                  <td className="p-3 text-center font-mono font-bold">{c.units}</td>
                  <td className="p-3 text-center font-mono text-amber-800 font-bold">{fmt(c.cost)} ج</td>
                  <td className="p-3 text-center font-mono text-blue-800 font-bold">{fmt(c.retail)} ج</td>
                  <td className="p-3 text-center font-mono font-black text-emerald-600 text-sm">%{c.margin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'inventory_turnover') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <b className="text-sm font-bold text-blue-950 block">تحليل كفاءة ودوران المخزون (Turnover Ratio)</b>
            <p className="text-xs text-blue-800 font-medium">
              قياس سرعة تحويل الأصناف المخزنة إلى مبيعات كاش وتحديد عدد الأيام التقريبية لبقاء البضاعة في الرف.
            </p>
          </div>
          <div className="flex gap-2">
            <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1.5 rounded-xl text-xs border border-emerald-200">
              سريع: {inventoryTurnoverData.filter(p => p.speed === 'دوران سريع جداً').length}
            </span>
            <span className="bg-amber-100 text-amber-800 font-bold px-3 py-1.5 rounded-xl text-xs border border-amber-200">
              متوسط: {inventoryTurnoverData.filter(p => p.speed === 'دوران متوسط').length}
            </span>
            <span className="bg-rose-100 text-rose-800 font-bold px-3 py-1.5 rounded-xl text-xs border border-rose-200">
              بطيء / راكد: {inventoryTurnoverData.filter(p => p.speed === 'بطيء الحركة' || p.speed === 'عديم الحركة').length}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الصنف</th>
                <th className="p-3">الفئة</th>
                <th className="p-3 text-center">الرصيد بالمخزن</th>
                <th className="p-3 text-center">المبيعات (30 يوم)</th>
                <th className="p-3 text-center">معدل الدوران</th>
                <th className="p-3 text-center">أيام بقاء المخزون</th>
                <th className="p-3 text-center">تقييم السرعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inventoryTurnoverData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600 font-medium">{p.category}</td>
                  <td className="p-3 text-center font-mono font-bold">{p.qty}</td>
                  <td className="p-3 text-center font-mono font-bold text-amber-700">{p.soldUnits} قطعة</td>
                  <td className="p-3 text-center font-mono font-black text-slate-900 text-sm">
                    {p.turnoverRatio}x
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-slate-700">
                    {p.daysOfInventory === 999 ? 'غير محدد' : `${p.daysOfInventory} يوم`}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        p.speed === 'دوران سريع جداً'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : p.speed === 'دوران متوسط'
                          ? 'bg-blue-100 text-blue-800 border border-blue-300'
                          : p.speed === 'بطيء الحركة'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-rose-100 text-rose-800 border border-rose-300'
                      }`}
                    >
                      {p.speed}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'margin_by_product') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <b className="text-sm font-bold text-amber-950 block">تحليل هوامش الربحية ونسب الربح لكل صنف</b>
            <p className="text-xs text-amber-800 font-medium">
              ترتيب المنتجات من الأعلى ربحية إلى الأقل لمساعدتك في تسعير المنتجات وتقديم عروض تنافسية.
            </p>
          </div>
          <span className="font-bold text-amber-900 bg-amber-200/80 px-3 py-1.5 rounded-xl text-xs font-mono">
            {marginByProductData.length} منتج مسجل
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الصنف</th>
                <th className="p-3">القسم</th>
                <th className="p-3 text-center">سعر التكلفة</th>
                <th className="p-3 text-center">سعر البيع</th>
                <th className="p-3 text-center">ربح القطعة</th>
                <th className="p-3 text-center">نسبة هامش الربح</th>
                <th className="p-3 text-center">إجمالي أرباح 30 يوم</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {marginByProductData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600 font-medium">{p.category}</td>
                  <td className="p-3 text-center font-mono">{fmt(p.cost)} ج</td>
                  <td className="p-3 text-center font-mono font-bold text-slate-900">{fmt(p.sell)} ج</td>
                  <td className="p-3 text-center font-mono text-emerald-700 font-bold">+{fmt(p.profitPerUnit)} ج</td>
                  <td className="p-3 text-center font-mono font-black text-sm">
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        p.marginPercent >= 40
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.marginPercent >= 20
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      %{p.marginPercent}
                    </span>
                  </td>
                  <td className="p-3 text-center font-mono font-black text-emerald-600 text-sm">
                    {p.totalProfit > 0 ? `+${fmt(p.totalProfit)} ج` : '0 ج'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return null;
};
