import React from 'react';
import { fmt } from '../../lib/utils';
import { AlertTriangle, BadgeAlert, CheckCircle2 } from 'lucide-react';

interface ExecutiveReportsProps {
  reportId: string;
  smartAlertsData: any[];
  decisionCenterData: any[];
  executiveDashboardData: {
    cards: any[];
    textAlerts: any[];
    tableRows: any[];
  };
  healthScoreData: {
    score: number;
    components: any[];
    rating: {
      title: string;
      color: string;
      bg: string;
      border: string;
      desc: string;
    };
    tableRows: any[];
  };
  execStockCost: number;
  execStockRetail: number;
  execSales: number;
  execPaid: number;
  execReceivable: number;
  execPurchaseTotal: number;
  execExpenseTotal: number;
}

export const ExecutiveReports: React.FC<ExecutiveReportsProps> = ({
  reportId,
  smartAlertsData,
  decisionCenterData,
  executiveDashboardData,
  healthScoreData,
  execStockCost,
  execStockRetail,
  execSales,
  execPaid,
  execReceivable,
  execPurchaseTotal,
  execExpenseTotal
}) => {
  if (reportId === 'smart_alerts') {
    return (
      <div className="space-y-5">
        {/* Header info */}
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <b className="text-sm font-bold text-indigo-950 block">🚨 نظام التنبيهات الرقابية الذكية والمراقبة الاستباقية</b>
            <p className="text-xs text-indigo-800 font-medium mt-0.5">
              فحص لحظي تلقائي لأرصدة المخزون، الأصناف غير المسعرة، النواقص، التكدس، ومستحقات التحصيل دون إجراء أي تعديل تلقائي.
            </p>
          </div>
          <span className="font-bold text-indigo-900 bg-indigo-200/80 px-3 py-1.5 rounded-xl text-xs font-mono">
            {smartAlertsData.length} إشعار رقابي
          </span>
        </div>

        {/* Alerts Cards List */}
        <div className="space-y-3">
          {smartAlertsData.map((alert, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl border transition-all ${
                alert.iconType === 'critical'
                  ? 'bg-rose-50/70 border-rose-200 hover:border-rose-300'
                  : alert.iconType === 'warning'
                  ? 'bg-amber-50/70 border-amber-200 hover:border-amber-300'
                  : 'bg-emerald-50/70 border-emerald-200 hover:border-emerald-300'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                      alert.iconType === 'critical'
                        ? 'bg-rose-500 text-white'
                        : alert.iconType === 'warning'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {alert.iconType === 'critical' ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : alert.iconType === 'warning' ? (
                      <BadgeAlert className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-lg border ${alert.levelBadge}`}>
                        {alert.levelLabel}
                      </span>
                      <h5 className="font-bold text-slate-900 text-sm">{alert.message}</h5>
                    </div>
                    <p className="text-xs text-slate-600 font-medium">
                      <span className="font-bold text-slate-700">الإجراء المقترح: </span>
                      {alert.action}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Summary Bar */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-sm">
          <div className="text-xs font-medium flex flex-wrap items-center justify-between gap-3 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">المبيعات:</span>
              <b className="text-white font-mono font-bold text-sm">{fmt(execSales)} ج.م</b>
            </div>
            <div className="h-4 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400">المحصل:</span>
              <b className="text-emerald-400 font-mono font-bold text-sm">{fmt(execPaid)} ج.م</b>
            </div>
            <div className="h-4 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400">المستحقات:</span>
              <b className="text-amber-400 font-mono font-bold text-sm">{fmt(execReceivable)} ج.م</b>
            </div>
            <div className="h-4 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400">المشتريات:</span>
              <b className="text-purple-300 font-mono font-bold text-sm">{fmt(execPurchaseTotal)} ج.م</b>
            </div>
            <div className="h-4 w-px bg-slate-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="text-slate-400">المصروفات:</span>
              <b className="text-rose-400 font-mono font-bold text-sm">{fmt(execExpenseTotal)} ج.م</b>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (reportId === 'decision_center') {
    return (
      <div className="space-y-5">
        {/* Intro */}
        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <b className="text-sm font-bold text-indigo-950 block">🧠 مركز القرار والتوجيه التنفيذي المباشر</b>
            <p className="text-xs text-indigo-800 font-medium mt-0.5">
              توصيات وقرارات إدارية ذكية استناداً إلى حركة المخزون، معدلات السحب، الهامش الربحي، والسيولة النقدية.
            </p>
          </div>
          <span className="font-bold text-indigo-900 bg-indigo-200/80 px-3 py-1.5 rounded-xl text-xs font-mono">
            {decisionCenterData.length} قرارات مقترحة
          </span>
        </div>

        {/* Decisions Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="p-3 text-center">الأولوية</th>
                <th className="p-3 text-center">المجال</th>
                <th className="p-3">القرار المقترح</th>
                <th className="p-3">الإجراء الإداري الموصى به</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {decisionCenterData.map((d, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-black font-mono shadow-xs ${d.priorityBadge}`}>
                      {d.priority}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${d.levelBadge}`}>
                      {d.level}
                    </span>
                  </td>
                  <td className="p-3 font-bold text-slate-900 text-sm">{d.decision}</td>
                  <td className="p-3 text-slate-600 font-medium">{d.recommendedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* General Indicators Table */}
        <div className="space-y-2">
          <h5 className="font-bold text-slate-900 text-xs px-1">جدول المؤشرات العامة للنشاط:</h5>
          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-50 font-bold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="p-3">المؤشر</th>
                  <th className="p-3 text-center">القيمة الإجمالية</th>
                  <th className="p-3">الدلالة الإدارية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">قيمة المخزون بالتكلفة</td>
                  <td className="p-3 text-center font-mono font-bold text-slate-900">{fmt(execStockCost)} ج.م</td>
                  <td className="p-3 text-slate-500">رأس المال المستثمر الفعلي في البضاعة الموجودة بالمخزن</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">قيمة المخزون بسعر البيع</td>
                  <td className="p-3 text-center font-mono font-bold text-blue-700">{fmt(execStockRetail)} ج.م</td>
                  <td className="p-3 text-slate-500">القيمة السوقية المحتملة عند بيع كامل المخزون بالأسعار المحددة</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">إجمالي المبيعات</td>
                  <td className="p-3 text-center font-mono font-bold text-emerald-700">{fmt(execSales)} ج.م</td>
                  <td className="p-3 text-slate-500">إجمالي قيمة فواتير البيع النشطة المسجلة</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">المحصل الفعلي</td>
                  <td className="p-3 text-center font-mono font-bold text-emerald-600">{fmt(execPaid)} ج.م</td>
                  <td className="p-3 text-slate-500">المقبوضات النقدية والإلكترونية التي دخلت الخزينة فعلياً</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">المستحقات غير المحصلة</td>
                  <td className="p-3 text-center font-mono font-bold text-amber-700">{fmt(execReceivable)} ج.م</td>
                  <td className="p-3 text-slate-500">الذمم والديون الآجلة المتبقية طرف العملاء</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">إجمالي المشتريات</td>
                  <td className="p-3 text-center font-mono font-bold text-purple-700">{fmt(execPurchaseTotal)} ج.م</td>
                  <td className="p-3 text-slate-500">فواتير التوريد والبضاعة المشتراة من الموردين</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="p-3 font-bold text-slate-900">إجمالي المصروفات</td>
                  <td className="p-3 text-center font-mono font-bold text-rose-700">{fmt(execExpenseTotal)} ج.م</td>
                  <td className="p-3 text-slate-500">المصروفات التشغيلية والنثرية المنصرفة</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Disclaimer Footer */}
        <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-center">
          <span className="text-xs text-slate-600 font-semibold">
            📌 المركز استرشادي: لا ينفذ شراءً أو تحصيلاً أو تعديلًا تلقائيًا.
          </span>
        </div>
      </div>
    );
  }

  if (reportId === 'executive_dashboard') {
    return (
      <div className="space-y-6">
        {/* Top 7 Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {executiveDashboardData.cards.map((c, idx) => (
            <div
              key={idx}
              className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-[11px] font-bold leading-tight">{c.label}</span>
              </div>
              <b className="text-base sm:text-lg font-black text-slate-900 font-mono tracking-tight">
                {fmt(c.val)} <span className="text-[10px] font-normal text-slate-500">{c.unit}</span>
              </b>
            </div>
          ))}
        </div>

        {/* Text Alerts Section */}
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2.5">
          <h5 className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
            <BadgeAlert className="w-4 h-4 text-amber-700" />
            الإشارات والتنبيهات الإدارية المباشرة:
          </h5>
          <div className="space-y-1.5 text-xs font-semibold">
            {executiveDashboardData.textAlerts.map((alt, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 p-2 rounded-xl border ${
                  alt.type === 'rose'
                    ? 'bg-rose-50 text-rose-900 border-rose-200'
                    : alt.type === 'amber'
                    ? 'bg-amber-100/70 text-amber-900 border-amber-300'
                    : alt.type === 'yellow'
                    ? 'bg-yellow-50 text-yellow-900 border-yellow-200'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    alt.type === 'rose'
                      ? 'bg-rose-500'
                      : alt.type === 'amber'
                      ? 'bg-amber-600'
                      : alt.type === 'yellow'
                      ? 'bg-yellow-500'
                      : 'bg-emerald-500'
                  }`}
                />
                <span>{alt.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div className="space-y-2">
          <h5 className="font-bold text-slate-900 text-xs px-1">الجدول التفصيلي للوحة المدير التنفيذية:</h5>
          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3">المؤشر التنفيذي</th>
                  <th className="p-3 text-center">القيمة المحققة</th>
                  <th className="p-3">ملاحظات وشرح المؤشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {executiveDashboardData.tableRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{r.label}</td>
                    <td className="p-3 text-center font-mono font-black text-slate-900 text-sm">{r.value}</td>
                    <td className="p-3 text-slate-500">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (reportId === 'business_health_score') {
    return (
      <div className="space-y-6">
        {/* Top Score Banner & Gauge */}
        <div className={`p-6 rounded-3xl border ${healthScoreData.rating.bg} ${healthScoreData.rating.border} flex flex-wrap items-center justify-between gap-6`}>
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/80 border border-slate-200 text-slate-700 shadow-xs">
                مؤشر كفاءة وصحة النشاط التجاري
              </span>
              <span className={`text-xs font-black px-3 py-1 rounded-full ${healthScoreData.rating.color} bg-white shadow-xs`}>
                {healthScoreData.rating.title}
              </span>
            </div>
            <h4 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
              التقييم العام للمنشأة: {healthScoreData.rating.title}
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
              {healthScoreData.rating.desc}
            </p>
          </div>

          {/* Large Score Circle / Badge */}
          <div className="flex flex-col items-center justify-center p-5 bg-white rounded-3xl border border-slate-200 shadow-md min-w-[150px]">
            <span className="text-[11px] font-bold text-slate-500 mb-1">الدرجة الإجمالية</span>
            <b className={`text-4xl sm:text-5xl font-black font-mono ${healthScoreData.rating.color}`}>
              {healthScoreData.score}
            </b>
            <span className="text-xs font-bold text-slate-400 mt-0.5">من 100 نقطة</span>
          </div>
        </div>

        {/* 5-Component Weighted Breakdown */}
        <div className="space-y-3">
          <h5 className="font-bold text-slate-900 text-xs px-1">المكونات الخمسة الموزونة للمؤشر:</h5>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {healthScoreData.components.map((c, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-bold text-slate-800 leading-snug">{c.label}</span>
                  <b className="text-sm font-black font-mono text-slate-900">{c.score}/{c.max}</b>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (c.score / c.max) >= 0.8
                        ? 'bg-emerald-500'
                        : (c.score / c.max) >= 0.5
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, (c.score / c.max) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 font-medium block">{c.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Table */}
        <div className="space-y-2">
          <h5 className="font-bold text-slate-900 text-xs px-1">جدول البيانات والمؤشرات التفصيلية:</h5>
          <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-xs">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3">المؤشر</th>
                  <th className="p-3 text-center">القيمة</th>
                  <th className="p-3">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {healthScoreData.tableRows.map((r, idx) => (
                  <tr
                    key={idx}
                    className={
                      r.isHighlight
                        ? 'bg-amber-50/80 font-bold text-amber-950'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className={`p-3 ${r.isHighlight ? 'text-sm font-black text-amber-950' : 'font-bold text-slate-900'}`}>
                      {r.label}
                    </td>
                    <td className={`p-3 text-center font-mono font-black ${r.isHighlight ? 'text-base text-amber-900' : 'text-slate-900'}`}>
                      {r.value}
                    </td>
                    <td className={`p-3 ${r.isHighlight ? 'font-bold text-amber-900' : 'text-slate-500'}`}>
                      {r.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mandatory Disclaimer */}
        <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-300 text-center">
          <p className="text-xs text-slate-700 font-semibold">
            ⚠️ المؤشر إداري استرشادي مبني على بيانات البرنامج الحالية، وليس صافي ربح محاسبي معتمد.
          </p>
        </div>
      </div>
    );
  }

  return null;
};
