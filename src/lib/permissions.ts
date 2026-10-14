import { UserProfile, UserPermissionSet, UserRole, PageId } from '../types';

export const DEFAULT_ADMIN_PERMISSIONS: UserPermissionSet = {
  viewCostPrice: true,
  viewProfits: true,
  posSales: true,
  editHistoricalSales: true,
  salesReturns: true,
  inventoryManage: true,
  purchasesManage: true,
  treasuryManage: true,
  dayClose: true,
  reportsView: true,
  expensesManage: true,
  customersManage: true,
  suppliersManage: true,
  catalogDeals: true,
  printingTariffs: true,
  usersManage: true,
  maintenance: true,
  allowDiscountOverride: true,
  deleteInvoices: true
};

export const DEFAULT_MANAGER_PERMISSIONS: UserPermissionSet = {
  viewCostPrice: true,
  viewProfits: false, // hidden by default for branch managers unless explicitly enabled
  posSales: true,
  editHistoricalSales: false,
  salesReturns: true,
  inventoryManage: true,
  purchasesManage: true,
  treasuryManage: true,
  dayClose: true,
  reportsView: true,
  expensesManage: true,
  customersManage: true,
  suppliersManage: true,
  catalogDeals: true,
  printingTariffs: true,
  usersManage: false,
  maintenance: false,
  allowDiscountOverride: true,
  deleteInvoices: false
};

export const DEFAULT_CASHIER_PERMISSIONS: UserPermissionSet = {
  viewCostPrice: false, // STRICTLY HIDDEN
  viewProfits: false,   // STRICTLY HIDDEN
  posSales: true,
  editHistoricalSales: false,
  salesReturns: true,
  inventoryManage: false, // can only look up items in POS
  purchasesManage: false,
  treasuryManage: false,
  dayClose: false,
  reportsView: false,
  expensesManage: false,
  customersManage: true, // can select & add customer info
  suppliersManage: false,
  catalogDeals: true,
  printingTariffs: true,
  usersManage: false,
  maintenance: false,
  allowDiscountOverride: false,
  deleteInvoices: false
};

export const DEFAULT_STOCKKEEPER_PERMISSIONS: UserPermissionSet = {
  viewCostPrice: false,
  viewProfits: false,
  posSales: false,
  editHistoricalSales: false,
  salesReturns: false,
  inventoryManage: true,
  purchasesManage: true,
  treasuryManage: false,
  dayClose: false,
  reportsView: false,
  expensesManage: false,
  customersManage: false,
  suppliersManage: true,
  catalogDeals: true,
  printingTariffs: false,
  usersManage: false,
  maintenance: false,
  allowDiscountOverride: false,
  deleteInvoices: false
};

export const ROLE_PRESETS: Record<
  UserRole,
  { label: string; description: string; icon: string; permissions: UserPermissionSet }
> = {
  admin: {
    label: 'مدير عام / المالك (Admin)',
    description: 'كامل الصلاحيات المطلقة دون أي قيود (أرباح، تكاليف، إعدادات، موظفين)',
    icon: '👑',
    permissions: DEFAULT_ADMIN_PERMISSIONS
  },
  manager: {
    label: 'مشرف فرع / مدير مالي (Manager)',
    description: 'إدارة تشغيلية يومية مع إمكانية ضبط الأسعار واليومية دون المساس بإعدادات النظام الحساسة',
    icon: '👔',
    permissions: DEFAULT_MANAGER_PERMISSIONS
  },
  cashier: {
    label: 'كاشير / بائع نقطة البيع (Cashier)',
    description: 'شاشة المبيعات POS والمرتجعات فقط — مع حجب تام لأسعار التكلفة والأرباح والخزينة',
    icon: '🛒',
    permissions: DEFAULT_CASHIER_PERMISSIONS
  },
  stockkeeper: {
    label: 'أمين مخزن / مسؤول توريد (Storekeeper)',
    description: 'إدارة المخزون، الجرد، وفواتير التوريد دون رؤية الخزينة أو الأرباح المالية',
    icon: '📦',
    permissions: DEFAULT_STOCKKEEPER_PERMISSIONS
  },
  custom: {
    label: 'صلاحيات مخصصة (Custom)',
    description: 'تحديد دقيق ومفصل لكل شاشة وعملية على حدة حسب حاجة الموظف',
    icon: '⚙️',
    permissions: DEFAULT_CASHIER_PERMISSIONS
  },
  user: {
    label: 'مستخدم عادي (Standard User)',
    description: 'صلاحيات استخدام أساسية للمبيعات اليومية',
    icon: '👤',
    permissions: DEFAULT_CASHIER_PERMISSIONS
  }
};

export interface PermissionDefinition {
  key: keyof UserPermissionSet;
  label: string;
  category: 'security' | 'sales' | 'inventory' | 'financials' | 'system';
  categoryLabel: string;
  description: string;
  isSensitive?: boolean;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // Security & Sensitive
  {
    key: 'viewCostPrice',
    label: 'رؤية أسعار التكلفة ورأس المال',
    category: 'security',
    categoryLabel: '🔐 الأمان المالي والخصوصية',
    description: 'إظهار سعر الشراء والتكلفة في كروت الأصناف والجداول (إذا عُطلت يتم حجبها تماماً)',
    isSensitive: true
  },
  {
    key: 'viewProfits',
    label: 'رؤية الأرباح وهوامش الربح',
    category: 'security',
    categoryLabel: '🔐 الأمان المالي والخصوصية',
    description: 'إظهار مؤشرات الأرباح وصافي الدخل في لوحة التحكم والفواتير والتقارير',
    isSensitive: true
  },
  {
    key: 'allowDiscountOverride',
    label: 'منح خصومات إضافية بدون رمز مدير',
    category: 'security',
    categoryLabel: '🔐 الأمان المالي والخصوصية',
    description: 'السماح بتطبيق خصومات يدوية كبيرة على الفواتير دون الحاجة لموافقة المدير',
    isSensitive: true
  },
  {
    key: 'deleteInvoices',
    label: 'إلغاء وحذف الفواتير القديمة',
    category: 'security',
    categoryLabel: '🔐 الأمان المالي والخصوصية',
    description: 'صلاحية حذف أو إلغاء الفواتير السابقة والعمليات المحفوظة',
    isSensitive: true
  },
  {
    key: 'editHistoricalSales',
    label: 'تعديل الفواتير التاريخية السابقة',
    category: 'security',
    categoryLabel: '🔐 الأمان المالي والخصوصية',
    description: 'صلاحية تعديل بيانات أو أسعار أو أصناف فاتورة بيع تم إصدارها وترحيلها مسبقاً',
    isSensitive: true
  },

  // Sales
  {
    key: 'posSales',
    label: 'فواتير البيع ونقاط البيع (POS)',
    category: 'sales',
    categoryLabel: '🛒 المبيعات ونقاط البيع',
    description: 'إجراء عمليات البيع السريع واستخراج فواتير A4 والإيصالات الحرارية'
  },
  {
    key: 'salesReturns',
    label: 'مرتجع وتبديل المبيعات',
    category: 'sales',
    categoryLabel: '🛒 المبيعات ونقاط البيع',
    description: 'استرجاع الأصناف وتبديلها وتسوية الفروق النقدية'
  },
  {
    key: 'customersManage',
    label: 'إدارة العملاء والديون والولاء',
    category: 'sales',
    categoryLabel: '🛒 المبيعات ونقاط البيع',
    description: 'الاطلاع على سجلات العملاء، مديونياتهم، ونقاط المكافآت'
  },
  {
    key: 'catalogDeals',
    label: 'مجلة العروض وتخفيضات المعرض',
    category: 'sales',
    categoryLabel: '🛒 المبيعات ونقاط البيع',
    description: 'تجهيز وتصدير مجلة العروض الدعائية PDF'
  },
  {
    key: 'printingTariffs',
    label: 'تعريفة خدمات التصوير والطباعة',
    category: 'sales',
    categoryLabel: '🛒 المبيعات ونقاط البيع',
    description: 'تعديل واستخدام أسعار خدمات النسخ والتصوير'
  },

  // Inventory & Purchases
  {
    key: 'inventoryManage',
    label: 'إدارة وتعديل المخزون والأسعار',
    category: 'inventory',
    categoryLabel: '📦 المخازن والمشتريات',
    description: 'إضافة أصناف جديدة، تعديل أسعار البيع، وتسويات الجرد'
  },
  {
    key: 'purchasesManage',
    label: 'فواتير الشراء والتوريد',
    category: 'inventory',
    categoryLabel: '📦 المخازن والمشتريات',
    description: 'تسجيل بضائع الموردين الواردة وأوامر الشراء'
  },
  {
    key: 'suppliersManage',
    label: 'إدارة الموردين وحساباتهم',
    category: 'inventory',
    categoryLabel: '📦 المخازن والمشتريات',
    description: 'متابعة حسابات دور النشر والشركات الموردة ومستحقاتهم'
  },

  // Financials
  {
    key: 'treasuryManage',
    label: 'الخزينة النقدية وحركات الكاش',
    category: 'financials',
    categoryLabel: '💰 المالية والتقارير',
    description: 'تسجيل الإيداعات والسحوبات النقدية ومتابعة رصيد الدرج'
  },
  {
    key: 'dayClose',
    label: 'جرد وتقفيل الوردية اليومية',
    category: 'financials',
    categoryLabel: '💰 المالية والتقارير',
    description: 'إغلاق اليومية ومطابقة النقدية الفعلية مع المحسوبة'
  },
  {
    key: 'expensesManage',
    label: 'تسجيل المصروفات الإدارية والتشغيلية',
    category: 'financials',
    categoryLabel: '💰 المالية والتقارير',
    description: 'تسجيل النثريات والإيجار والفواتير الدورية'
  },
  {
    key: 'reportsView',
    label: 'التقارير التحليلية والإحصاءات',
    category: 'financials',
    categoryLabel: '💰 المالية والتقارير',
    description: 'الاطلاع على تقارير المبيعات الشاملة والأداء'
  },

  // System & Administration
  {
    key: 'usersManage',
    label: 'إدارة الموظفين وتعيين الصلاحيات',
    category: 'system',
    categoryLabel: '⚙️ الإدارة والنظام',
    description: 'إضافة موظفين جدد وتحديد أدوارهم وكلمات السر والـ PIN',
    isSensitive: true
  },
  {
    key: 'maintenance',
    label: 'صيانة النظام والنسخ الاحتياطي',
    category: 'system',
    categoryLabel: '⚙️ الإدارة والنظام',
    description: 'استيراد/تصدير البيانات، تصفير قواعد البيانات، وصيانة الجداول',
    isSensitive: true
  }
];

/**
 * Resolves the authenticated session profile and permissions strictly from the Firebase Auth UID.
 * Complete lockdown against local operator switching or arbitrary client overrides.
 */
export function resolveEffectiveSession(
  profiles: UserProfile[] | undefined | null,
  currentUserUid?: string | null
): {
  currentProfile: UserProfile | null;
  isAccountActive: boolean;
  effectiveProfile: UserProfile | null;
  isAdmin: boolean;
} {
  if (!currentUserUid) {
    return {
      currentProfile: null,
      isAccountActive: false,
      effectiveProfile: null,
      isAdmin: false
    };
  }

  const currentProfile = (profiles || []).find(x => x.uid === currentUserUid) || null;
  const isAccountActive = Boolean(
    currentProfile && currentProfile.isActive !== false && !(currentProfile as any).disabled
  );
  const effectiveProfile = isAccountActive ? currentProfile : null;
  const isAdmin = Boolean(effectiveProfile && effectiveProfile.role === 'admin');

  return {
    currentProfile,
    isAccountActive,
    effectiveProfile,
    isAdmin
  };
}

export function hasPermission(
  profile: UserProfile | null | undefined,
  key: keyof UserPermissionSet | string
): boolean {
  // STRICT FAIL-CLOSED: If no profile exists, DENY all access (especially sensitive financial costs/profits)
  if (!profile) return false;

  // Inactive or disabled accounts cannot perform operations or view data
  if (profile.isActive === false || (profile as any).disabled === true) return false;

  // Super Admin has universal access
  if (profile.role === 'admin') return true;

  // Check explicit permission set on profile
  if (profile.permissions && typeof (profile.permissions as any)[key] === 'boolean') {
    return (profile.permissions as any)[key];
  }

  // Fallback to role-specific preset defaults
  const rolePreset = ROLE_PRESETS[profile.role]?.permissions || DEFAULT_CASHIER_PERMISSIONS;
  if (typeof (rolePreset as any)[key] === 'boolean') {
    return (rolePreset as any)[key];
  }

  // Any unspecified permission fails closed
  return false;
}

export function canAccessPage(page: PageId, profile: UserProfile | null | undefined): boolean {
  // STRICT FAIL-CLOSED: Unauthenticated / no-profile cannot access protected pages
  if (!profile) return false;
  if (profile.isActive === false || (profile as any).disabled === true) return false;
  if (profile.role === 'admin') return true;

  const perms = (profile.permissions || ROLE_PRESETS[profile.role]?.permissions || DEFAULT_CASHIER_PERMISSIONS) as UserPermissionSet;

  switch (page) {
    case 'dashboard':
      return !!perms.reportsView || !!perms.posSales || !!perms.inventoryManage;
    case 'saleInvoice':
      return !!perms.posSales;
    case 'salesReturn':
      return !!perms.salesReturns;
    case 'purchaseInvoice':
      return !!perms.purchasesManage;
    case 'inventory':
    case 'stockMovements':
    case 'pricing':
    case 'bundles':
      return !!perms.inventoryManage;
    case 'catalog':
      return !!perms.catalogDeals;
    case 'customerDisplay':
      return true; // Dual screen public viewport
    case 'customers':
      return !!perms.customersManage;
    case 'suppliers':
      return !!perms.suppliersManage;
    case 'expenses':
      return !!perms.expensesManage;
    case 'printingTariffs':
      return !!perms.printingTariffs;
    case 'treasury':
      return !!perms.treasuryManage;
    case 'dayClose':
      return !!perms.dayClose;
    case 'reports':
      return !!perms.reportsView;
    case 'users':
      return !!perms.usersManage;
    case 'maintenance':
      return !!perms.maintenance;
    case 'settings':
      return !!perms.maintenance || !!perms.usersManage || profile.role === 'manager';
    default:
      return false;
  }
}

export const LOCAL_USERS_STORAGE_KEY = 'maktabati_local_user_profiles_v2';

export function getLocalUserProfiles(): UserProfile[] {
  // Operational reliance removed for security hardening
  return [];
}

export function saveLocalUserProfiles(_profiles: UserProfile[]) {
  // Operational saving stopped to prevent local plaintext/hash exposure in localStorage
}

import { verifyPin } from './pinSecurity';

/**
 * Validates if the supplied PIN belongs to an active Admin or Manager (or authorized staff).
 * STRICT SECURITY: Zero plaintext comparison, salted PBKDF2/SHA-256 verification.
 * Rejects if trusted user profiles are missing or empty; NEVER falls back to local storage.
 */
export async function verifyAdminOrManagerPin(
  pinInput: string,
  userProfiles: UserProfile[] = []
): Promise<{ valid: boolean; approver?: { name: string; role: string; uid: string }; error?: string }> {
  const pin = (pinInput || '').trim();
  if (!pin) return { valid: false, error: 'رمز المرور مطلوب' };

  // STRICT REQUIREMENT: Only verify against trusted in-memory profiles loaded from authoritative source.
  // NEVER fall back to getLocalUserProfiles() or local storage. If no trusted profiles are available, reject safely.
  if (!Array.isArray(userProfiles) || userProfiles.length === 0) {
    return { valid: false, error: 'تعذر التحقق من الصلاحيات: قائمة الموظفين الموثوقة غير متوفرة حالياً' };
  }

  for (const u of userProfiles) {
    // Account must be strictly active (both isActive !== false AND disabled !== true)
    const isDeactivated = u.isActive === false || (u as any).disabled === true;
    if (isDeactivated) {
      continue;
    }

    // Must be an authorized manager, admin, or have allowDiscountOverride explicitly
    const isAuthorized = u.role === 'admin' || u.role === 'manager' || !!(u.permissions as any)?.allowDiscountOverride;
    if (!isAuthorized) {
      continue;
    }

    const isValid = await verifyPin(pin, u);
    if (isValid) {
      return {
        valid: true,
        approver: {
          name: u.name,
          role: u.role,
          uid: u.uid || u.id || ''
        }
      };
    }
  }

  return { valid: false, error: 'رمز المرور غير صحيح أو غير مخول' };
}

