export type ReportType =
  // 1. Purchase Predictions & Replenishment (5)
  | 'forecast_stockout'
  | 'purchase_order_plan'
  | 'seasonal_surge'
  | 'fast_movers'
  | 'bulk_savings'
  // 2. Inventory & Product Intelligence (5)
  | 'abc_analysis'
  | 'deadstock'
  | 'inventory_turnover'
  | 'stock_valuation'
  | 'margin_by_product'
  // 3. Sales & Customer Analytics (6)
  | 'pnl'
  | 'bestsellers'
  | 'category_sales'
  | 'printing_services'
  | 'vip_customers'
  | 'receivables_aging'
  // 4. Suppliers, Expenses & Cash Flow (4)
  | 'supplier_balances'
  | 'expense_breakdown'
  | 'cash_flow'
  | 'returns_impact'
  // 5. Executive & Decision Hub (4)
  | 'smart_alerts'
  | 'decision_center'
  | 'executive_dashboard'
  | 'business_health_score';

import {
  Sparkles,
  ShoppingCart,
  Calendar,
  TrendingUp,
  DollarSign,
  Layers,
  AlertTriangle,
  Boxes,
  FileText,
  Award,
  BarChart3,
  Printer,
  Users,
  Clock,
  Truck,
  Wallet,
  RotateCcw,
  BadgeAlert,
  SlidersHorizontal
} from 'lucide-react';

export interface ReportMeta {
  id: ReportType;
  title: string;
  category: 'predictions' | 'inventory' | 'sales' | 'suppliers_finance' | 'executive';
  icon: any;
  badge?: string;
  desc: string;
}

export const REPORT_DEFINITIONS: ReportMeta[] = [
  // --- 1. Purchase Predictions (5) ---
  {
    id: 'forecast_stockout',
    title: 'توقع موعد نفاد المخزون وسرعة السحب',
    category: 'predictions',
    icon: Sparkles,
    badge: 'ذكاء اصطناعي وتنبؤ',
    desc: 'حساب معدل الاستهلاك اليومي والتنبؤ بالأيام المتبقية حتى نفاد كل صنف تماماً'
  },
  {
    id: 'purchase_order_plan',
    title: 'خطة الشراء المقترحة ومسودة أمر التوريد',
    category: 'predictions',
    icon: ShoppingCart,
    badge: 'إعادة الطلب',
    desc: 'قائمة الأصناف المطلوبة فوراً للشراء مع الكميات المقترحة وتكلفة الطلبية التقديرية'
  },
  {
    id: 'seasonal_surge',
    title: 'توقعات الموسم المدرسي ومضاعف الذروة',
    category: 'predictions',
    icon: Calendar,
    badge: 'مواسم',
    desc: 'تقدير احتياجات الأدوات المدرسية والكراريس ومضاعفة الكميات لموسم بداية العام والترم'
  },
  {
    id: 'fast_movers',
    title: 'أصناف فائقة السرعة مع خطر نفاد وشيك',
    category: 'predictions',
    icon: TrendingUp,
    badge: 'طوارئ',
    desc: 'المنتجات الأكثر مبيعاً ذات رصيد منخفض قد ينفد خلال أقل من 7 أيام'
  },
  {
    id: 'bulk_savings',
    title: 'تحليل وفورات الشراء بالجملة والكرتونة',
    category: 'predictions',
    icon: DollarSign,
    badge: 'توفير',
    desc: 'مقارنة الشراء بالدستة/الكرتونة لحساب هامش التوفير المحقق وتأثيره على السيولة'
  },

  // --- 2. Inventory Intelligence (5) ---
  {
    id: 'abc_analysis',
    title: 'تحليل باريتو ABC للمخزون (قاعدة 80/20)',
    category: 'inventory',
    icon: Layers,
    badge: 'تحليل استراتيجي',
    desc: 'تصنيف المخزون إلى الفئة A (80% من الإيرادات)، B (15%)، C (5%) للتركيز على الأهم'
  },
  {
    id: 'deadstock',
    title: 'المخزون الراكد ورأس المال المعطل',
    category: 'inventory',
    icon: AlertTriangle,
    badge: 'ركود',
    desc: 'أصناف متوفرة في المخزن بدون أي حركة بيع خلال آخر 60 يوماً مع تقدير قيمتها المعطلة'
  },
  {
    id: 'inventory_turnover',
    title: 'معدل دوران المخزون (Turnover Ratio)',
    category: 'inventory',
    icon: Boxes,
    desc: 'قياس كفاءة تحويل البضاعة إلى سيولة وسرعة بيع المخزون خلال الفترة'
  },
  {
    id: 'stock_valuation',
    title: 'تقييم المخزون المالي (التكلفة vs البيع)',
    category: 'inventory',
    icon: FileText,
    desc: 'حساب إجمالي رأس المال المستثمر في البضاعة والأرباح الكامنة غير المحققة'
  },
  {
    id: 'margin_by_product',
    title: 'تحليل هوامش الربحية للأصناف والماركات',
    category: 'inventory',
    icon: Award,
    desc: 'ترتيب الأصناف حسب نسبة هامش الربح المحقق لكشف المنتجات الأعلى والأقل ربحية'
  },

  // --- 3. Sales & Customer Analytics (6) ---
  {
    id: 'pnl',
    title: 'قائمة الدخل والأرباح والخسائر (P&L)',
    category: 'sales',
    icon: BarChart3,
    badge: 'قائمة الدخل',
    desc: 'الإيرادات الصافية، تكلفة البضاعة المباعة COGS، المصروفات، وصافي الربح التشغيلي'
  },
  {
    id: 'bestsellers',
    title: 'تقرير الأصناف الأكثر مبيعاً وإيراداً',
    category: 'sales',
    icon: Award,
    desc: 'ترتيب المنتجات حسب الكميات المباعة وإجمالي الإيراد والأرباح المحققة'
  },
  {
    id: 'category_sales',
    title: 'مبيعات وأرباح الفئات والأقسام',
    category: 'sales',
    icon: Layers,
    desc: 'تحليل مساهمة كل قسم (أدوات مكتبية، كتب، هدايا، خردوات) في إجمالي المبيعات'
  },
  {
    id: 'printing_services',
    title: 'أرباح خدمات التصوير والطباعة والتجليد',
    category: 'sales',
    icon: Printer,
    desc: 'إيرادات خدمات التصوير والطباعة ومبيعات الورق مع عزل التكلفة التشغيلية'
  },
  {
    id: 'vip_customers',
    title: 'كبار العملاء وحجم سحوباتهم (VIP)',
    category: 'sales',
    icon: Users,
    desc: 'قائمة بأكثر العملاء شراءً مع متوسط قيمة سلة الشراء ونقاط الولاء'
  },
  {
    id: 'receivables_aging',
    title: 'أعمار ديون العملاء والذمم الآجلة',
    category: 'sales',
    icon: Clock,
    badge: 'تحصيل',
    desc: 'كشف بأرصدة العملاء الآجلة ومتابعة المبالغ المستحقة للتحصيل الفوري'
  },

  // --- 4. Suppliers, Expenses & Cash Flow (4) ---
  {
    id: 'supplier_balances',
    title: 'كشف حسابات ومستحقات الموردين',
    category: 'suppliers_finance',
    icon: Truck,
    desc: 'الفواتير المستحقة للموردين وإجمالي المديونيات وجدول السداد القادم'
  },
  {
    id: 'expense_breakdown',
    title: 'هيكل المصروفات التشغيلية والنثرية',
    category: 'suppliers_finance',
    icon: Wallet,
    desc: 'تحليل بنود الصرف (إيجار، كهرباء، صيانة، بوفيه، مرتبات) ونسبتها من الإيرادات'
  },
  {
    id: 'cash_flow',
    title: 'حركة الخزينة والسيولة النقدية',
    category: 'suppliers_finance',
    icon: DollarSign,
    desc: 'المقبوضات النقدية والمدفوعات وصافي التدفق النقدي اليومي والشهري'
  },
  {
    id: 'returns_impact',
    title: 'معدل المرتجعات والتسرب المالي',
    category: 'suppliers_finance',
    icon: RotateCcw,
    badge: 'جودة',
    desc: 'نسبة المرتجعات إلى المبيعات والأصناف الأكثر إرجاعاً وأثرها على هوامش الربح'
  },

  // --- 5. Executive & Decision Hub (4) ---
  {
    id: 'smart_alerts',
    title: '🚨 التنبيهات الذكية والرقابة الاستباقية',
    category: 'executive',
    icon: BadgeAlert,
    badge: 'رقابة فورية',
    desc: 'مراقبة فورية لأخطاء المخزون السالب، المنتجات غير المسعرة، النواقص، والتكدس، والمستحقات'
  },
  {
    id: 'decision_center',
    title: '🧠 مركز القرار والتوجيه التنفيذي',
    category: 'executive',
    icon: SlidersHorizontal,
    badge: 'توجيه الإدارة',
    desc: 'توصيات وقرارات مقترحة فورية لإعادة الشراء، تصريف الركود، تحصيل الديون، وضبط الهوامش'
  },
  {
    id: 'executive_dashboard',
    title: '🧭 لوحة المدير التنفيذية الشاملة',
    category: 'executive',
    icon: Layers,
    badge: 'شامل ومكثف',
    desc: 'نظرة بانورامية موحدة لقيمة المخزون، المبيعات، المحصل، المستحقات، المشتريات، والمصروفات'
  },
  {
    id: 'business_health_score',
    title: '📈 مؤشر صحة النشاط (Health Score 0-100)',
    category: 'executive',
    icon: TrendingUp,
    badge: 'مؤشر مركب',
    desc: 'تقييم شامل مركب من 100 يقيس كفاءة الهوامش، التحصيل، وفرة البضاعة، ودوران رأس المال'
  }
];
