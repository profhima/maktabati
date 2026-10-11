import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, todayStr } from '../lib/utils';
import { Chart, registerables } from 'chart.js';
import {
  TrendingUp,
  DollarSign,
  RotateCcw,
  Wallet,
  AlertCircle,
  Clock,
  Award,
  Receipt,
  Boxes,
  ArrowUpRight,
  ShieldCheck,
  Eye,
  Printer
} from 'lucide-react';

Chart.register(...registerables);

export const DashboardPage: React.FC = () => {
  const { db, goTo, openInvoiceModal, hasPerm } = useApp();

  const canSeeProfit = hasPerm('viewProfits');

  const salesTrendRef = useRef<HTMLCanvasElement | null>(null);
  const categoryChartRef = useRef<HTMLCanvasElement | null>(null);
  const trendChartInstance = useRef<Chart | null>(null);
  const categoryChartInstance = useRef<Chart | null>(null);

  const today = todayStr();
  const todayReturns = (db.salesReturns || []).filter(r => r.date === today);
  const returnCashOut = todayReturns.reduce((s, r) => s + (r.cashOut || 0), 0);
  const returnCashIn = todayReturns.reduce((s, r) => s + (r.cashIn || 0), 0);
  const returnNet = todayReturns.reduce((s, r) => s + (r.netReturn || 0), 0);
  const todaySalesGross = (db.invoices || [])
    .filter(i => i.date === today && i.status !== 'refunded')
    .reduce((s, i) => s + i.total, 0);
  const todayReplacementSales = todayReturns.reduce((s, r) => s + (r.replacementTotal || 0), 0);
  const todaySales = Math.max(0, todaySalesGross - returnNet + todayReplacementSales);

  const todayProfit =
    (db.invoices || [])
      .filter(i => i.date === today && i.status !== 'refunded')
      .reduce((s, i) => s + i.profit, 0) -
    todayReturns.reduce((s, r) => s + (r.profitImpact || 0), 0);

  const invoiceCashReceived = (inv: any) => {
    const pm = inv.paymentMethod || 'cash';
    if (pm === 'cash') return inv.total;
    if (pm === 'credit') return inv.paidAmount != null ? inv.paidAmount : 0;
    return 0;
  };

  const todayCashNet =
    (db.invoices || [])
      .filter(i => i.date === today && i.status !== 'refunded')
      .reduce((s, i) => s + invoiceCashReceived(i), 0) +
    returnCashIn -
    returnCashOut;

  const lowStock = (db.products || []).filter(p => p.qty <= (p.minQty || 0));
  const closedToday = (db.dailyClosings || []).some(c => c.date === today);
  const hasTodayActivity =
    (db.invoices || []).some(i => i.date === today) ||
    (db.salesReturns || []).some(r => r.date === today) ||
    (db.expenses || []).some(e => e.date === today) ||
    (db.purchases || []).some(p => p.date === today);

  // Top Sellers last 30 days
  const computeTopSellers = () => {
    const map: Record<string, { name: string; qty: number }> = {};
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    (db.invoices || [])
      .filter(inv => inv.status !== 'refunded' && inv.date >= cutoffStr)
      .forEach(inv => {
        (inv.items || []).forEach(it => {
          const key = it.productId || it.name;
          if (!map[key]) map[key] = { name: it.name, qty: 0 };
          map[key].qty += it.qty;
        });
      });

    (db.salesReturns || [])
      .filter(r => r.date >= cutoffStr)
      .forEach(r => {
        (r.items || []).forEach(it => {
          const key = it.productId || it.name;
          if (!map[key]) map[key] = { name: it.name, qty: 0 };
          map[key].qty -= it.qty;
        });
      });

    return Object.values(map)
      .filter(x => x.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  };

  const topSellers = computeTopSellers();

  // Chart Rendering
  useEffect(() => {
    // 7 Days Trend
    if (salesTrendRef.current) {
      if (trendChartInstance.current) trendChartInstance.current.destroy();

      const days: Array<{ label: string; total: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const total = (db.invoices || [])
          .filter(inv => inv.date === dateStr && inv.status !== 'refunded')
          .reduce((s, inv) => s + inv.total, 0);
        days.push({
          label: d.toLocaleDateString('ar-EG', { weekday: 'short' }),
          total
        });
      }

      trendChartInstance.current = new Chart(salesTrendRef.current, {
        type: 'bar',
        data: {
          labels: days.map(d => d.label),
          datasets: [
            {
              label: 'المبيعات اليومية (ج.م)',
              data: days.map(d => d.total),
              backgroundColor: '#D97706',
              hoverBackgroundColor: '#B45309',
              borderRadius: 8,
              barPercentage: 0.65
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              titleFont: { family: 'Cairo', size: 13, weight: 'bold' },
              bodyFont: { family: 'Cairo', size: 12 },
              padding: 10,
              boxPadding: 4
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: 'Cairo', size: 12, weight: 'bold' }, color: '#334155' }
            },
            y: {
              beginAtZero: true,
              grid: { color: '#E2E8F0' },
              ticks: { font: { family: 'Cairo', size: 11, weight: 'bold' }, color: '#64748B' }
            }
          }
        }
      });
    }

    // Category Doughnut
    if (categoryChartRef.current) {
      if (categoryChartInstance.current) categoryChartInstance.current.destroy();

      const map: Record<string, number> = {};
      const monthPrefix = today.slice(0, 7);
      (db.invoices || [])
        .filter(inv => inv.status !== 'refunded' && inv.date.startsWith(monthPrefix))
        .forEach(inv => {
          (inv.items || []).forEach(it => {
            const p = (db.products || []).find(x => x.id === it.productId);
            const cat = p ? p.category : 'خدمة تصوير/أخرى';
            map[cat] = (map[cat] || 0) + it.qty * it.price;
          });
        });

      const labels = Object.keys(map);
      const colors = ['#D97706', '#059669', '#DC2626', '#2563EB', '#7C3AED', '#EA580C', '#0891B2', '#4B5563'];

      categoryChartInstance.current = new Chart(categoryChartRef.current, {
        type: 'doughnut',
        data: {
          labels: labels.length > 0 ? labels : ['لا توجد مبيعات'],
          datasets: [
            {
              data: labels.length > 0 ? labels.map(l => map[l]) : [1],
              backgroundColor: labels.length > 0 ? labels.map((_, i) => colors[i % colors.length]) : ['#E2E8F0'],
              borderWidth: 2,
              borderColor: '#FFFFFF'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 14,
                font: { family: 'Cairo', size: 12, weight: 'bold' },
                color: '#334155',
                padding: 12
              }
            }
          }
        }
      });
    }

    return () => {
      if (trendChartInstance.current) trendChartInstance.current.destroy();
      if (categoryChartInstance.current) categoryChartInstance.current.destroy();
    };
  }, [db.invoices, db.salesReturns]);

  return (
    <div className="space-y-5">
      {/* Date & Overview Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="text-sm md:text-base text-slate-800 font-bold flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          <span>اليوم: {new Date().toLocaleDateString('ar-EG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>حالة النظام: تشغيل ومزامنة نشطة</span>
        </div>
      </div>

      {/* Returns Action Strip */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent bg-white border border-amber-300 border-r-6 border-r-amber-600 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <b className="text-base sm:text-lg text-slate-900 block font-bold">↩️ المرتجعات والتبديل السريع</b>
          <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
            إدارة مرتجع فاتورة بيع مع تحديث فوري للمخزون والخزينة والآجل تلقائياً.
          </p>
        </div>
        <button
          onClick={() => goTo('salesReturn')}
          className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md shadow-amber-600/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>فتح شاشة المرتجع</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day Close Pending Alert */}
      {!closedToday && hasTodayActivity && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-900">
            <AlertCircle className="w-5 h-5 text-amber-700 flex-none" />
            <span>لم يتم جرد الخزينة اليوم بعد — يمكنك إجراء جرد دوري الآن وحفظ تقريره.</span>
          </div>
          <button
            onClick={() => goTo('dayClose')}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
          >
            جرد الخزينة الآن
          </button>
        </div>
      )}

      {/* Primary KPI Visual Hierarchy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Dominant Hero KPI: Net Sales Today */}
        <div className="sm:col-span-2 lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white bg-white border-2 border-amber-300 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-800 text-sm font-bold mb-2">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse"></span>
                صافي مبيعات اليوم (الرئيسي)
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 font-mono tracking-tight my-2">
              {fmt(todaySales)} <span className="text-sm sm:text-base font-bold text-amber-800 font-sans">ج.م</span>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-amber-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-700">
              إجمالي المبيعات قبل الخصم: <b className="font-mono text-slate-900">{fmt(todaySalesGross)}</b> ج.م
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold border border-amber-200">
              {(db.invoices || []).filter(i => i.date === today && i.status !== 'refunded').length} فاتورة مسجلة
            </span>
          </div>
        </div>

        {/* Profit or Invoices Count */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-800 text-xs sm:text-sm font-bold mb-2">
              <span>{canSeeProfit ? 'صافي أرباح اليوم' : 'عدد فواتير اليوم'}</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                {canSeeProfit ? <DollarSign className="w-5 h-5" /> : <Receipt className="w-5 h-5" />}
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight my-1">
              {canSeeProfit ? (
                <>
                  {fmt(todayProfit)} <span className="text-xs font-bold text-emerald-800 font-sans">ج.م</span>
                </>
              ) : (
                <>
                  {(db.invoices || []).filter(i => i.date === today && i.status !== 'refunded').length}{' '}
                  <span className="text-xs font-bold text-slate-600 font-sans">فاتورة</span>
                </>
              )}
            </div>
          </div>
          <div className="pt-2">
            <span className="text-xs font-bold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg inline-block border border-emerald-200">
              {canSeeProfit ? 'هامش ربح العمليات' : 'نشاط المبيعات الحالي'}
            </span>
          </div>
        </div>

        {/* Net Cash In Hand */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-800 text-xs sm:text-sm font-bold mb-2">
              <span>صافي حركة الكاش بالدرج</span>
              <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-blue-800 font-mono tracking-tight my-1">
              {fmt(todayCashNet)} <span className="text-xs font-bold text-slate-600 font-sans">ج.م</span>
            </div>
          </div>
          <div className="pt-2">
            <span className="text-xs font-bold text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg inline-block border border-blue-200">
              المقبوضات النقدية الفعلية
            </span>
          </div>
        </div>

        {/* Returns KPI */}
        <div className="sm:col-span-2 lg:col-span-4 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 flex-none">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-800 block">حركة مرتجعات اليوم</span>
              <span className="text-xs font-semibold text-slate-600">
                إجمالي المرتجعات: <b className="font-mono text-rose-700">{todayReturns.length}</b> عملية بقيمة <b className="font-mono text-rose-700">{fmt(returnNet)}</b> ج.م
              </span>
            </div>
          </div>
          <button
            onClick={() => goTo('salesReturn')}
            className="text-xs font-bold text-rose-800 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors cursor-pointer"
          >
            سجل المرتجعات ←
          </button>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <h3 className="font-bold text-base md:text-lg text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span>
            📈 مبيعات آخر 7 أيام
          </h3>
          <div className="h-64 relative">
            <canvas ref={salesTrendRef} />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <h3 className="font-bold text-base md:text-lg text-slate-900 mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
            🥧 توزيع المبيعات حسب الفئة (الشهر الحالي)
          </h3>
          <div className="h-64 relative">
            <canvas ref={categoryChartRef} />
          </div>
        </div>
      </div>

      {/* Top Sellers & Low Stock Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Sellers */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <h3 className="font-bold text-base md:text-lg text-slate-900 mb-3 pb-3 border-b border-slate-100 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-600" />
            الأكثر مبيعاً (آخر 30 يوم)
          </h3>
          {topSellers.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {topSellers.map((item, idx) => (
                <li key={idx} className="py-3 flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-amber-600 text-white text-xs font-black flex items-center justify-center flex-none shadow-xs">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 font-mono">
                    {item.qty} قطعة
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center py-10 text-xs font-bold text-slate-500">لا توجد مبيعات مسجلة في آخر 30 يوم</div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
            <h3 className="font-bold text-base md:text-lg text-slate-900 flex items-center gap-2">
              <Boxes className="w-5 h-5 text-rose-600" />
              أصناف قاربت على النفاد ({lowStock.length})
            </h3>
            <button
              onClick={() => goTo('inventory')}
              className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
            >
              عرض المخزون ←
            </button>
          </div>
          {lowStock.length > 0 ? (
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-xs text-right">
                <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">الصنف</th>
                    <th className="p-2.5">الفئة</th>
                    <th className="p-2.5">المتبقي</th>
                    <th className="p-2.5">الحد الأدنى</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStock.slice(0, 6).map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{p.name}</td>
                      <td className="p-2.5 text-slate-600 font-medium">{p.category}</td>
                      <td className="p-2.5 font-black text-rose-600 font-mono">{p.qty}</td>
                      <td className="p-2.5 font-mono text-slate-700">{p.minQty || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-10 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-xl p-4">
              ✓ كافة الأصناف متوفرة فوق الحد الأدنى
            </div>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
          <h3 className="font-bold text-base md:text-lg text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-600" />
            آخر الفواتير المسجلة
          </h3>
          <button
            onClick={() => goTo('reports')}
            className="text-xs font-bold text-amber-700 hover:text-amber-800 hover:underline bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200"
          >
            كل الفواتير ←
          </button>
        </div>
        {(db.invoices || []).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead className="bg-slate-100 font-bold text-slate-800 border-b border-slate-200">
                <tr>
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">العميل</th>
                  <th className="p-3">طريقة الدفع</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(db.invoices || [])
                  .slice(-6)
                  .reverse()
                  .map(inv => (
                    <tr
                      key={inv.id}
                      onClick={() => openInvoiceModal(inv)}
                      className="hover:bg-amber-50/60 transition-colors cursor-pointer"
                    >
                      <td className="p-3 font-bold text-amber-800 font-mono">#{inv.number}</td>
                      <td className="p-3 text-slate-600 font-medium">{inv.date}</td>
                      <td className="p-3 font-bold text-slate-800">{inv.customerName || 'عميل نقدي'}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {inv.paymentMethod === 'cash'
                            ? 'نقدًا'
                            : inv.paymentMethod === 'credit'
                            ? 'آجل'
                            : inv.paymentMethod === 'card'
                            ? 'بطاقة'
                            : 'فودافون كاش'}
                        </span>
                      </td>
                      <td className="p-3 font-black text-amber-700 font-mono text-sm">{fmt(inv.total)} ج.م</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openInvoiceModal(inv);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-600 hover:text-white text-amber-800 font-bold text-xs inline-flex items-center gap-1 transition-colors"
                          title="عرض واستدعاء الفاتورة لإعادة الطباعة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          عرض وطباعة
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-xs font-bold text-slate-500">لا توجد فواتير مسجلة بعد</div>
        )}
      </div>
    </div>
  );
};

