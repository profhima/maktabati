import React, { useState, useEffect, Suspense, lazy } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Toast } from './components/Toast';
import { AuthGate } from './components/AuthGate';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { ScanModal } from './components/ScanModal';
import { QuickAddModal } from './components/QuickAddModal';
import { PrintModal } from './components/PrintModal';
import { FinancialShadowModal } from './components/FinancialShadowModal';
import { InvoiceDetailModal } from './components/InvoiceDetailModal';
import { OperatorSwitchModal } from './components/OperatorSwitchModal';
import { OfflineSyncModal } from './components/OfflineSyncModal';
import { EgyptianCatalogModal } from './pages/inventory/EgyptianCatalogModal';
import { ShieldAlert, LogIn, Loader2, LogOut } from 'lucide-react';
import { fsauth } from './lib/firebase';

// Core Priority Page (Immediate Sync Import for fast initial render)
import { SaleInvoicePage } from './pages/SaleInvoicePage';

// Lazy Loaded Secondary Pages (Code Splitting)
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const SalesReturnPage = lazy(() => import('./pages/SalesReturnPage').then(m => ({ default: m.SalesReturnPage })));
const PurchaseInvoicePage = lazy(() => import('./pages/PurchaseInvoicePage').then(m => ({ default: m.PurchaseInvoicePage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const StockMovementsPage = lazy(() => import('./pages/StockMovementsPage').then(m => ({ default: m.StockMovementsPage })));
const PricingPage = lazy(() => import('./pages/PricingPage').then(m => ({ default: m.PricingPage })));
const CatalogPage = lazy(() => import('./pages/CatalogPage').then(m => ({ default: m.CatalogPage })));
const CustomersPage = lazy(() => import('./pages/CustomersPage').then(m => ({ default: m.CustomersPage })));
const SuppliersPage = lazy(() => import('./pages/SuppliersPage').then(m => ({ default: m.SuppliersPage })));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage').then(m => ({ default: m.ExpensesPage })));
const PrintingTariffsPage = lazy(() => import('./pages/PrintingTariffsPage').then(m => ({ default: m.PrintingTariffsPage })));
const TreasuryPage = lazy(() => import('./pages/TreasuryPage').then(m => ({ default: m.TreasuryPage })));
const DayClosePage = lazy(() => import('./pages/DayClosePage').then(m => ({ default: m.DayClosePage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const UsersPermissionsPage = lazy(() => import('./pages/UsersPermissionsPage').then(m => ({ default: m.UsersPermissionsPage })));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage').then(m => ({ default: m.MaintenancePage })));
const BundlesPage = lazy(() => import('./pages/BundlesPage').then(m => ({ default: m.BundlesPage })));
const CustomerDisplayScreen = lazy(() => import('./components/CustomerDisplayScreen').then(m => ({ default: m.CustomerDisplayScreen })));

// Smooth Page Loading Component
const PageLoadingFallback: React.FC = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 animate-pulse">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
    <p className="text-xs font-semibold text-slate-500">جاري تحميل الشاشة...</p>
  </div>
);

const AppContent: React.FC = () => {
  const {
    currentPage,
    goTo,
    openGlobalSearch,
    openScanModal,
    canAccess,
    activeOperator,
    openOperatorSwitchModal,
    egyptianCatalogModalOpen,
    closeEgyptianCatalogModal,
    toast,
    currentUser,
    currentProfile,
    firstSyncDone
  } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Keyboard Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts inside text inputs unless specifically F-keys
      const isInput =
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT';

      if (e.key === 'F1') {
        e.preventDefault();
        goTo('saleInvoice');
      } else if (e.key === 'F2') {
        e.preventDefault();
        goTo('purchaseInvoice');
      } else if (e.key === 'F3') {
        e.preventDefault();
        goTo('salesReturn');
      } else if (e.key === 'F4') {
        e.preventDefault();
        openGlobalSearch();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openGlobalSearch();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        openScanModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goTo, openGlobalSearch, openScanModal]);

  const renderActiveView = () => {
    // Check if the current user or active operator has permission to view this page
    if (!canAccess(currentPage)) {
      return (
        <div className="p-8 sm:p-12 rounded-3xl bg-white border-2 border-dashed border-rose-300 text-center max-w-xl mx-auto my-12 space-y-4 shadow-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-3xl">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="font-bold text-xl text-slate-900">
            عفواً، هذه الشاشة غير مصرح بها لحسابك
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            المشغل الحالي ({activeOperator ? activeOperator.name : 'الحساب الحالي'}) لا يمتلك الصلاحية الكافية للوصول إلى هذا القسم. يمكنك التبديل لحساب الإدارة أو إدخال رمز PIN المصرح به.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={openOperatorSwitchModal}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <LogIn className="w-4 h-4" />
              <span>تبديل الحساب / فتح برمز PIN</span>
            </button>
            <button
              onClick={() => goTo('saleInvoice')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-colors cursor-pointer border border-slate-200"
            >
              الذهاب لشاشة المبيعات (POS)
            </button>
          </div>
        </div>
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'saleInvoice':
        return <SaleInvoicePage />;
      case 'salesReturn':
        return <SalesReturnPage />;
      case 'purchaseInvoice':
        return <PurchaseInvoicePage />;
      case 'inventory':
        return <InventoryPage />;
      case 'stockMovements':
        return <StockMovementsPage />;
      case 'pricing':
        return <PricingPage />;
      case 'bundles':
        return <BundlesPage />;
      case 'customerDisplay':
        return <CustomerDisplayScreen />;
      case 'catalog':
        return <CatalogPage />;
      case 'customers':
        return <CustomersPage />;
      case 'suppliers':
        return <SuppliersPage />;
      case 'expenses':
        return <ExpensesPage />;
      case 'printingTariffs':
        return <PrintingTariffsPage />;
      case 'treasury':
        return <TreasuryPage />;
      case 'dayClose':
        return <DayClosePage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'users':
        return <UsersPermissionsPage />;
      case 'maintenance':
        return <MaintenancePage />;
      default:
        return <SaleInvoicePage />;
    }
  };

  // Check if opened as standalone customer facing display
  const isCustomerDisplayMode =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).get('page') === 'customerDisplay' || currentPage === 'customerDisplay');

  if (isCustomerDisplayMode) {
    return <CustomerDisplayScreen />;
  }

  // Phase 2.6 - Stage A Requirement 2:
  // When currentUser exists but no userProfiles document exists for this uid after initial loading,
  // render an explicit, friendly blocking screen with a sign-out button instead of an empty or broken UI.
  if (currentUser && !currentProfile && firstSyncDone) {
    return (
      <AuthGate>
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 mx-auto flex items-center justify-center shadow-inner">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              لا يوجد ملف صلاحيات لهذا الحساب
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              تم التحقق من بيانات الدخول، ولكن حسابك لم يُربط بعد بملف موظف أو صلاحيات في نظام المتجر. يُرجى التواصل مع المدير المسؤول لتعيين صلاحياتك.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right text-xs text-slate-500 font-mono space-y-1">
              <div><span className="font-sans font-bold text-slate-700">المستخدم:</span> {currentUser.email || currentUser.displayName || 'بدون بريد'}</div>
              <div><span className="font-sans font-bold text-slate-700">المعرّف (UID):</span> {currentUser.uid}</div>
            </div>
            <button
              onClick={() => fsauth.signOut()}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <div className="flex h-screen bg-[#F1F5F9] text-slate-900 font-sans antialiased overflow-hidden select-none" dir="rtl">
        {/* Main Application Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Header Bar */}
          <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

          {/* Page Viewport with smooth scroll */}
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 bg-[#F1F5F9] space-y-4">
            <div className="max-w-7xl mx-auto">
              <Suspense fallback={<PageLoadingFallback />}>
                {renderActiveView()}
              </Suspense>
            </div>
          </main>
        </div>

        {/* Global Modals & Overlays */}
        <Toast />
        <GlobalSearchModal />
        <ScanModal />
        <QuickAddModal />
        <PrintModal />
        <InvoiceDetailModal />
        <FinancialShadowModal />
        <OperatorSwitchModal />
        <OfflineSyncModal />
        <EgyptianCatalogModal
          isOpen={egyptianCatalogModalOpen}
          onClose={closeEgyptianCatalogModal}
          onToast={toast}
        />
      </div>
    </AuthGate>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

