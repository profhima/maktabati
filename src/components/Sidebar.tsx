import React from 'react';
import { useApp } from '../context/AppContext';
import { PageId } from '../types';
import { fmt, todayStr } from '../lib/utils';
import { SHOP_NAME, SHOP_DEFAULT_LOGO } from '../lib/constants';
import { getShopSettings } from '../lib/settings';
import { ROLE_PRESETS } from '../lib/permissions';
import {
  LayoutDashboard,
  Receipt,
  RotateCcw,
  PackagePlus,
  Boxes,
  History,
  Tag,
  Package,
  Newspaper,
  Users,
  Truck,
  Wallet,
  Printer,
  Coins,
  Scale,
  BarChart3,
  ShieldCheck,
  Wrench,
  AlertTriangle,
  BookOpen,
  UserCheck,
  Lock,
  Tv,
  Store
} from 'lucide-react';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { id: 'saleInvoice', label: 'فاتورة بيع (POS)', icon: Receipt },
  { id: 'salesReturn', label: 'مرتجع وتبديل', icon: RotateCcw },
  { id: 'purchaseInvoice', label: 'فاتورة شراء', icon: PackagePlus },
  { id: 'inventory', label: 'المخزون', icon: Boxes },
  { id: 'stockMovements', label: 'حركة المخزون', icon: History },
  { id: 'pricing', label: 'تسعير المخزون', icon: Tag },
  { id: 'bundles', label: 'باقات وعروض المواسم', icon: Package },
  { id: 'catalog', label: 'كتالوج المعرض والعروض', icon: Newspaper },
  { id: 'customers', label: 'العملاء', icon: Users },
  { id: 'suppliers', label: 'الموردين', icon: Truck },
  { id: 'expenses', label: 'المصروفات', icon: Wallet },
  { id: 'printingTariffs', label: 'تعريفة التصوير والطباعة', icon: Printer },
  { id: 'treasury', label: 'الخزينة', icon: Coins },
  { id: 'dayClose', label: 'جرد الخزينة', icon: Scale },
  { id: 'reports', label: 'التقارير', icon: BarChart3 },
  { id: 'settings', label: 'شعار المكتبة وتخصيص الفواتير', icon: Store },
  { id: 'users', label: 'الموظفين والصلاحيات', icon: ShieldCheck },
  { id: 'maintenance', label: 'صيانة النظام', icon: Wrench },
];

export const Sidebar: React.FC<{ isOpen?: boolean; onClose?: () => void }> = ({
  isOpen = false,
  onClose
}) => {
  const { db, currentPage, goTo, canAccess, hasPerm, currentUser, currentProfile } = useApp();

  const lowStock = (db.products || []).filter(p => p.qty <= (p.minQty || 0));
  const todaySales = (db.invoices || [])
    .filter(i => i.date === todayStr() && i.status !== 'refunded')
    .reduce((s, i) => s + i.total, 0);
  const todayProfit = (db.invoices || [])
    .filter(i => i.date === todayStr() && i.status !== 'refunded')
    .reduce((s, i) => s + i.profit, 0);

  const visibleNavItems = NAV_ITEMS.filter(item => canAccess(item.id));
  const canSeeProfits = hasPerm('viewProfits');

  const handleNavClick = (id: PageId) => {
    goTo(id);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:sticky top-0 right-0 z-50 h-screen w-64 bg-[#0F172A] text-[#F8FAFC] flex flex-col transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          overflow-y-auto border-l border-slate-700/80 shadow-xl no-print
        `}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-700/80 flex items-center gap-3 bg-slate-900/50">
          <div className="w-11 h-11 rounded-xl bg-white p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center overflow-hidden flex-none border border-amber-500/30">
            <img
              src={getShopSettings().logoUrl || SHOP_DEFAULT_LOGO}
              alt={SHOP_NAME}
              className="w-full h-full object-contain rounded-lg"
              referrerPolicy="no-referrer"
              onError={(e) => {
                // Fallback to icon if image fails to load
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg text-white truncate leading-tight tracking-tight">مكتبتي</h1>
            <p className="text-xs text-amber-400 truncate font-semibold">{getShopSettings().shopName || SHOP_NAME}</p>
          </div>
        </div>

        {/* Authenticated User Session Card */}
        <div className="px-3 pt-3">
          <div
            className="w-full bg-slate-800/90 rounded-xl p-2.5 border border-slate-700 text-right flex items-center justify-between"
            title={`جلسة الحساب: ${currentProfile?.name || currentUser?.displayName || currentUser?.email || 'المستخدم'}`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">
                {currentProfile ? ROLE_PRESETS[currentProfile.role]?.icon || '👤' : '👑'}
              </span>
              <div className="min-w-0">
                <span className="text-[10px] text-amber-400 font-bold block">المستخدم الحالي:</span>
                <span className="text-xs text-white font-bold truncate block">
                  {currentProfile ? currentProfile.name : (currentUser?.displayName || currentUser?.email || 'المدير العام')}
                </span>
              </div>
            </div>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full font-bold border border-slate-600">
              {currentProfile ? (ROLE_PRESETS[currentProfile.role]?.label.split(' ')[0] || currentProfile.role) : 'إدارة'}
            </span>
          </div>
        </div>

        {/* Real-time Low Stock Alerts Widget (if user has inventory or sales permission) */}
        {canAccess('inventory') && (
          <div className="px-3 pt-2">
            <div className="bg-slate-800/90 rounded-xl p-3 border border-slate-700/80">
              <div className="flex items-center justify-between text-xs font-bold text-slate-200 mb-2">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>تنبيهات المخزون</span>
                </span>
                <span className="bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded-full text-xs font-bold border border-rose-500/30">
                  {lowStock.length}
                </span>
              </div>
              {lowStock.length > 0 ? (
                <div className="space-y-1.5 max-h-28 overflow-y-auto text-xs">
                  {lowStock.slice(0, 4).map(p => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 bg-slate-900/90 border-r-3 border-rose-500 px-2 py-1.5 rounded-lg text-slate-200"
                    >
                      <span className="truncate flex-1 min-w-0 font-medium text-xs text-slate-200" title={p.name}>
                        {p.name}
                      </span>
                      <span className="bg-rose-950/80 border border-rose-700/50 text-rose-300 font-bold px-1.5 py-0.2 rounded text-[11px] shrink-0 font-num">
                        {p.qty}
                      </span>
                    </div>
                  ))}
                  {lowStock.length > 4 && (
                    <div className="text-[11px] text-slate-400 text-center pt-1">
                      +{lowStock.length - 4} صنف إضافي
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  ✓ المخزون سليم بالكامل
                </div>
              )}
            </div>
          </div>
        )}

        {/* Today's Live Sales Pill (Masks profit if not allowed) */}
        <div className="px-3 pt-2">
          <div className={`grid ${canSeeProfits ? 'grid-cols-2' : 'grid-cols-1'} gap-2 text-center text-xs`}>
            <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
              <span className="text-xs text-slate-300 font-medium block">مبيعات اليوم</span>
              <b className="text-sm font-bold text-white block mt-0.5">{fmt(todaySales)} ج</b>
            </div>
            {canSeeProfits && (
              <div className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/80">
                <span className="text-xs text-slate-300 font-medium block">أرباح اليوم</span>
                <b className="text-sm font-bold text-emerald-400 block mt-0.5">+{fmt(todayProfit)} ج</b>
              </div>
            )}
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all text-right cursor-pointer
                  ${
                    isActive
                      ? 'bg-amber-600 text-white font-black shadow-lg shadow-amber-600/30 ring-1 ring-amber-400/40'
                      : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                  }
                `}
              >
                <Icon className={`w-4 h-4 flex-none ${isActive ? 'text-white' : 'text-amber-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 text-xs text-slate-400 text-center font-medium bg-slate-900/60 flex items-center justify-between">
          <span>نظام RBAC مفعّل</span>
          <span className="text-[11px] text-emerald-400 font-mono">● متصل</span>
        </div>
      </aside>
    </>
  );
};

