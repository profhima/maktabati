export interface CatalogProductItem {
  id: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  institution?: string;
  grade?: string;
  term?: string;
  barcode?: string;
  costPrice: number;
  sellPrice: number;
  qty: number;
  minQty: number;
  maxQty: number;
  notes?: string;
}

export const EGYPTIAN_STATIONERY_CATALOG: CatalogProductItem[] = [
  // ==========================================
  // 1. الأدوات الكتابية وأقلام الرسم (Writing & Drawing)
  // ==========================================
  // بريما (Prima)
  {
    id: 'cat-prima-001',
    name: 'قلم جاف بريما سيلفر 100 أزرق (علبة 50 قلم)',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30,
    notes: 'القلم الجاف الشعبي الأشهر في المدارس والمكاتب المصرية'
  },
  {
    id: 'cat-prima-002',
    name: 'قلم جاف بريما سيلفر 100 أسود (علبة 50 قلم)',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-prima-003',
    name: 'قلم جاف بريما سيلفر 100 أحمر (علبة 50 قلم)',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-prima-004',
    name: 'قلم جاف بريما سبرينت أزرق 0.7 مم',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 100
  },
  {
    id: 'cat-prima-005',
    name: 'قلم جاف بريما بيانو كليك سوفت أزرق',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-prima-006',
    name: 'قلم جاف بريما كابتن ألوان مكس (طقم 10 أقلام)',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'طقم',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-prima-007',
    name: 'قلم جيل بريما توب جيل 0.5 مم أزرق',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-prima-008',
    name: 'قلم تصحيح بريما كوريكتور سائل 7 مل',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-prima-009',
    name: 'ماركر سبورة بريما وايت بورد عريض أزرق',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 40
  },
  {
    id: 'cat-prima-010',
    name: 'ماركر فسفوري هايلايتر بريما ألوان مكس (طقم 4 ألوان)',
    category: 'أدوات كتابية',
    brand: 'بريما (Prima)',
    unit: 'طقم',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },

  // روتو (Roto)
  {
    id: 'cat-roto-001',
    name: 'قلم جاف روتو ليكويد سائل 0.7 مم أزرق',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 60,
    notes: 'من أشهر الأقلام السائلة في السوق المصري'
  },
  {
    id: 'cat-roto-002',
    name: 'قلم جاف روتو ليكويد سائل 0.7 مم أسود',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 40
  },
  {
    id: 'cat-roto-003',
    name: 'قلم جاف روتو ستار كليك 0.7 مم أزرق',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-roto-004',
    name: 'قلم جاف روتو ماكس انسيابي أزرق',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-roto-005',
    name: 'قلم كوريكتور روتو قلم مزيل سن معدني 10 مل',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 40
  },
  {
    id: 'cat-roto-006',
    name: 'قلم سنون روتو تكست 0.5 مم',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-roto-007',
    name: 'قلم سنون روتو ماتيك 0.7 مم',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-roto-008',
    name: 'علبة سنون رصاص روتو هاي بوليمر 0.5 مم (2B)',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-roto-009',
    name: 'علبة سنون رصاص روتو هاي بوليمر 0.7 مم (2B)',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-roto-010',
    name: 'ماركر سبورة روتو أزرق سن مشطوف عريض',
    category: 'أدوات كتابية',
    brand: 'روتو (Roto)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 40
  },

  // فابركاستل (Faber-Castell)
  {
    id: 'cat-faber-001',
    name: 'أقلام رصاص فابركاستل جرين كلاسيك 1111 (علبة 12 قلم)',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30,
    notes: 'القلم الرصاص الأكثر مبيعاً في المدارس المصرية'
  },
  {
    id: 'cat-faber-002',
    name: 'أقلام رصاص فابركاستل جريب منقط مريح مع أستيكة',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-faber-003',
    name: 'ألوان خشب فابركاستل كلاسيك 12 لون قصير علبة كرتون',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-faber-004',
    name: 'ألوان خشب فابركاستل كلاسيك 12 لون طويل علبة كرتون',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-faber-005',
    name: 'ألوان خشب فابركاستل كلاسيك 24 لون طويل علبة معدن / كرتون',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-faber-006',
    name: 'ألوان فلوماستر فابركاستل كونكتور كبس 12 لون',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 20
  },
  {
    id: 'cat-faber-007',
    name: 'ألوان فلوماستر فابركاستل كونكتور 24 لون مع إكسسوارات',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 12
  },
  {
    id: 'cat-faber-008',
    name: 'ألوان شمع فابركاستل جامبو مثلثة 12 لون',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-faber-009',
    name: 'ممحاة فابركاستل داست فري خالية من الغبار بيضاء / خضراء',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 15,
    maxQty: 100
  },
  {
    id: 'cat-faber-010',
    name: 'براية فابركاستل علبة دورين بغطاء تجميع الرائش',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 40
  },
  {
    id: 'cat-faber-011',
    name: 'قلم جاف فابركاستل سبيد جيل 0.7 مم أزرق',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-faber-012',
    name: 'قلم رصاص رسم فابركاستل كاستل 9000 درجات (HB - 2B - 4B - 6B)',
    category: 'أدوات كتابية',
    brand: 'فابركاستل (Faber-Castell)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },

  // ديلي (Deli)
  {
    id: 'cat-deli-001',
    name: 'دباسة مكتب ديلي وسط سعة 25 ورقة معدن',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-deli-002',
    name: 'دباسة ديلي صغيرة جيب مع علبة دبابيس',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-deli-003',
    name: 'خرامة ورق ديلي معدن 2 خرم سعة 20 ورقة',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-deli-004',
    name: 'دبابيس دباسة ديلي مقاس 24/6 (باكتة 1000 دبوس)',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-deli-005',
    name: 'دبابيس دباسة ديلي مقاس 10 (علبة صغيرة)',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-deli-006',
    name: 'كاتر مشرط ديلي عريض 18 مم بقفل أمان',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-deli-007',
    name: 'علبة غيار أسلحة كاتر ديلي 18 مم (10 شفرات)',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-deli-008',
    name: 'صمغ أصابع ديلي جلو ستيك 15 جم سريع الجفاف',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 60
  },
  {
    id: 'cat-deli-009',
    name: 'صمغ سائل ديلي شفاف 50 مل برأس توزيع',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-deli-010',
    name: 'شريط لاصق ديلي شفاف عريض 4.8 سم * 40 ياردة',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'بكرة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 6,
    maxQty: 36
  },
  {
    id: 'cat-deli-011',
    name: 'سلوتيب ديلي شفاف صغير 1.8 سم * 30 ياردة (باكت 8 بكرات)',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 20
  },
  {
    id: 'cat-deli-012',
    name: 'ستيكي نوتس ديلي ورق ملاحظات لاصق ملون أصفر 3*3 بوصة',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'بلوك',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-deli-013',
    name: 'دوسيه بلاستيك ديلي 40 جيب شفاف A4',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-deli-014',
    name: 'دوسيه بلاستيك ديلي 20 جيب شفاف A4',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-deli-015',
    name: 'حافظة مستندات بكبسولة ديلي A4 ألوان شفافة',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 20,
    maxQty: 100
  },
  {
    id: 'cat-deli-016',
    name: 'آلة حاسبة ديلي علمية للمرحلة الإعدادية والثانوية (240 وظيفة)',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-deli-017',
    name: 'مقص أطفال ديلي بلاستيك آمن للأنشطة المدرسية',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-deli-018',
    name: 'مقص مكتب ديلي ستانلس ستيل 7 بوصة كبير',
    category: 'أدوات مكتبية',
    brand: 'ديلي (Deli)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },

  // ماركات كتابية إضافية (Schneider, Uni-ball, Casio, etc.)
  {
    id: 'cat-schneider-001',
    name: 'قلم جاف شنايدر توب لاينر 967 سن حديد رفيع 0.4 مم أزرق',
    category: 'أدوات كتابية',
    brand: 'شنايدر (Schneider)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-schneider-002',
    name: 'قلم جاف شنايدر ون بزنس رولر بول 0.6 مم أزرق',
    category: 'أدوات كتابية',
    brand: 'شنايدر (Schneider)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-uniball-001',
    name: 'قلم جيل يوني بول سيجنو UM-151 سن 0.38 مم أزرق ياباني',
    category: 'أدوات كتابية',
    brand: 'يوني بول (Uni-ball)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-uniball-002',
    name: 'قلم حبر سائل يوني بول آي ميكرو UB-150 أزرق 0.5 مم',
    category: 'أدوات كتابية',
    brand: 'يوني بول (Uni-ball)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-casio-001',
    name: 'آلة حاسبة علمية كاسيو أصلية fx-991ARX ClassWiz عربي وإنجليزي',
    category: 'أدوات مكتبية',
    brand: 'كاسيو (Casio)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 10,
    notes: 'الحاسبة الأساسية لطلاب الثانوية العامة والجامعات'
  },
  {
    id: 'cat-casio-002',
    name: 'آلة حاسبة علمية كاسيو fx-82ES PLUS الجيل الثاني',
    category: 'أدوات مكتبية',
    brand: 'كاسيو (Casio)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 10
  },
  {
    id: 'cat-casio-003',
    name: 'آلة حاسبة مكتبية وتجارية كاسيو شاشة كبيرة 12 رقم DJ-120D',
    category: 'أدوات مكتبية',
    brand: 'كاسيو (Casio)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 8
  },

  // ==========================================
  // 2. ورق التصوير والطباعة والكرتون (Paper, Printing & Boards)
  // ==========================================
  {
    id: 'cat-paper-001',
    name: 'ورق تصوير A4 مالتي أوفيس Multi Office برتغالي 75 جم (رزمة 500 ورقة)',
    category: 'ورق تصوير',
    brand: 'مالتي أوفيس (Multi Office)',
    unit: 'رزمة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 50,
    notes: 'الورق الأكثر انتشاراً لمراكز التصوير والمكاتب المصرية'
  },
  {
    id: 'cat-paper-002',
    name: 'ورق تصوير A4 مالتي أوفيس Multi Office برتغالي 80 جم (رزمة 500 ورقة)',
    category: 'ورق تصوير',
    brand: 'مالتي أوفيس (Multi Office)',
    unit: 'رزمة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 40
  },
  {
    id: 'cat-paper-003',
    name: 'كرتونة ورق تصوير A4 مالتي أوفيس 75 جم (5 رزم / 2500 ورقة)',
    category: 'ورق تصوير',
    brand: 'مالتي أوفيس (Multi Office)',
    unit: 'كرتونة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 20
  },
  {
    id: 'cat-paper-004',
    name: 'ورق تصوير A4 دبل إيه Double A تايلاندي 80 جم فاخر (رزمة 500 ورقة)',
    category: 'ورق تصوير',
    brand: 'دبل إيه (Double A)',
    unit: 'رزمة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30,
    notes: 'ورق ناصع البياض عالي النعومة للطباعة الفاخرة'
  },
  {
    id: 'cat-paper-005',
    name: 'ورق تصوير A4 نافيجاتور Navigator برتغالي 80 جم فائق النعومة (رزمة 500 ورقة)',
    category: 'ورق تصوير',
    brand: 'نافيجاتور (Navigator)',
    unit: 'رزمة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 25
  },
  {
    id: 'cat-paper-006',
    name: 'ورق تصوير A4 روتاتريم موندى Rotatrim 80 جم (رزمة 500 ورقة)',
    category: 'ورق تصوير',
    brand: 'روتاتريم (Rotatrim / Mondi)',
    unit: 'رزمة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 25
  },
  {
    id: 'cat-paper-007',
    name: 'ورق تصوير A4 شيمكس Chamex برازيلي 75 جم (رزمة 500 ورقة)',
    category: 'ورق تصوير',
    brand: 'شيمكس (Chamex)',
    unit: 'رزمة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 25
  },
  {
    id: 'cat-paper-008',
    name: 'ورق تصوير A3 مالتي أوفيس Multi Office 80 جم (رزمة 500 ورقة)',
    category: 'ورق تصوير',
    brand: 'مالتي أوفيس (Multi Office)',
    unit: 'رزمة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 10
  },
  {
    id: 'cat-paper-009',
    name: 'ورق صور فوتوغرافي جلوسي A4 لامع 180 جم (باكت 20 ورقة)',
    category: 'ورق تصوير',
    brand: 'عام (Generic)',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-paper-010',
    name: 'ورق صور فوتوغرافي جلوسي A4 لامع 230 جم عالي الجودة (باكت 20 ورقة)',
    category: 'ورق تصوير',
    brand: 'عام (Generic)',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-paper-011',
    name: 'ورق استيكر لاصق مطفي A4 للطباعة المباشرة (باكت 50 ورقة)',
    category: 'ورق تصوير',
    brand: 'عام (Generic)',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 20
  },
  {
    id: 'cat-paper-012',
    name: 'ورق استيكر لاصق جلوسي A4 لامع ضد الماء (باكت 50 ورقة)',
    category: 'ورق تصوير',
    brand: 'عام (Generic)',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 20
  },
  {
    id: 'cat-paper-013',
    name: 'ورق كربون أزرق A4 لنقل الكتابة اليدوية (علبة 100 ورقة)',
    category: 'أدوات مكتبية',
    brand: 'كوهينور / عام',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 10
  },
  {
    id: 'cat-paper-014',
    name: 'ورق زبدة شفاف للرسم الهندسي والأنشطة (رول / فرخ)',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'فرخ',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-paper-015',
    name: 'فرخ فوم جليتر ملون لاصق A4 (باكت 10 ألوان)',
    category: 'أدوات مكتبية',
    brand: 'أنشطة مدرسية',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-paper-016',
    name: 'فرخ فوم سادة ملون غير لاصق A4 (باكت 10 ألوان)',
    category: 'أدوات مكتبية',
    brand: 'أنشطة مدرسية',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-paper-017',
    name: 'لوحة فرخ بريستول ملون مقاس كبير (أبيض / أصفر / وردي / أزرق)',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'فرخ',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 15,
    maxQty: 100
  },
  {
    id: 'cat-paper-018',
    name: 'فرخ كرتون ناصبيان مقوى للمجسمات والمشاريع المدرسية',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'فرخ',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-paper-019',
    name: 'فرخ ورق كانسون ملون أصلي للأعمال الفنية',
    category: 'أدوات مكتبية',
    brand: 'كانسون (Canson)',
    unit: 'فرخ',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },

  // ==========================================
  // 3. الكشاكيل والكراسات والاسكتشات (Notebooks, Copybooks & Sketches)
  // ==========================================
  {
    id: 'cat-note-001',
    name: 'كشكول سلك مينترا Mintra مقاس A4 مسطر 80 ورقة ألوان وتصميمات مودرن',
    category: 'أدوات مكتبية',
    brand: 'مينترا (Mintra)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-note-002',
    name: 'كشكول سلك مينترا Mintra مقاس A4 مسطر 140 ورقة مع فواصل',
    category: 'أدوات مكتبية',
    brand: 'مينترا (Mintra)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-note-003',
    name: 'كشكول سلك مينترا 3 فواصل 150 ورقة هارد كفر',
    category: 'أدوات مكتبية',
    brand: 'مينترا (Mintra)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-note-004',
    name: 'كشكول سلك مينترا 5 فواصل 200 ورقة للمرحلة الثانوية والجامعة',
    category: 'أدوات مكتبية',
    brand: 'مينترا (Mintra)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-note-005',
    name: 'كراسة مدرسية 28 ورقة مسطر عربي (باكت 10 كراسات)',
    category: 'أدوات مكتبية',
    brand: 'برناسوس / الأستاذ',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 60
  },
  {
    id: 'cat-note-006',
    name: 'كراسة مدرسية 28 ورقة مربعات حساب (باكت 10 كراسات)',
    category: 'أدوات مكتبية',
    brand: 'برناسوس / الأستاذ',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 40
  },
  {
    id: 'cat-note-007',
    name: 'كراسة مدرسية 28 ورقة 4 أسطر إنجليزي (باكت 10 كراسات)',
    category: 'أدوات مكتبية',
    brand: 'برناسوس / الأستاذ',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 40
  },
  {
    id: 'cat-note-008',
    name: 'كشكول مدرسي 60 ورقة مسطر غلاف كرتون ملون (دستة 10 كشاكيل)',
    category: 'أدوات مكتبية',
    brand: 'برناسوس / الأستاذ',
    unit: 'دستة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-note-009',
    name: 'كشكول مدرسي 80 ورقة مسطر غلاف كرتون ملون (دستة 10 كشاكيل)',
    category: 'أدوات مكتبية',
    brand: 'برناسوس / الأستاذ',
    unit: 'دستة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-note-010',
    name: 'كشكول مدرسي 100 ورقة مسطر غلاف مقوى كرتون',
    category: 'أدوات مكتبية',
    brand: 'برناسوس / الأستاذ',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-note-011',
    name: 'اسكتش رسم كانسون Canson إيطالي سلك مقاس صغير A4 ورق كانسون 150 جم',
    category: 'أدوات مكتبية',
    brand: 'كانسون (Canson)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-note-012',
    name: 'اسكتش رسم كانسون Canson سلك مقاس كبير ربع فرخ A3 ورق 150 جم',
    category: 'أدوات مكتبية',
    brand: 'كانسون (Canson)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-note-013',
    name: 'كراسة رسم صغيرة مدرسية 16 ورقة للأطفال',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 15,
    maxQty: 60
  },
  {
    id: 'cat-note-014',
    name: 'كراسة رسم كبيرة مدرسية 24 ورقة سلك',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-note-015',
    name: 'رول جلاد كتب شفاف ذاتي اللصق مقاس 5 متر (تجليد بدون سيلوتيب)',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'رول',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 60
  },
  {
    id: 'cat-note-016',
    name: 'أكياس جلاد كشاكيل ملونة جاهزة (باكت 10 جلادات بألوان مبهجة)',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-note-017',
    name: 'استيكر تيكت أسماء وكتابة بيانات الطلاب بتصميمات كرتونية (شيت 12 استيكر)',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'شيت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 20,
    maxQty: 100
  },

  // ==========================================
  // 4. اللانش بوكس وحافظات الطعام (Lunch Boxes)
  // ==========================================
  {
    id: 'cat-lunch-001',
    name: 'لانش بوكس مينترا Mintra مقسم 3 خانات مع ملعقة وشوكة BPA Free',
    category: 'لانش بوكس',
    brand: 'مينترا (Mintra)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20,
    notes: 'اللانش بوكس الأكثر طلباً في بداية الموسم الدراسي'
  },
  {
    id: 'cat-lunch-002',
    name: 'لانش بوكس مينتra دورين طبقات بسعة 1.5 لتر مع غطاء محكم الغلق',
    category: 'لانش بوكس',
    brand: 'مينترا (Mintra)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-lunch-003',
    name: 'لانش بوكس الهلال والنجمة كلاسيك مقسم خانتين ألوان مكس',
    category: 'لانش بوكس',
    brand: 'الهلال والنجمة',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-lunch-004',
    name: 'لانش بوكس رويال مقسم برسومات كرتونية (سبايدرمان / فروزن / باربي)',
    category: 'لانش بوكس',
    brand: 'رويال (Royal)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-lunch-005',
    name: 'لانش بوكس سيليكون قابل للطي وموفر للمساحة مع ملعقة',
    category: 'لانش بوكس',
    brand: 'مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 12
  },
  {
    id: 'cat-lunch-006',
    name: 'لانش بوكس ستانلس ستيل معزول حرارياً صحي 100% غطاء كليبسات',
    category: 'لانش بوكس',
    brand: 'مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 10
  },
  {
    id: 'cat-lunch-007',
    name: 'لانش باج Lunch Bag حقيبة حفظ حرارية مبطنة فويل عازل بحزام كتف',
    category: 'لانش بوكس',
    brand: 'عام (Generic)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-lunch-008',
    name: 'طقم لانش بوكس + زمزمية متطابقة في كرتونة هدية مدرسية',
    category: 'لانش بوكس',
    brand: 'مينترا / رويال',
    unit: 'طقم',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },

  // ==========================================
  // 5. زجاجات المياه والزمزميات والماجات (Water Bottles & Flasks)
  // ==========================================
  {
    id: 'cat-bottle-001',
    name: 'زمزمية مياه مينترا Mintra سعة 650 مل غطاء أوتوماتيك بزر ضغط كبس BPA Free',
    category: 'زجاجات مياه',
    brand: 'مينترا (Mintra)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-bottle-002',
    name: 'زمزمية مياه مينترا Mintra سبورت 750 مل بشاليموه سيليكون صحي',
    category: 'زجاجات مياه',
    brand: 'مينترا (Mintra)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-bottle-003',
    name: 'زمزمية مياه مينترا جامبو 1 لتر مدرجة بتوقيتات الشرب التحفيزية',
    category: 'زجاجات مياه',
    brand: 'مينترا (Mintra)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-bottle-004',
    name: 'زمزمية تانك Tank أصلية معزولة للحفاظ على البرودة 0.65 لتر',
    category: 'زجاجات مياه',
    brand: 'تانك (Tank)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-bottle-005',
    name: 'زمزمية تانك Tank ميجا 1.25 لتر مع يد تعليق ومقبض مريح',
    category: 'زجاجات مياه',
    brand: 'تانك (Tank)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 10
  },
  {
    id: 'cat-bottle-006',
    name: 'زمزمية أطفال برسومات كرتونية بحزام تعليق ورقبة أمان مانعة للتسريب',
    category: 'زجاجات مياه',
    brand: 'رويال / مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-bottle-007',
    name: 'ماج حراري ستانلس ستيل معزول ترافيل ماج 500 مل حافظ للحرارة 8 ساعات',
    category: 'زجاجات مياه',
    brand: 'مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 12
  },
  {
    id: 'cat-bottle-008',
    name: 'زجاجة مياه زجاج بغلاف حماية سيليكون مانع للانزلاق 450 مل',
    category: 'زجاجات مياه',
    brand: 'مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },

  // ==========================================
  // 6. الشنط المدرسية والمقالم وحافظات الأدوات (School Bags & Pencil Cases)
  // ==========================================
  {
    id: 'cat-bag-001',
    name: 'شنطة ظهر مدرسية للمرحلة الابتدائية خامة ووتربروف متعددة السوست أشكال أولاد',
    category: 'أخرى',
    brand: 'محلي / مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 15
  },
  {
    id: 'cat-bag-002',
    name: 'شنطة ظهر مدرسية للمرحلة الابتدائية خامة ووتربروف أشكال بنات وأميرات',
    category: 'أخرى',
    brand: 'محلي / مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 15
  },
  {
    id: 'cat-bag-003',
    name: 'شنطة مدرسية ترولي بعجل ومقبض جرار ثلاثي للسلالم مريحة للظهر',
    category: 'أخرى',
    brand: 'محلي / مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 1,
    maxQty: 8
  },
  {
    id: 'cat-bag-004',
    name: 'شنطة ظهر كاجوال للدروس والإعدادي/الثانوي خفيفة ومبطنة سادة وكاروهات',
    category: 'أخرى',
    brand: 'مينترا / محلي',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-bag-005',
    name: 'شنطة لابتوب ظهر مع مخرج شحن USB وجيب مبطن للابتوب 15.6 بوصة',
    category: 'أخرى',
    brand: 'مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 10
  },
  {
    id: 'cat-bag-006',
    name: 'شنطة حضانة وكي جي أطفال مجسمة 3D شخصيات كرتونية محبوبة',
    category: 'أخرى',
    brand: 'محلي / مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-bag-007',
    name: 'مقلمة قماش سوستة فردية كلاسيك ألوان متنوعة',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-bag-008',
    name: 'مقلمة قماش سوستتين كبيرة للمسطرة والألوان والأدوات الهندسية',
    category: 'أدوات مكتبية',
    brand: 'مينترا / عام',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-bag-009',
    name: 'مقلمة سيليكون 3D بارزة ضد الماء برسومات لطيفة للأطفال',
    category: 'أدوات مكتبية',
    brand: 'مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-bag-010',
    name: 'مقلمة معدن مغناطيسية دورين بجدول مواعيد وبراية مدمجة',
    category: 'أدوات مكتبية',
    brand: 'مستورد',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 20
  },
  {
    id: 'cat-bag-011',
    name: 'مقلمة شفافة شبك لامتحانات الثانوية العامة والجامعة مصرح بها في اللجان',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 60,
    notes: 'مطلوبة جداً في مواسم امتحانات نهاية العام'
  },

  // ==========================================
  // 7. الألعاب الترفيهية والذكاء والمصغرات للأطفال (Toys, Games & Slime)
  // ==========================================
  {
    id: 'cat-toy-001',
    name: 'كروت لعبة أونو UNO الأصلية الورقية للكبار والصغار',
    category: 'أخرى',
    brand: 'ألعاب ترفيهية',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-toy-002',
    name: 'لعبة بنك الحظ المصري الشهيرة مع النرد والفلوس والشيكات وكروت الحظ',
    category: 'أخرى',
    brand: 'ألعاب مصرية',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-toy-003',
    name: 'لعبة السلم والتعبان + لودو 2 في 1 لوح خشبي/كرتون',
    category: 'أخرى',
    brand: 'ألعاب مصرية',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-toy-004',
    name: 'شطرنج خشب كلاسيكي مقاس متوسط مع قطع خشبية كاملة',
    category: 'أخرى',
    brand: 'ألعاب ذكاء',
    unit: 'طقم',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 2,
    maxQty: 10
  },
  {
    id: 'cat-toy-005',
    name: 'دومينو عظم كلاسيك مصري علبة خشب/بلاستيك 28 قطعة',
    category: 'أخرى',
    brand: 'ألعاب مصرية',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-toy-006',
    name: 'كوتشينة ورق لعب بلاستيك فاخر مقاوم للماء والانحناء',
    category: 'أخرى',
    brand: 'عام (Generic)',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-toy-007',
    name: 'مكعب روبيك السحري لتدريب الذكاء 3*3 دوران سريع وسلس',
    category: 'أخرى',
    brand: 'ألعاب ذكاء',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-toy-008',
    name: 'صلصال بريما / ديلي غير سام طبيعي 6 أصابع ألوان مع قوالب تشكيل',
    category: 'أدوات مكتبية',
    brand: 'بريما / ديلي',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-toy-009',
    name: 'صلصال طبي 12 لون مع قطاعات وقوالب تشكيل بلاستيك',
    category: 'أدوات مكتبية',
    brand: 'بريما / أطلس',
    unit: 'علبة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-toy-010',
    name: 'سلايم كريستال شفاف بروائح الفواكه وجليتر للأطفال (علبة كبسولة)',
    category: 'أخرى',
    brand: 'ألعاب أطفال',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-toy-011',
    name: 'صلصال فوم خفيف هوائي سحري فائق النعومة (كيس 12 لون مع أدوات)',
    category: 'أدوات مكتبية',
    brand: 'ألعاب أطفال',
    unit: 'كيس',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-toy-012',
    name: 'رمل سحري كينتيك ساند للأطفال رمل علاجي لا يجف مع قوالب قلعة',
    category: 'أخرى',
    brand: 'ألعاب أطفال',
    unit: 'طقم',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-toy-013',
    name: 'بازل خشبي تعليمي للأطفال (حروف عربية / إنجليزية / أرقام وحيوانات)',
    category: 'أخرى',
    brand: 'تعليمي',
    unit: 'لوحة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-toy-014',
    name: 'فقاعات صابون ومسدس بابلز يدوي مبهج للأطفال',
    category: 'أخرى',
    brand: 'ألعاب أطفال',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 40
  },
  {
    id: 'cat-toy-015',
    name: 'سيارات معدنية مصغرة أشكال سباق وماتش بوكس للأولاد',
    category: 'أخرى',
    brand: 'ألعاب أطفال',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-toy-016',
    name: 'يويو مضيء مع ليد وسبينر ترفيهي للأطفال',
    category: 'أخرى',
    brand: 'ألعاب أطفال',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 40
  },

  // ==========================================
  // 8. الهدايا والبوكسات والميداليات والإكسسوارات (Gifts & Accessories)
  // ==========================================
  {
    id: 'cat-gift-001',
    name: 'بوكس هدايا كرتون مقوى فاخر غطاء منفصل مقاسات (صغير / وسط / كبير)',
    category: 'أخرى',
    brand: 'هدايا ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-gift-002',
    name: 'بوكس هدايا على شكل قلب رومانسي مع فيونكة ستان',
    category: 'أخرى',
    brand: 'هدايا ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-gift-003',
    name: 'كيس هدايا ورقي كرافت ملون بتصميمات راقية ومقابض حبل مقاسات',
    category: 'أخرى',
    brand: 'هدايا ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 15,
    maxQty: 80
  },
  {
    id: 'cat-gift-004',
    name: 'قش هدايا ملون شرائح ورق مبهجة لتزيين علب الهدايا (كيس 50 جم)',
    category: 'أخرى',
    brand: 'هدايا ومناسبات',
    unit: 'كيس',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-gift-005',
    name: 'شريط ستان ملون عريض 2.5 سم لتغليف الهدايا والبوكيهات (بكرة 25 ياردة)',
    category: 'أخرى',
    brand: 'هدايا ومناسبات',
    unit: 'بكرة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-gift-006',
    name: 'ميدالية مفاتيح سيليكون شخصيات أنمي ومارفل وكرة قدم تريند',
    category: 'أخرى',
    brand: 'إكسسوارات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 60
  },
  {
    id: 'cat-gift-007',
    name: 'نوت بوك هدايا هارد كفر فاخر بقفل مغناطيسي وقلم معدني أنيق في علبة',
    category: 'أخرى',
    brand: 'هدايا راقية',
    unit: 'طقم',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },
  {
    id: 'cat-gift-008',
    name: 'كروت معايدة وتهنئة بمختلف المناسبات (عيد ميلاد / نجاح / أفراح / شكر)',
    category: 'أخرى',
    brand: 'هدايا ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 15,
    maxQty: 60
  },
  {
    id: 'cat-gift-009',
    name: 'محفظة نقود جيب صغيرة للأطفال والشباب بأشكال كرتونية وسادة',
    category: 'أخرى',
    brand: 'إكسسوارات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },

  // ==========================================
  // 9. مستلزمات أعياد الميلاد والحفلات والسبوع (Birthday & Party Supplies)
  // ==========================================
  {
    id: 'cat-party-001',
    name: 'شمع أرقام أعياد ميلاد ذهبي وفضي جليتر للأعمار من 0 إلى 9',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50,
    notes: 'أساسي جداً في طلبات أعياد الميلاد السريعة'
  },
  {
    id: 'cat-party-002',
    name: 'شمع نوافير شرار تورتة (فونتانا نارية آمنة للحفلات بطول 15 سم)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 60
  },
  {
    id: 'cat-party-003',
    name: 'شمع سحري أعياد ميلاد لا ينطفئ بالنفخ (باكت 10 شمعات)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-party-004',
    name: 'شمعة الزهرة الموسيقية المتفتحة المضيئة مع أغنية Happy Birthday',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 20
  },
  {
    id: 'cat-party-005',
    name: 'بالونات لاتكس ملونة وميتاليك عالية الجودة (كيس 100 بالونة مكس)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'كيس',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-party-006',
    name: 'بالونات أرقام فويل كبيرة مقاس 32 / 40 بوصة هيليوم ويدوي (ذهبي / فضي / وردي)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-party-007',
    name: 'لافتة وبانر زينة حائط كرتون Happy Birthday حروف مجسمة مع شريط تعليق',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'طقم',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-party-008',
    name: 'ستارة زينة فويل شراشيب لامعة لخلفيات التصوير مقاس 1*2 متر (ذهبي / فضي / أسود)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-party-009',
    name: 'طراطير وقبعات أعياد ميلاد كرتونية ملونة للأطفال (دستة 10 طراطير)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'دستة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 25
  },
  {
    id: 'cat-party-010',
    name: 'أطباق كرتون أعياد ميلاد مقاس تورتة ملونة وشخصيات (باكت 10 أطباق)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-party-011',
    name: 'أكواب كرتون للمشروبات والعصائر أعياد ميلاد (باكت 10 أكواب)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-party-012',
    name: 'شوك وملاعق بلاستيك ملونة صلبة للجاتوه والتورتة (باكت 12 قطعة)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'باكت',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-party-013',
    name: 'توبر تورتة اكريليك فاخر ذهبي وأسود Happy Birthday / مبروك التخرج',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-party-014',
    name: 'اسبراي ثلج سنوو بارتي وخيوط ملونة رشاش أعياد ميلاد (عبوة 250 مل)',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 6,
    maxQty: 36
  },
  {
    id: 'cat-party-015',
    name: 'مدفع قصاصات ورقية كونفيتي Confetti بوبر مفرقعات احتفالات ملونة 30 سم',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-party-016',
    name: 'منفاخ بالونات يدوي سريع لملء البالونات بدون مجهود',
    category: 'أخرى',
    brand: 'حفلات ومناسبات',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 3,
    maxQty: 15
  },

  // ==========================================
  // 10. أدوات هندسية ومساطر ولوازم تصحيح وتجليد (Geometry & Rulers)
  // ==========================================
  {
    id: 'cat-geom-001',
    name: 'طقم هندسي كامل للرياضيات والشهادة الإعدادية والثانوية (برجل ومثلثين ومنقلة ومسطرة وممحاة)',
    category: 'أدوات مكتبية',
    brand: 'فابركاستل / ديلي / روتو',
    unit: 'طقم',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 40
  },
  {
    id: 'cat-geom-002',
    name: 'مسطرة بلاستيك شفافة 30 سم غير قابلة للكسر مرنة ومدرجة',
    category: 'أدوات مكتبية',
    brand: 'ديلي / بريما',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 60
  },
  {
    id: 'cat-geom-003',
    name: 'مسطرة حديد ستانلس ستيل 30 سم للقطع والأعمال الفنية',
    category: 'أدوات مكتبية',
    brand: 'ديلي / عام',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-geom-004',
    name: 'مسطرة فينيل أشكال فين وفيل كرتونية للأطفال 20 سم',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  },
  {
    id: 'cat-geom-005',
    name: 'برجل معدني دقيق للرسم الهندسي مع سن رصاص إضافي',
    category: 'أدوات مكتبية',
    brand: 'روتو / ديلي',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 5,
    maxQty: 30
  },
  {
    id: 'cat-geom-006',
    name: 'منقلة هندسية 180 درجة بلاستيك شفاف دقيقة القياس',
    category: 'أدوات مكتبية',
    brand: 'عام (Generic)',
    unit: 'قطعة',
    costPrice: 0,
    sellPrice: 0,
    qty: 0,
    minQty: 10,
    maxQty: 50
  }
];

/**
 * Generate UTF-8 with BOM CSV format for Excel Arabic compatibility
 */
export function exportCatalogToCsv(): string {
  const headers = [
    'كود الصنف',
    'اسم الصنف',
    'الفئة الرئيسية',
    'الماركة / العلامة التجارية',
    'وحدة القياس',
    'سعر الشراء (التكلفة)',
    'سعر البيع للمستهلك',
    'الكمية الابتدائية بالمخزن',
    'الحد الأدنى للطلب',
    'الحد الأقصى للمخزون',
    'ملاحظات وتفاصيل'
  ];

  const rows = EGYPTIAN_STATIONERY_CATALOG.map(item => [
    `"${item.id}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.category}"`,
    `"${item.brand}"`,
    `"${item.unit}"`,
    item.costPrice.toString(),
    item.sellPrice.toString(),
    item.qty.toString(),
    item.minQty.toString(),
    item.maxQty.toString(),
    `"${(item.notes || '').replace(/"/g, '""')}"`
  ]);

  // UTF-8 BOM: \uFEFF ensures Excel opens Arabic correctly
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  return csvContent;
}

/**
 * Trigger direct download of the master catalog in CSV (Excel) format
 */
export function downloadCatalogCsv(filename = 'دليل_سلع_المكتبات_المصرية_الشامل.csv') {
  const csv = exportCatalogToCsv();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Trigger direct download of the master catalog in JSON format
 */
export function downloadCatalogJson(filename = 'دليل_سلع_المكتبات_المصرية_الشامل.json') {
  const dataStr = JSON.stringify(EGYPTIAN_STATIONERY_CATALOG, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
