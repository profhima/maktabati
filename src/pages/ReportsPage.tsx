import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { todayStr } from '../lib/utils';
import {
  BarChart3,
  Calendar,
  Search,
  Download,
  Printer,
  X,
  ArrowRight,
  ChevronLeft
} from 'lucide-react';
import { REPORT_DEFINITIONS, ReportType } from '../lib/reports/reportDefinitions';
import { computeReportsData } from '../lib/reportsEngine';
import { exportReportToExcel } from '../lib/reports/reportExporter';
import { PredictionsReports } from './reports/PredictionsReports';
import { InventoryReports } from './reports/InventoryReports';
import { SalesFinanceReports } from './reports/SalesFinanceReports';
import { ExecutiveReports } from './reports/ExecutiveReports';

export const ReportsPage: React.FC = () => {
  const { db, toast } = useApp();

  const [activeCategory, setActiveCategory] = useState<
    'all' | 'predictions' | 'inventory' | 'sales' | 'suppliers_finance' | 'executive'
  >('all');
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);
  const [filterMonth, setFilterMonth] = useState(todayStr().slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');
  const [seasonalMultiplier, setSeasonalMultiplier] = useState(2.0); // for school surge

  // Close report modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedReport) {
        setSelectedReport(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedReport]);

  // Filtered definitions for the buttons grid
  const filteredReports = useMemo(() => {
    return REPORT_DEFINITIONS.filter(r => {
      const matchCat = activeCategory === 'all' || r.category === activeCategory;
      const matchSearch =
        searchQuery.trim() === '' ||
        r.title.includes(searchQuery) ||
        r.desc.includes(searchQuery);
      return matchCat && matchSearch;
    });
  }, [activeCategory, searchQuery]);

  // Current active report meta
  const currentMeta = useMemo(() => {
    return REPORT_DEFINITIONS.find(r => r.id === selectedReport) || null;
  }, [selectedReport]);

  // All analytical report computations isolated cleanly in reportsEngine
  const reportsData = useMemo(() => {
    return computeReportsData({
      db,
      filterMonth,
      seasonalMultiplier
    });
  }, [db, filterMonth, seasonalMultiplier]);

  // Excel Exporter Delegate
  const handleExportExcel = () => {
    if (!selectedReport || !currentMeta) return;
    exportReportToExcel({
      reportId: selectedReport,
      meta: currentMeta,
      filterMonth,
      reportsData,
      allProducts: db.products || [],
      toast
    });
  };

  // Helper for category color archetypes
  const getCategoryStyles = (category: string) => {
    switch (category) {
      case 'predictions':
        return {
          border: 'border-amber-200 hover:border-amber-400 hover:shadow-amber-500/10',
          bg: 'bg-linear-to-b from-amber-50/60 via-white to-white',
          iconBg: 'bg-amber-100 text-amber-800',
          badge: 'bg-amber-100 text-amber-800 border-amber-200',
          actionText: 'text-amber-700 group-hover:text-amber-900',
          indicator: 'bg-amber-500',
        };
      case 'inventory':
        return {
          border: 'border-blue-200 hover:border-blue-400 hover:shadow-blue-500/10',
          bg: 'bg-linear-to-b from-blue-50/60 via-white to-white',
          iconBg: 'bg-blue-100 text-blue-800',
          badge: 'bg-blue-100 text-blue-800 border-blue-200',
          actionText: 'text-blue-700 group-hover:text-blue-900',
          indicator: 'bg-blue-500',
        };
      case 'sales':
        return {
          border: 'border-emerald-200 hover:border-emerald-400 hover:shadow-emerald-500/10',
          bg: 'bg-linear-to-b from-emerald-50/60 via-white to-white',
          iconBg: 'bg-emerald-100 text-emerald-800',
          badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          actionText: 'text-emerald-700 group-hover:text-emerald-900',
          indicator: 'bg-emerald-500',
        };
      case 'executive':
        return {
          border: 'border-indigo-200 hover:border-indigo-400 hover:shadow-indigo-500/10',
          bg: 'bg-linear-to-b from-indigo-50/60 via-white to-white',
          iconBg: 'bg-indigo-100 text-indigo-800',
          badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
          actionText: 'text-indigo-700 group-hover:text-indigo-900',
          indicator: 'bg-indigo-500',
        };
      case 'suppliers_finance':
      default:
        return {
          border: 'border-purple-200 hover:border-purple-400 hover:shadow-purple-500/10',
          bg: 'bg-linear-to-b from-purple-50/60 via-white to-white',
          iconBg: 'bg-purple-100 text-purple-800',
          badge: 'bg-purple-100 text-purple-800 border-purple-200',
          actionText: 'text-purple-700 group-hover:text-purple-900',
          indicator: 'bg-purple-500',
        };
    }
  };

  // -------------------------------------------------------------
  // VIEW A: MAIN REPORTS HUB (Buttons / Cards Dashboard)
  // -------------------------------------------------------------
  if (!selectedReport || !currentMeta) {
    return (
      <div className="space-y-6">
        {/* 1. Header and Controls */}
        <div className="bg-white p-5 md:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/20">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight">
                  مركز التقارير والذكاء التحليلي وتوقعات الشراء
                </h2>
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  {REPORT_DEFINITIONS.length} تقريراً
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-1">
                اضغط على أي تقرير لفتحه في شاشة تحليلية منفصلة ومتكاملة مع إمكانية التصدير والطباعة
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 bg-slate-100 px-3.5 py-2 rounded-xl border border-slate-300">
              <Calendar className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-bold text-slate-600 ml-1">شهر البيانات:</span>
              <input
                type="month"
                className="bg-transparent text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer"
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 2. Category Filter & Search Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-2.5 rounded-2xl border border-slate-200">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-200'
              }`}
            >
              الكل ({REPORT_DEFINITIONS.length})
            </button>
            <button
              onClick={() => setActiveCategory('predictions')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'predictions'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-amber-900 hover:bg-amber-50'
              }`}
            >
              <span className="text-sm">✨</span>
              توقعات الشراء والطلبيات (5)
            </button>
            <button
              onClick={() => setActiveCategory('inventory')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'inventory'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-900 hover:bg-blue-50'
              }`}
            >
              <span className="text-sm">📦</span>
              تحليلات المخزون (5)
            </button>
            <button
              onClick={() => setActiveCategory('sales')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'sales'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-900 hover:bg-emerald-50'
              }`}
            >
              <span className="text-sm">📈</span>
              المبيعات وقائمة الدخل (6)
            </button>
            <button
              onClick={() => setActiveCategory('suppliers_finance')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'suppliers_finance'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-purple-900 hover:bg-purple-50'
              }`}
            >
              <span className="text-sm">🚚</span>
              الموردين والسيولة (4)
            </button>
            <button
              onClick={() => setActiveCategory('executive')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeCategory === 'executive'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-indigo-900 hover:bg-indigo-50'
              }`}
            >
              <span className="text-sm">🚨</span>
              التقارير التنفيذية ومراكز القرار (4)
            </button>
          </div>

          <div className="relative min-w-[240px]">
            <input
              type="text"
              placeholder="بحث في أسماء ووصف التقارير..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-medium placeholder:text-slate-400"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        {/* 3. THE INTERACTIVE REPORT ACTION BUTTONS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredReports.map(item => {
            const Icon = item.icon;
            const style = getCategoryStyles(item.category);

            return (
              <button
                key={item.id}
                onClick={() => setSelectedReport(item.id)}
                className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-3 relative group shadow-xs hover:shadow-md cursor-pointer ${style.bg} ${style.border}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-none transition-transform group-hover:scale-105 ${style.iconBg}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${style.badge}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 leading-snug group-hover:text-amber-900 transition-colors">
                    {item.title}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium mt-1.5 leading-relaxed line-clamp-2">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200/70 flex items-center justify-between">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${style.actionText}`}>
                    <span>فتح التقرير في شاشة منفصلة</span>
                    <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  </span>
                  <div className={`w-2 h-2 rounded-full ${style.indicator}`} />
                </div>
              </button>
            );
          })}
        </div>

        {filteredReports.length === 0 && (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-2">
            <Search className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="font-bold text-slate-800 text-sm">لا توجد تقارير مطابقة لبحثك</h4>
            <p className="text-xs text-slate-500 font-medium">جرب كتابة كلمات بحث أخرى أو اختر فئة مختلفة</p>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // VIEW B: DEDICATED SEPARATE REPORT SCREEN (Active Report)
  // -------------------------------------------------------------
  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* 1. TOP STICKY COMMAND BAR WITH CLOSE & ACTIONS */}
      <div className="bg-white p-4 md:p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 sticky top-16 z-20">
        <div className="flex items-center gap-3">
          {/* Main Close / Back Button */}
          <button
            onClick={() => setSelectedReport(null)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer group"
            title="إغلاق التقرير والعودة للقائمة الرئيسية (Escape)"
          >
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            <span>العودة للوحة التقارير (Esc)</span>
          </button>

          <div className="h-7 w-px bg-slate-200 hidden sm:block" />

          {/* Active Report Title & Icon */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <currentMeta.icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-bold text-slate-900 leading-tight">
                  {currentMeta.title}
                </h3>
                {currentMeta.badge && (
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-amber-200">
                    {currentMeta.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5 hidden md:block">
                {currentMeta.desc}
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Custom quick control for seasonal surge */}
          {selectedReport === 'seasonal_surge' && (
            <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
              <span className="text-xs font-bold text-amber-950">المضاعف:</span>
              <select
                value={seasonalMultiplier}
                onChange={e => setSeasonalMultiplier(Number(e.target.value))}
                className="text-xs font-bold bg-white px-2 py-1 rounded-lg border border-amber-300 text-amber-950 font-mono focus:outline-hidden"
              >
                <option value={1.5}>1.5x (طلب معتدل)</option>
                <option value={2.0}>2.0x (موسم دراسي عادي)</option>
                <option value={3.0}>3.0x (ذروة كشاكيل 3 أضعاف)</option>
                <option value={4.0}>4.0x (موسم استثنائي 4 أضعاف)</option>
              </select>
            </div>
          )}

          {/* Month selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-2 rounded-xl border border-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            <input
              type="month"
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-hidden cursor-pointer"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
            />
          </div>

          {/* Excel Export Button */}
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
            title="تصدير بيانات هذا التقرير إلى Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير Excel</span>
          </button>

          {/* Print Report Button */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold transition-all cursor-pointer"
            title="طباعة التقرير أو حفظه كـ PDF"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span className="hidden sm:inline">طباعة</span>
          </button>

          {/* Circular Close X */}
          <button
            onClick={() => setSelectedReport(null)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
            title="إغلاق التقرير (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. DEDICATED REPORT BODY CONTAINER */}
      <div className="bg-white rounded-3xl border border-slate-200 p-5 md:p-6 shadow-xs space-y-5">
        {/* Predictions Category (Views 1-5) */}
        {currentMeta.category === 'predictions' && (
          <PredictionsReports
            reportId={selectedReport}
            stockoutData={reportsData.stockoutData}
            purchasePlanData={reportsData.purchasePlanData}
            seasonalSurgeData={reportsData.seasonalSurgeData}
            fastMoversData={reportsData.fastMoversData}
            bulkSavingsData={reportsData.bulkSavingsData}
            seasonalMultiplier={seasonalMultiplier}
          />
        )}

        {/* Inventory Category (Views 6-10) */}
        {currentMeta.category === 'inventory' && (
          <InventoryReports
            reportId={selectedReport}
            abcData={reportsData.abcData}
            deadStockData={reportsData.deadStockData}
            stockValuationData={reportsData.stockValuationData}
            inventoryTurnoverData={reportsData.inventoryTurnoverData}
            marginByProductData={reportsData.marginByProductData}
          />
        )}

        {/* Sales & Finance Category (Views 11-20) */}
        {(currentMeta.category === 'sales' || currentMeta.category === 'suppliers_finance') && (
          <SalesFinanceReports
            reportId={selectedReport}
            filterMonth={filterMonth}
            pnlData={reportsData.pnlData}
            bestSellersData={reportsData.bestSellersData}
            categorySalesData={reportsData.categorySalesData}
            printingServicesData={reportsData.printingServicesData}
            vipCustomersData={reportsData.vipCustomersData}
            receivablesData={reportsData.receivablesData}
            supplierBalancesData={reportsData.supplierBalancesData}
            expenseBreakdownData={reportsData.expenseBreakdownData}
            cashFlowData={reportsData.cashFlowData}
            returnsImpactData={reportsData.returnsImpactData}
          />
        )}

        {/* Executive Category (Views 21-24) */}
        {currentMeta.category === 'executive' && (
          <ExecutiveReports
            reportId={selectedReport}
            smartAlertsData={reportsData.smartAlertsData}
            decisionCenterData={reportsData.decisionCenterData}
            executiveDashboardData={reportsData.executiveDashboardData}
            healthScoreData={reportsData.healthScoreData}
            execStockCost={reportsData.stockValuationData.totalCost}
            execStockRetail={reportsData.stockValuationData.totalRetail}
            execSales={reportsData.pnlData.grossSales}
            execPaid={reportsData.cashFlowData.cashSales + reportsData.cashFlowData.electronicSales}
            execReceivable={reportsData.receivablesData.reduce((s, c) => s + c.due, 0)}
            execPurchaseTotal={reportsData.cashFlowData.supplierPaid}
            execExpenseTotal={reportsData.pnlData.totalOperatingExpenses}
          />
        )}
      </div>
    </div>
  );
};
