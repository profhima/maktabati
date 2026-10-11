import React from 'react';
import { fmt } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';

interface PredictionsReportsProps {
  reportId: string;
  stockoutData: any[];
  purchasePlanData: any[];
  seasonalSurgeData: any[];
  fastMoversData: any[];
  bulkSavingsData: any[];
  seasonalMultiplier: number;
}

export const PredictionsReports: React.FC<PredictionsReportsProps> = ({
  reportId,
  stockoutData,
  purchasePlanData,
  seasonalSurgeData,
  fastMoversData,
  bulkSavingsData,
  seasonalMultiplier
}) => {
  if (reportId === 'forecast_stockout') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs text-slate-500 font-bold block">إجمالي الأصناف المفحوصة</span>
            <b className="text-xl font-bold text-slate-900 font-mono mt-1 block">{stockoutData.length}</b>
          </div>
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200">
            <span className="text-xs text-rose-700 font-bold block">أصناف قاربت على النفاد (≤ 5 أيام)</span>
            <b className="text-xl font-bold text-rose-700 font-mono mt-1 block">
              {stockoutData.filter(p => p.daysRemaining <= 5).length}
            </b>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <span className="text-xs text-amber-800 font-bold block">أصناف تحتاج إعادة طلب (≤ 15 يوم)</span>
            <b className="text-xl font-bold text-amber-800 font-mono mt-1 block">
              {stockoutData.filter(p => p.daysRemaining <= 15).length}
            </b>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
            <span className="text-xs text-emerald-800 font-bold block">أصناف مستقرة المخزون</span>
            <b className="text-xl font-bold text-emerald-800 font-mono mt-1 block">
              {stockoutData.filter(p => p.daysRemaining > 15).length}
            </b>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الصنف</th>
                <th className="p-3">الفئة</th>
                <th className="p-3 text-center">الرصيد الحالي</th>
                <th className="p-3 text-center">مبيعات 30 يوم</th>
                <th className="p-3 text-center">السحب اليومي</th>
                <th className="p-3 text-center">الأيام المتبقية حتى النفاد</th>
                <th className="p-3 text-center">الكمية المقترحة للشراء</th>
                <th className="p-3 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stockoutData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600 font-medium">{p.category}</td>
                  <td className="p-3 text-center font-black font-mono">{p.qty}</td>
                  <td className="p-3 text-center font-bold text-slate-700 font-mono">{p.sold30}</td>
                  <td className="p-3 text-center font-bold text-amber-700 font-mono">{p.dailyVelocity} / يوم</td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2.5 py-1 rounded-lg font-black font-mono text-xs ${
                        p.daysRemaining <= 5
                          ? 'bg-rose-100 text-rose-700 border border-rose-300'
                          : p.daysRemaining <= 15
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {p.daysRemaining === 999 ? 'غير محدد' : `${p.daysRemaining} يوم`}
                    </span>
                  </td>
                  <td className="p-3 text-center font-black text-emerald-700 font-mono text-sm">
                    {p.suggestedQty > 0 ? `+${p.suggestedQty}` : '—'}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'نفد تماماً' || p.status === 'خطر نفاد وشيك'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : p.status === 'طلب قريب'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {p.status}
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

  if (reportId === 'purchase_order_plan') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <b className="text-sm font-bold text-amber-950 block">مسودة أمر الشراء المقترح</b>
            <p className="text-xs text-amber-800 font-medium">
              تم حساب الكميات بناءً على معدل السحب الفعلي لآخر 30 يوماً وتأمين مخزون استراتيجي لمدة شهر.
            </p>
          </div>
          <div className="text-left">
            <span className="text-xs text-slate-500 font-bold block">إجمالي ميزانية الشراء المقدرة:</span>
            <b className="text-xl font-black text-amber-800 font-mono">
              {fmt(purchasePlanData.reduce((s, p) => s + p.estimatedCost, 0))} ج.م
            </b>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الصنف</th>
                <th className="p-3">الفئة</th>
                <th className="p-3 text-center">الرصيد الحالي</th>
                <th className="p-3 text-center">الحد الأدنى</th>
                <th className="p-3 text-center">الكمية المطلوبة</th>
                <th className="p-3 text-center">سعر التكلفة المتوقع</th>
                <th className="p-3 text-center">إجمالي التكلفة المقدرة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {purchasePlanData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600 font-medium">{p.category}</td>
                  <td className="p-3 text-center font-bold text-rose-600 font-mono">{p.qty}</td>
                  <td className="p-3 text-center font-mono text-slate-600">{p.minQty}</td>
                  <td className="p-3 text-center font-black text-amber-700 font-mono text-sm">
                    {p.orderQty} قطعة
                  </td>
                  <td className="p-3 text-center font-mono">{fmt(p.costPrice)} ج</td>
                  <td className="p-3 text-center font-black text-slate-900 font-mono text-sm">
                    {fmt(p.estimatedCost)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'seasonal_surge') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <span className="text-xs text-amber-800 font-bold block">مجموع الأصناف المدرسية الحرجة</span>
            <b className="text-2xl font-black text-amber-900 font-mono mt-1 block">{seasonalSurgeData.length}</b>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <span className="text-xs text-slate-600 font-bold block">رأس المال المطلوب للتحضير</span>
            <b className="text-2xl font-black text-slate-900 font-mono mt-1 block">
              {fmt(seasonalSurgeData.reduce((s, p) => s + p.costToStock, 0))} ج.م
            </b>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
            <span className="text-xs text-emerald-800 font-bold block">الأرباح المتوقعة من ذروة الموسم</span>
            <b className="text-2xl font-black text-emerald-700 font-mono mt-1 block">
              +{fmt(seasonalSurgeData.reduce((s, p) => s + p.expectedProfit, 0))} ج.م
            </b>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الصنف</th>
                <th className="p-3">الفئة</th>
                <th className="p-3 text-center">المتوفر حالياً</th>
                <th className="p-3 text-center">الطلب العادي (شهري)</th>
                <th className="p-3 text-center">الطلب الموسمي المقدر ({seasonalMultiplier}x)</th>
                <th className="p-3 text-center">الكمية الإضافية المطلوبة</th>
                <th className="p-3 text-center">تكلفة التجهيز</th>
                <th className="p-3 text-center">الأرباح المتوقعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {seasonalSurgeData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600 font-medium">{p.category}</td>
                  <td className="p-3 text-center font-mono font-bold">{p.currentQty}</td>
                  <td className="p-3 text-center font-mono text-slate-600">{p.baseDemand}</td>
                  <td className="p-3 text-center font-mono font-bold text-amber-700">{p.seasonalDemand}</td>
                  <td className="p-3 text-center font-mono font-black text-rose-600 text-sm">+{p.neededQty}</td>
                  <td className="p-3 text-center font-mono font-bold">{fmt(p.costToStock)} ج</td>
                  <td className="p-3 text-center font-mono font-black text-emerald-600 text-sm">
                    +{fmt(p.expectedProfit)} ج
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (reportId === 'fast_movers') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-800 text-xs md:text-sm font-bold">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
            <span>أصناف تشهد إقبالاً كثيفاً وسحب يومي سريع مع رصيد قد ينفد خلال أقل من 10 أيام!</span>
          </div>
          <span className="font-bold text-rose-900 bg-rose-200 px-2.5 py-1 rounded-lg text-xs font-mono">
            {fastMoversData.length} أصناف
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الصنف</th>
                <th className="p-3">الفئة</th>
                <th className="p-3 text-center">المباع في 30 يوم</th>
                <th className="p-3 text-center">معدل السحب اليومي</th>
                <th className="p-3 text-center">المتبقي في الرف</th>
                <th className="p-3 text-center">أيام الصمود المتوقعة</th>
                <th className="p-3 text-center">الإجراء الموصى به</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fastMoversData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 text-slate-600 font-medium">{p.category}</td>
                  <td className="p-3 text-center font-black text-amber-700 font-mono text-sm">{p.sold30} قطعة</td>
                  <td className="p-3 text-center font-bold font-mono">{p.dailyVelocity} / يوم</td>
                  <td className="p-3 text-center font-black text-rose-600 font-mono">{p.qty}</td>
                  <td className="p-3 text-center font-black text-rose-700 font-mono bg-rose-50">
                    {p.daysRemaining} أيام فقط
                  </td>
                  <td className="p-3 text-center">
                    <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px]">
                      طلب عاجل الآن
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

  if (reportId === 'bulk_savings') {
    return (
      <div className="space-y-4">
        <p className="text-xs text-slate-600 font-medium">
          حساب الوفر المالي المباشر عند التحول من الشراء بالقطعة إلى الشراء بالكرتونة أو الدستة مباشرة من كبار تجار الفجالة/المستوردين.
        </p>
        <div className="overflow-x-auto border border-slate-200 rounded-2xl max-h-[500px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3">الصنف</th>
                <th className="p-3 text-center">تكلفة القطعة الحالية</th>
                <th className="p-3 text-center">تكلفة الجملة المقدرة (دستة/كرتونة)</th>
                <th className="p-3 text-center">سعر البيع للجمهور</th>
                <th className="p-3 text-center">الوفر المالي لكل 100 قطعة</th>
                <th className="p-3 text-center">زيادة هامش الربح</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bulkSavingsData.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">{p.name}</td>
                  <td className="p-3 text-center font-mono">{fmt(p.singleCost)} ج</td>
                  <td className="p-3 text-center font-mono font-bold text-emerald-700">{fmt(p.bulkCostEst)} ج</td>
                  <td className="p-3 text-center font-mono">{fmt(p.sellPrice)} ج</td>
                  <td className="p-3 text-center font-mono font-black text-amber-700 text-sm">
                    {fmt(p.savingsPer100)} ج.م
                  </td>
                  <td className="p-3 text-center font-mono font-bold text-emerald-600">+{p.marginGain}%</td>
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
