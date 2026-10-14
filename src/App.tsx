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
import { OfflineSyncModal } from './components/OfflineSyncModal';
import { EgyptianCatalogModal } from './pages/inventory/EgyptianCatalogModal';
import { ShieldAlert, LogIn, Loader2, LogOut, AlertTriangle } from 'lucide-react';
import { fsauth } from './lib/firebase';
import {
  MissingProfileScreen,
  AccountDisabledScreen,
  ProfileVerificationErrorScreen
} from './components/AccessBlockedScreen';

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
    isAccountActive,
    otherUserPendingCount,
    openOfflineModal,
    egyptianCatalogModalOpen,
    closeEgyptianCatalogModal,
    toast,
    currentUser,
    currentProfile,
    firstSyncDone,
    profileVerificationStatus,
    profileVerificationError,
    retryProfileVerification
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
    // Check if the current user has permission to view this page
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
            المستخدم الحالي ({currentProfile ? currentProfile.name : (currentUser?.displayName || currentUser?.email || 'الحساب الحالي')}) لا يمتلك الصلاحية الكافية للوصول إلى هذا القسم. يُرجى مراجعة إدارة النظام لتعديل صلاحياتك.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => goTo('saleInvoice')}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm transition-colors cursor-pointer border border-slate-200"
            >
              الذهاب لشاشة المبيعات (POS)
            </button>
            <button
              onClick={() => fsauth.signOut()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs sm:text-sm transition-colors cursor-pointer border border-rose-200 flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
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

  // 1. Loading verification state:
  if (currentUser && profileVerificationStatus === 'loading') {
    return (
      <AuthGate>
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 mx-auto flex items-center justify-center animate-pulse shadow-inner">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">
              جاري فحص وتأكيد الصلاحيات...
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              جاري الاتصال بقاعدة البيانات لتأكيد هوية الجلسة والصلاحيات المعتمدة.
            </p>
          </div>
        </div>
      </AuthGate>
    );
  }

  // 2. Read Failure / Verification Error State:
  if (currentUser && profileVerificationStatus === 'error') {
    return (
      <AuthGate>
        <ProfileVerificationErrorScreen
          currentUser={currentUser}
          errorMessage={profileVerificationError}
          onRetry={retryProfileVerification}
          onSignOut={() => fsauth.signOut()}
        />
      </AuthGate>
    );
  }

  // 3. Confirmed Missing Profile (Read succeeded and explicitly confirmed profile does NOT exist):
  if (currentUser && profileVerificationStatus === 'not_found') {
    return (
      <AuthGate>
        <MissingProfileScreen currentUser={currentUser} />
      </AuthGate>
    );
  }

  // 4. Deactivated / Disabled Account:
  if (currentUser && currentProfile && !isAccountActive) {
    return (
      <AuthGate>
        <AccountDisabledScreen currentUser={currentUser} currentProfile={currentProfile} />
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

          {/* Other User Pending Operations Warning Banner */}
          {otherUserPendingCount > 0 && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-3 shadow-2xs no-print">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="truncate">
                  <b>تنبيه أمان:</b> توجد <b>{otherUserPendingCount}</b> عملية أوفلاين معلقة على هذا الجهاز تخص موظفاً آخر. لن تُرفع تحت حسابك الحالي منعاً لتزييف الهوية، وستبقى محفوظة محلياً بأمان حتى يسجل صاحبها الدخول.
                </span>
              </div>
              <button
                onClick={openOfflineModal}
                className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded-lg border border-amber-300 transition-colors shrink-0 cursor-pointer"
              >
                عرض العمليات
              </button>
            </div>
          )}

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

