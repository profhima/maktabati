import React from 'react';
import { useApp } from '../context/AppContext';
import { fsauth } from '../lib/firebase';
import { ROLE_PRESETS } from '../lib/permissions';
import { SHOP_NAME, SHOP_DEFAULT_LOGO } from '../lib/constants';
import { getShopSettings } from '../lib/settings';
import {
  Menu,
  Search,
  ArrowRight,
  LogOut,
  Download,
  FlaskConical,
  Wifi,
  WifiOff,
  Cloud,
  Users,
  ShieldCheck,
  Smartphone,
  RefreshCw,
  BookOpen
} from 'lucide-react';

export const Header: React.FC<{ onMenuToggle: () => void }> = ({ onMenuToggle }) => {
  const {
    currentPage,
    goTo,
    openGlobalSearch,
    connStatus,
    openShadowTest,
    isAdmin,
    activeOperator,
    openOperatorSwitchModal,
    openOfflineModal,
    pwaInstallPrompt,
    triggerPwaInstall,
    isPwaInstalled,
    openEgyptianCatalogModal
  } = useApp();

  const handleLogout = async () => {
    if (window.confirm('تسجيل الخروج من التطبيق؟')) {
      await fsauth.signOut();
    }
  };

  const getPageTitle = () => {
    switch (currentPage) {
      case 'dashboard': return 'لوحة التحكم الرئيسية';
      case 'saleInvoice': return 'فاتورة بيع (نقطة البيع السريع POS)';
      case 'salesReturn': return 'مرتجع وتبديل فواتير البيع';
      case 'purchaseInvoice': return 'فاتورة شراء / استيراد بضاعة';
      case 'inventory': return 'إدارة المخزون والشجرة الهرمية';
      case 'stockMovements': return 'سجل حركة المخزون التفصيلي';
      case 'pricing': return 'تسعير المخزون الجماعي';
      case 'catalog': return 'مجلة العروض والأصناف الراكدة';
      case 'customers': return 'حسابات العملاء ونقاط الولاء';
      case 'suppliers': return 'حسابات الموردين وفواتير الشراء';
      case 'expenses': return 'المصروفات اليومية والإدارية';
      case 'printingTariffs': return 'تعريفة خدمات التصوير والطباعة';
      case 'treasury': return 'الخزينة النقدية وحركات الكاش';
      case 'dayClose': return 'جرد الخزينة اليومي والورديات';
      case 'reports': return 'التقارير التحليلية وذكاء الأعمال';
      case 'settings': return 'هوية وشعار المكتبة وتخصيص الفواتير';
      case 'users': return 'إدارة الموظفين وتعيين الصلاحيات (RBAC)';
      case 'maintenance': return 'مركز صيانة النظام والبيانات';
      default: return 'مكتبتي';
    }
  };

  const activeRolePreset = activeOperator ? ROLE_PRESETS[activeOperator.role] : ROLE_PRESETS.admin;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-3 shadow-xs no-print">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors"
          title="القائمة"
        >
          <Menu className="w-5 h-5" />
        </button>

        {currentPage !== 'dashboard' && (
          <button
            onClick={() => goTo('dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs md:text-sm transition-colors whitespace-nowrap border border-slate-200 cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span className="hidden sm:inline">الرئيسية</span>
          </button>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <img
            src={getShopSettings().logoUrl || SHOP_DEFAULT_LOGO}
            alt={SHOP_NAME}
            className="w-7 h-7 rounded-lg object-contain border border-amber-400/50 bg-white shadow-2xs shrink-0"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <h2 className="text-base md:text-lg font-bold text-slate-900 truncate tracking-tight">
            {getPageTitle()}
          </h2>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Active Operator Switch Button */}
        <button
          onClick={openOperatorSwitchModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#FFFDF8] hover:bg-[#FAF6EE] text-slate-800 text-xs font-bold border border-[#D8CBB0] shadow-2xs transition-all cursor-pointer"
          title="انقر لتبديل الموظف أو قفل الشاشة برمز PIN"
        >
          <span className="text-sm">{activeRolePreset?.icon || '👤'}</span>
          <span className="max-w-[90px] sm:max-w-[140px] truncate font-bold text-[#1F2A3C]">
            {activeOperator ? activeOperator.name : 'المدير العام'}
          </span>
          <span className="hidden sm:inline-block text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-bold">
            {activeRolePreset?.label.split(' ')[0]}
          </span>
        </button>

        {/* Egyptian Stationery Catalog Button */}
        <button
          onClick={openEgyptianCatalogModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-300 shadow-2xs transition-all cursor-pointer"
          title="دليل سلع المكتبات المصرية الشامل (مجمع من الفجالة بدون أسعار للتنزيل والمراجعة)"
        >
          <BookOpen className="w-4 h-4 text-amber-700" />
          <span className="hidden sm:inline">دليل السلع المصرية</span>
        </button>

        {/* Global Search Button */}
        <button
          onClick={openGlobalSearch}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs md:text-sm font-bold border border-slate-300 shadow-2xs transition-colors cursor-pointer"
          title="بحث شامل (صنف، عميل، مورد، فاتورة)"
        >
          <Search className="w-4 h-4 text-amber-600" />
          <span className="hidden md:inline">بحث شامل</span>
        </button>

        {/* PWA Install Button (When prompt available) */}
        {pwaInstallPrompt && !isPwaInstalled && (
          <button
            onClick={triggerPwaInstall}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer animate-pulse"
            title="تثبيت التطبيق على جهازك للعمل بدون إنترنت (PWA)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">تثبيت التطبيق</span>
          </button>
        )}

        {/* Sync / Offline Status Interactive Trigger */}
        <button
          onClick={openOfflineModal}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border shadow-2xs bg-white hover:bg-slate-50 transition-all cursor-pointer"
          title="حالة الاتصال والمزامنة الأوفلاين — انقر للتحكم في المزامنة"
        >
          {!connStatus.online ? (
            <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border-rose-200 px-2 py-0.5 rounded-lg">
              <WifiOff className="w-4 h-4 text-rose-600" />
              <span className="font-bold">أوفلاين</span>
              {connStatus.offlinePendingCount ? (
                <span className="bg-rose-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                  {connStatus.offlinePendingCount}
                </span>
              ) : null}
            </span>
          ) : (connStatus.offlinePendingCount || 0) > 0 ? (
            <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border-amber-200 px-2 py-0.5 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
              <span className="font-bold">معلق: {connStatus.offlinePendingCount}</span>
            </span>
          ) : connStatus.pendingWrites ? (
            <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border-amber-200 px-2 py-0.5 rounded-lg">
              <Cloud className="w-4 h-4 text-amber-600 animate-pulse" />
              <span className="hidden sm:inline font-bold">جاري المزامنة</span>
            </span>
          ) : connStatus.fromCache ? (
            <span className="flex items-center gap-1.5 text-amber-800 bg-amber-50 border-amber-200 px-2 py-0.5 rounded-lg">
              <Cloud className="w-4 h-4 text-amber-600" />
              <span className="hidden sm:inline font-bold">ذاكرة محلية</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border-emerald-200 px-2 py-0.5 rounded-lg">
              <Wifi className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline font-bold">متصل سحابياً</span>
            </span>
          )}
        </button>

        {/* Financial Shadow Testing Trigger (for Admin / QA) */}
        {isAdmin && (
          <button
            onClick={openShadowTest}
            className="p-2 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
            title="فحص محرك الظل المالي (Financial Engine Test)"
          >
            <FlaskConical className="w-4 h-4" />
          </button>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
          title="تسجيل الخروج"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
