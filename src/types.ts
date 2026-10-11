export type PageId =
  | 'dashboard'
  | 'saleInvoice'
  | 'salesReturn'
  | 'purchaseInvoice'
  | 'inventory'
  | 'stockMovements'
  | 'pricing'
  | 'bundles'
  | 'catalog'
  | 'customers'
  | 'suppliers'
  | 'expenses'
  | 'printingTariffs'
  | 'treasury'
  | 'dayClose'
  | 'reports'
  | 'users'
  | 'maintenance'
  | 'settings'
  | 'customerDisplay';

export interface ShopSettings {
  shopName: string;
  slogan?: string;
  address: string;
  phones: string;
  logoUrl?: string;
  commercialReg?: string;
  taxNumber?: string;
  // Thermal Receipt Customization
  thermalPaperWidth: '80mm' | '58mm';
  showLogoOnThermal: boolean;
  showQrOnThermal: boolean;
  showBarcodeOnThermal: boolean;
  thermalHeaderNote?: string;
  thermalFooterNote?: string;
  returnPolicyTerms?: string;
  thermalFontSize: 'small' | 'normal' | 'large';
  // A4 Invoice Customization
  showLogoOnA4: boolean;
  showBankDetailsOnA4: boolean;
  bankDetails?: string;
  a4HeaderNote?: string;
  a4FooterTerms?: string;
  updatedAt?: string;
}

export type DayStatus =
  | 'BUSINESS_DAY'
  | 'HOLIDAY'
  | 'NON_WORKING'
  | 'CLOSED'
  | 'NOT_CONFIGURED';

export interface BusinessCalendarConfig {
  version: number;
  weeklyHolidays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday (no duplicates)
  officialHolidays: string[]; // YYYY-MM-DD (no duplicates)
  nonWorkingDates: string[]; // YYYY-MM-DD (no duplicates)
  effectiveFrom: string; // YYYY-MM-DD
  updatedAt: string; // ISO string
  updatedByUid: string;
  updatedByName: string;
  changeReason?: string;
}

export interface BusinessCalendarVersionRecord {
  version: number;
  weeklyHolidays: number[];
  officialHolidays: string[];
  nonWorkingDates: string[];
  effectiveFrom: string;
  createdAt: string;
  createdByUid: string;
  createdByName: string;
  changeReason?: string;
}

export interface BundleComponentItem {
  productId: string;
  productName: string;
  qty: number;
  unitCost: number;
  unitSell: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  barcode?: string;
  institution?: string;
  grade?: string;
  term?: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  qty: number;
  minQty?: number;
  maxQty?: number;
  isBundle?: boolean;
  bundleComponents?: BundleComponentItem[];
  createdBy?: string;
  actorUid?: string;
  createdAt?: string;
  lastOperationId?: string;
  lastOperationType?: string;
  lastOperationActorUid?: string;
}

export interface CustomerBalance {
  invoiced: number;
  paid: number;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  loyaltyPoints?: number;
  points?: number;
  discountRate?: number;
  balance?: CustomerBalance;
}

export interface SupplierBalance {
  invoiced: number;
  paid: number;
  updatedAt?: string;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  address?: string;
  balance?: SupplierBalance;
}

export interface InvoiceItem {
  productId: string | null;
  name: string;
  qty: number;
  price: number;
  originalPrice?: number;
  cost?: number;
  term?: string;
  manualOverride?: boolean;
}

export interface Invoice {
  id: string;
  number: number;
  date: string;
  status: 'paid' | 'refunded';
  customerId: string | null;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  originalSubtotal?: number;
  categoryDiscounts?: Record<string, number>;
  subtotal?: number;
  discountType?: string;
  discountValue?: number;
  discount: number;
  paymentMethod: 'cash' | 'card' | 'vodafone_cash' | 'credit';
  usedPoints?: number;
  earnedPoints?: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  profit: number;
  operationId?: string;
  actorUid?: string;
  createdBy?: string;
  createdAt?: string;
  // Date Model Foundation (Phase 2.2.5.3 - Non-breaking Optional Fields)
  originalEventDate?: string;
  statementDate?: string;
  actualCashDate?: string;
  postingDate?: string;
  effectiveCashDate?: string;
  syncDate?: string;
  closedDate?: string;
  isLatePosting?: boolean;
  isManagerOverride?: boolean;
}

export interface SalesReturnItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
  term?: string;
  source?: 'original' | 'replacement';
}

export interface SalesReturn {
  id: string;
  number: number;
  date: string;
  invoiceId: string;
  invoiceNumber: string | number;
  customerId: string | null;
  customerName: string;
  customerPhone?: string;
  mode: 'cash' | 'exchange';
  items: SalesReturnItem[];
  returnGross: number;
  allocatedDiscount: number;
  allocatedPoints: number;
  netReturn: number;
  cashOut: number;
  cashIn: number;
  creditReduction: number;
  replacementItems: SalesReturnItem[];
  replacementTotal: number;
  exchangeDifference: number;
  profitImpact: number;
  pointsReversed?: number;
  operationId?: string;
  actorUid?: string;
  createdBy?: string;
  createdAt?: string;
  // Date Model Foundation (Phase 2.2.5.3)
  originalEventDate?: string;
  statementDate?: string;
  actualCashDate?: string;
  postingDate?: string;
  effectiveCashDate?: string;
  syncDate?: string;
  closedDate?: string;
  isLatePosting?: boolean;
  isManagerOverride?: boolean;
}

export interface PurchaseItem {
  productId: string;
  name?: string;
  productName?: string;
  category?: string;
  unit?: string;
  qty: number;
  cost: number;
  sellPrice?: number;
  subtotal?: number;
  term?: string;
}

export interface PurchaseDiscount {
  date: string;
  amount: number;
  note?: string;
}

export interface Purchase {
  id: string;
  number: number;
  date: string;
  supplierId: string | null;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  originalTotal?: number;
  total: number;
  paidAmount: number;
  dueAmount: number;
  discountsApplied?: PurchaseDiscount[];
  operationId?: string;
  source?: string;
  actorUid?: string;
  createdBy?: string;
  createdAt?: string;
  // Date Model Foundation (Phase 2.2.5.3)
  originalEventDate?: string;
  statementDate?: string;
  actualCashDate?: string;
  postingDate?: string;
  effectiveCashDate?: string;
  syncDate?: string;
  closedDate?: string;
  isLatePosting?: boolean;
  isManagerOverride?: boolean;
}

export interface PurchaseReturnItem {
  productId: string;
  productName: string;
  qty: number;
  originalUnitCost: number;
  totalCost: number;
}

export interface PurchaseReturn {
  id: string;
  number: number;
  purchaseId: string;
  purchaseNumber: number | string;
  supplierId: string | null;
  supplierName: string;
  items: PurchaseReturnItem[];
  totalRefund: number;
  refundMethod: 'cash' | 'credit';
  originalEventDate: string;
  statementDate: string;
  postingDate: string;
  effectiveCashDate?: string | null;
  syncDate?: string | null;
  closedDate?: string | null;
  isLatePosting: boolean;
  operationId: string;
  actorUid?: string;
  actorName?: string;
  createdAt: string;
  notes?: string;
}

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  note?: string;
  operationId?: string;
  actorUid?: string;
  createdBy?: string;
  createdAt?: string;
  // Date Model Foundation (Phase 2.2.5.3)
  originalEventDate?: string;
  statementDate?: string;
  actualCashDate?: string;
  postingDate?: string;
  effectiveCashDate?: string;
  syncDate?: string;
  closedDate?: string;
  isLatePosting?: boolean;
  isManagerOverride?: boolean;
  overrideReason?: string;
  overrideManagerUid?: string;
}

export interface PrintingTariff {
  id: string;
  title: string;
  name?: string;
  category: string;
  unit: string;
  price: number;
  cost: number;
  priceSingle?: number;
  priceDouble?: number;
  priceBulk?: number;
  minBulkQty?: number;
}

export interface DailyClosing {
  id: string;
  date: string;
  shiftId?: string;
  closedBy?: string;
  openingCash?: number;
  baseCountId?: string | null;
  baseCutoff?: string | null;
  expectedCash?: number;
  actualCash?: number;
  difference?: number;
  cashDifference?: number;
  invoicesCount?: number;
  invoiceCount?: number;
  salesGross?: number;
  salesTotal?: number;
  profitTotal?: number;
  salesCash?: number;
  salesCashIn?: number;
  salesCard?: number;
  salesCardTotal?: number;
  salesVodafone?: number;
  salesVodafoneTotal?: number;
  salesCredit?: number;
  salesCreditNewTotal?: number;
  customerPayments?: number;
  customerPaymentsTotal?: number;
  returnsCashOut?: number;
  returnsCashIn?: number;
  returnsNet?: number;
  expensesCashOut?: number;
  expensesTotal?: number;
  purchasesCashOut?: number;
  purchasesCashPaid?: number;
  purchasesTotal?: number;
  supplierPayments?: number;
  supplierPaymentsTotal?: number;
  lateReconciliationDelta?: number;
  deposits?: number;
  withdrawals?: number;
  cashIn?: number;
  cashOut?: number;
  closingCash?: number;
  denominations?: Record<number, number>;
  notes?: string;
  note?: string;
  closedAt?: string;
  createdAt?: string;
  type?: string;
  actorUid?: string;
  createdBy?: string;
  // Date Model Foundation (Phase 2.2.5.3)
  originalEventDate?: string;
  statementDate?: string;
  actualCashDate?: string;
  postingDate?: string;
  effectiveCashDate?: string;
  syncDate?: string;
  closedDate?: string;
  isLatePosting?: boolean;
  isManagerOverride?: boolean;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  customerName?: string;
  date: string;
  amount: number;
  note?: string;
  operationId?: string;
  actorUid?: string;
  createdBy?: string;
  createdAt?: string;
  // Date Model Foundation (Phase 2.2.5.3)
  originalEventDate?: string;
  statementDate?: string;
  actualCashDate?: string;
  postingDate?: string;
  effectiveCashDate?: string;
  syncDate?: string;
  closedDate?: string;
  isLatePosting?: boolean;
  isManagerOverride?: boolean;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName?: string;
  date: string;
  amount: number;
  note?: string;
  operationId?: string;
  actorUid?: string;
  createdBy?: string;
  createdAt?: string;
  // Date Model Foundation (Phase 2.2.5.3)
  originalEventDate?: string;
  statementDate?: string;
  actualCashDate?: string;
  postingDate?: string;
  effectiveCashDate?: string;
  syncDate?: string;
  closedDate?: string;
  isLatePosting?: boolean;
  isManagerOverride?: boolean;
}

export interface LateReconciliationRecord {
  id: string;
  closedDate: string;
  originalEventDate: string;
  postingDate: string;
  effectiveCashDate?: string | null;
  transactionType: 'sale' | 'credit_sale' | 'customer_payment' | 'purchase' | 'expense' | 'return';
  transactionId: string;
  operationId?: string;
  amount: number;
  cashDelta: number;
  recordedAt: string;
  syncedAt?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  createdAt: string;
  type: 'sale' | 'purchase' | 'return' | 'exchange_in' | 'exchange_out' | 'adjustment';
  productId: string;
  productName: string;
  barcode?: string;
  qtyBefore?: number;
  delta: number;
  qtyAfter?: number;
  qty?: number; // legacy support
  referenceId?: string;
  referenceNumber?: string | number;
  note?: string;
  operationId?: string;
  actorUid?: string;
  createdBy?: string;
  repairedAt?: string;
  repairNote?: string;
}

export interface CashMovement {
  id: string;
  date: string;
  direction: 'in' | 'out';
  amount: number;
  note?: string;
  type?: string;
  operationId?: string;
  actorUid?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  details: Record<string, any>;
  actorUid: string;
  actorEmail?: string;
  actorName?: string;
  date: string;
  createdAt: string;
  createdBy?: string;
  severity?: 'info' | 'warn' | 'critical';
  hash?: string;
  prevHash?: string;
  sessionId?: string;
  localSequence?: number;
}

export type IntegrityCategory = 'treasury' | 'inventory' | 'customers' | 'suppliers' | 'bundles' | 'orphans';
export type IntegritySeverity = 'info' | 'warning' | 'critical';

export interface IntegrityIssue {
  id: string;
  category: IntegrityCategory;
  severity: IntegritySeverity;
  title: string;
  description: string;
  entityId?: string;
  entityName?: string;
  expectedValue?: any;
  actualValue?: any;
  diff?: number;
  fixable: boolean;
  autoFixAction?: 'recalculate_customer_balance' | 'recalculate_supplier_balance' | 'sync_treasury';
}

export interface IntegrityReport {
  id: string;
  timestamp: string;
  date: string;
  overallStatus: 'healthy' | 'warnings' | 'critical';
  score: number; // 0 - 100
  totalChecks: number;
  passedChecks: number;
  issues: IntegrityIssue[];
  metrics: {
    customerDebtsAccurate: boolean;
    supplierDebtsAccurate: boolean;
    stockConsistent: boolean;
    treasuryConsistent: boolean;
    orphanRecordsCount: number;
  };
}

export interface BackupSnapshotMeta {
  id: string;
  date: string;
  timestamp: string;
  trigger: 'dayClose' | 'manual' | 'scheduled' | 'pre_update';
  recordsCount: number;
  checksum: string;
  actorUid?: string;
  actorName?: string;
  sizeBytes?: number;
  summary: {
    products: number;
    invoices: number;
    purchases: number;
    customers: number;
    suppliers: number;
  };
}

export type UserRole = 'admin' | 'manager' | 'cashier' | 'stockkeeper' | 'custom' | 'user';

export interface UserPermissionSet {
  viewCostPrice: boolean;
  viewProfits: boolean;
  posSales: boolean;
  editHistoricalSales: boolean;
  salesReturns: boolean;
  inventoryManage: boolean;
  purchasesManage: boolean;
  treasuryManage: boolean;
  dayClose: boolean;
  reportsView: boolean;
  expensesManage: boolean;
  customersManage: boolean;
  suppliersManage: boolean;
  catalogDeals: boolean;
  printingTariffs: boolean;
  usersManage: boolean;
  maintenance: boolean;
  allowDiscountOverride: boolean;
  deleteInvoices: boolean;
  [key: string]: boolean;
}

export interface UserProfile {
  id?: string;
  uid: string;
  email?: string;
  name: string;
  phone?: string;
  role: UserRole;
  /** @deprecated Use pinHash instead. Kept only for backward compatibility migration. */
  pinCode?: string;
  /** Secure cryptographic hash of operator PIN (PBKDF2 or legacy SHA-256) */
  pinHash?: string;
  /** Per-employee unique cryptographic salt */
  pinSalt?: string;
  isActive?: boolean;
  permissions?: UserPermissionSet | Record<string, boolean>;
  lastLoginAt?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DBState {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  salesReturns: SalesReturn[];
  purchases: Purchase[];
  purchaseReturns?: PurchaseReturn[];
  expenses: Expense[];
  dailyClosings: DailyClosing[];
  dayCloses?: DailyClosing[];
  treasuryAdjustments?: any[];
  supplierPayments: SupplierPayment[];
  customerPayments: CustomerPayment[];
  printingTariffs: PrintingTariff[];
  operationKeys: any[];
  stockMovements: StockMovement[];
  cashMovements: CashMovement[];
  auditLogs: AuditLog[];
  userProfiles: UserProfile[];
  shopSettings?: ShopSettings;
}

export interface CatalogItem {
  productId: string;
  name: string;
  category: string;
  originalPrice: number;
  offerPrice: number;
  note: string;
}

export interface CustomerDisplayItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface CustomerDisplayPayload {
  items: CustomerDisplayItem[];
  subtotal: number;
  discount: number;
  total: number;
  receivedAmount?: number;
  changeAmount?: number;
  customerName?: string;
  loyaltyPoints?: number;
  lastScanned?: CustomerDisplayItem | null;
  status: 'idle' | 'scanning' | 'paying' | 'completed';
}

export const CUSTOMER_DISPLAY_CHANNEL = 'maktabati_customer_display_channel';
