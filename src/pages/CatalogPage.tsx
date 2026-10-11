import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, todayStr } from '../lib/utils';
import { CATEGORIES, GRADES, TERMS, SHOP_NAME, SHOP_ADDRESS, SHOP_PHONES } from '../lib/constants';
import { exportElementToPdf, sharePdfFile } from '../lib/pdfExporter';
import {
  generateExhibitionCatalogHtml,
  generateWhatsAppCatalogMessage,
  CatalogItemOffer
} from '../lib/catalogTemplate';
import {
  Newspaper,
  Sparkles,
  Download,
  Share2,
  Printer,
  Copy,
  ShoppingCart,
  Search,
  Filter,
  CheckSquare,
  Square,
  Tag,
  Percent,
  Flame,
  Layers,
  Eye,
  Settings,
  HelpCircle,
  TrendingDown,
  FileText,
  Loader2,
  Trash2,
  RefreshCw,
  Plus
} from 'lucide-react';

const PROMO_BADGES = [
  'تصفية كبرى 🔥',
  'عرض خاص 🌟',
  'أقل سعر بالمحافظة 💥',
  'سعر الجملة قطاعي 📦',
  'توفير مضاعف 💰',
  'حتى نفاد المخزون ⏳',
  'خصم خاص 🏷️'
];

export const CatalogPage: React.FC = () => {
  const { db, showPrintModal, setSaleCartItems, goTo, toast } = useApp();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'builder' | 'preview'>('builder');

  // Filters for inventory selection
  const [searchQ, setSearchQ] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('');
  const [onlyStagnant, setOnlyStagnant] = useState(false); // Filter unsold / excess stock

  // Magazine Metadata & Settings
  const [catalogTitle, setCatalogTitle] = useState('مجلة عروض وتخفيضات معرض الكتب والأدوات المدرسية');
  const [catalogSubtitle, setCatalogSubtitle] = useState('أقوى العروض والتخفيضات الحصرية • كميات محدودة حتى نفاد المخزون');
  const [validUntil, setValidUntil] = useState('ساري حتى نفاد الكمية المتاحة');
  const [catalogNote, setCatalogNote] = useState('العروض سارية بالمعرض والتوصيل متاح عبر رسائل الواتساب.');
  const [catalogTheme, setCatalogTheme] = useState<'gold' | 'emerald' | 'navy'>('gold');
  const [columnsCount, setColumnsCount] = useState<2 | 3>(3);

  // Selected Offer Items map: key = productId, value = Offer Details
  const [selectedOffers, setSelectedOffers] = useState<Record<string, CatalogItemOffer>>({});

  // Loading States for PDF
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);

  // Global Quick Discount Apply
  const [globalDiscountPct, setGlobalDiscountPct] = useState<number>(20);

  // Identify stagnant / excess inventory products (e.g. qty >= 5 or cost > 0)
  const products = db.products || [];

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const q = searchQ.trim().toLowerCase();
      const hay = `${p.name} ${p.barcode || ''} ${p.institution || ''} ${p.category} ${p.grade || ''} ${p.term || ''}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (selectedCategory && p.category !== selectedCategory) return false;
      if (selectedGrade && p.grade !== selectedGrade) return false;
      if (selectedTerm && p.term !== selectedTerm) return false;
      if (onlyStagnant && (p.qty || 0) < 5) return false; // excess / stagnant threshold
      return true;
    });
  }, [products, searchQ, selectedCategory, selectedGrade, selectedTerm, onlyStagnant]);

  // Selected items as array
  const offerItemsList = useMemo(() => {
    return Object.values(selectedOffers);
  }, [selectedOffers]);

  // Total Savings
  const totalOriginal = offerItemsList.reduce((s, it) => s + (it.originalPrice || 0), 0);
  const totalOffer = offerItemsList.reduce((s, it) => s + (it.offerPrice || 0), 0);
  const totalSavings = totalOriginal - totalOffer;
  const avgDiscount = totalOriginal > 0 ? Math.round((totalSavings / totalOriginal) * 100) : 0;

  // Toggle single product selection
  const toggleProductSelection = (p: any) => {
    setSelectedOffers(prev => {
      const copy = { ...prev };
      if (copy[p.id]) {
        delete copy[p.id];
      } else {
        const orig = Number(p.sellPrice) || 0;
        const discPct = 20; // default 20%
        const offer = Math.max(1, Math.round(orig * (1 - discPct / 100)));
        copy[p.id] = {
          productId: p.id,
          name: p.name,
          category: p.category,
          institution: p.institution,
          grade: p.grade,
          term: p.term,
          originalPrice: orig,
          offerPrice: offer,
          discountPercent: discPct,
          badge: 'تخفيض خاص 🔥',
          qtyAvailable: p.qty || 0
        };
      }
      return copy;
    });
  };

  // Select all filtered items
  const selectAllFiltered = () => {
    const next = { ...selectedOffers };
    filteredProducts.forEach(p => {
      if (!next[p.id]) {
        const orig = Number(p.sellPrice) || 0;
        const discPct = 20;
        const offer = Math.max(1, Math.round(orig * (1 - discPct / 100)));
        next[p.id] = {
          productId: p.id,
          name: p.name,
          category: p.category,
          institution: p.institution,
          grade: p.grade,
          term: p.term,
          originalPrice: orig,
          offerPrice: offer,
          discountPercent: discPct,
          badge: 'تخفيض خاص 🔥',
          qtyAvailable: p.qty || 0
        };
      }
    });
    setSelectedOffers(next);
    toast(`✅ تم تحديد ${filteredProducts.length} صنف للمجلة`);
  };

  // Clear all selections
  const clearSelections = () => {
    setSelectedOffers({});
    toast('تم إلغاء تحديد الأصناف');
  };

  // Update offer price or discount % for a specific item
  const updateOfferPrice = (productId: string, newOfferPrice: number) => {
    setSelectedOffers(prev => {
      const it = prev[productId];
      if (!it) return prev;
      const orig = it.originalPrice || 0;
      const offer = Math.max(0, newOfferPrice);
      const disc = orig > 0 ? Math.round(((orig - offer) / orig) * 100) : 0;
      return {
        ...prev,
        [productId]: {
          ...it,
          offerPrice: offer,
          discountPercent: disc
        }
      };
    });
  };

  const updateOfferDiscountPct = (productId: string, pct: number) => {
    setSelectedOffers(prev => {
      const it = prev[productId];
      if (!it) return prev;
      const orig = it.originalPrice || 0;
      const offer = Math.max(1, Math.round(orig * (1 - pct / 100)));
      return {
        ...prev,
        [productId]: {
          ...it,
          offerPrice: offer,
          discountPercent: pct
        }
      };
    });
  };

  const updateOfferBadge = (productId: string, badge: string) => {
    setSelectedOffers(prev => {
      const it = prev[productId];
      if (!it) return prev;
      return {
        ...prev,
        [productId]: { ...it, badge }
      };
    });
  };

  // Apply batch discount % to all selected items
  const applyGlobalDiscount = (pct: number) => {
    setSelectedOffers(prev => {
      const next: Record<string, CatalogItemOffer> = {};
      Object.entries(prev).forEach(([id, it]: [string, CatalogItemOffer]) => {
        const orig = it.originalPrice || 0;
        const offer = Math.max(1, Math.round(orig * (1 - pct / 100)));
        next[id] = {
          ...it,
          offerPrice: offer,
          discountPercent: pct,
          badge: pct >= 30 ? 'تصفية كبرى 🔥' : 'عرض خاص 🌟'
        };
      });
      return next;
    });
    toast(`✅ تم تطبيق خصم ${pct}% على جميع الأصناف المختارة بالمجلة`);
  };

  // Generate HTML options
  const getCatalogOptions = () => ({
    title: catalogTitle,
    subtitle: catalogSubtitle,
    validUntil,
    shopName: SHOP_NAME,
    shopPhone: SHOP_PHONES,
    shopAddress: SHOP_ADDRESS,
    items: offerItemsList,
    note: catalogNote,
    columns: columnsCount,
    theme: catalogTheme
  });

  // Download PDF
  const handleDownloadPdf = async () => {
    if (offerItemsList.length === 0) {
      toast('⚠️ يرجى اختيار صنف واحد على الأقل للمجلة');
      return;
    }
    try {
      setIsExportingPdf(true);
      toast('⏳ جاري إنشاء ملف PDF عالي الجودة لمجلة المعرض...');

      const bodyHtml = generateExhibitionCatalogHtml(getCatalogOptions());

      await exportElementToPdf({
        html: bodyHtml,
        filename: `مجلة_عروض_المعرض_${todayStr()}.pdf`,
        isThermal: false
      });

      toast('✅ تم تنزيل ملف PDF مجلة المعرض بنجاح');
    } catch (err: any) {
      console.error('Catalog PDF Export Error:', err);
      toast('❌ حدث خطأ أثناء إنشاء ملف PDF');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Share PDF
  const handleSharePdf = async () => {
    if (offerItemsList.length === 0) {
      toast('⚠️ يرجى اختيار أصناف للمجلة');
      return;
    }
    try {
      setIsSharingPdf(true);
      toast('⏳ جاري تجهيز ملف مجلة المعرض للإرسال...');

      const bodyHtml = generateExhibitionCatalogHtml(getCatalogOptions());

      const res = await sharePdfFile({
        html: bodyHtml,
        filename: `مجلة_عروض_المعرض_${todayStr()}.pdf`,
        title: catalogTitle,
        isThermal: false
      });

      if (res.action === 'shared_mobile') {
        toast('✅ تم فتح نافذة مشاركة المجلة بنجاح');
      } else if (res.action === 'downloaded_and_whatsapp') {
        toast('✅ تم تنزيل مجلة العروض وفتح محادثة الواتساب. يمكنك الآن إرفاق 📎 ملف المجلة للعميل');
      } else {
        toast('✅ تم تنزيل المجلة على جهازك');
      }
    } catch (err: any) {
      console.error('Catalog PDF Share Error:', err);
      toast('⚠️ تعذر الإرسال المباشر، جاري التنزيل...');
      handleDownloadPdf();
    } finally {
      setIsSharingPdf(false);
    }
  };

  // Print Preview
  const handlePrintCatalog = () => {
    if (offerItemsList.length === 0) {
      toast('⚠️ يرجى اختيار أصناف للمجلة');
      return;
    }
    const bodyHtml = generateExhibitionCatalogHtml(getCatalogOptions());
    showPrintModal({
      title: catalogTitle,
      bodyHtml,
      filename: `مجلة_عروض_المعرض_${todayStr()}.pdf`,
      waMessage: generateWhatsAppCatalogMessage(getCatalogOptions())
    });
  };

  // Copy WhatsApp Text
  const handleCopyWhatsAppText = async () => {
    if (offerItemsList.length === 0) {
      toast('⚠️ يرجى اختيار أصناف أولاً');
      return;
    }
    const text = generateWhatsAppCatalogMessage(getCatalogOptions());
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast('📋 تم نسخ نص مجلة العروض للحافظة بنجاح');
      } else {
        toast('⚠️ الحافظة غير مدعومة');
      }
    } catch {
      toast('⚠️ تعذر النسخ');
    }
  };

  // Send WhatsApp Direct
  const handleSendWhatsApp = () => {
    if (offerItemsList.length === 0) {
      toast('⚠️ يرجى اختيار أصناف');
      return;
    }
    const text = encodeURIComponent(generateWhatsAppCatalogMessage(getCatalogOptions()));
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  // Push offer items into Sales POS Cart
  const handlePushToCart = () => {
    if (offerItemsList.length === 0) {
      toast('⚠️ لا توجد أصناف محددة');
      return;
    }
    const cartItems = offerItemsList.map(it => ({
      productId: it.productId,
      name: it.name,
      qty: 1,
      price: it.offerPrice,
      originalPrice: it.originalPrice,
      term: it.term || ''
    }));
    setSaleCartItems(cartItems);
    goTo('saleInvoice');
    toast(`🛒 تم نقل ${cartItems.length} صنف بأسعار العرض إلى سلة المبيعات`);
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Header */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#A9762F] to-[#D97706] text-white flex items-center justify-center flex-none shadow-md">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif font-black text-lg sm:text-xl text-[#1F2A3C]">
                مجلة المعرض والعروض والتخفيضات
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF6EE] text-[#A9762F] border border-[#D8CBB0]">
                {offerItemsList.length} صنف بالعرض
              </span>
            </div>
            <p className="text-xs text-[#8E98A6] mt-0.5">
              تحديد الأصناف الراكدة والفائضة في المخزون، ضبط أسعار التخفيضات ونسب الخصم، وتصدير مجلة دعائية احترافية PDF للطباعة والنشر.
            </p>
          </div>
        </div>

        {/* Tab & Action Switches */}
        <div className="flex items-center gap-2">
          <div className="flex bg-[#EFE7D6] p-1 rounded-xl border border-[#D8CBB0]">
            <button
              onClick={() => setActiveTab('builder')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'builder'
                  ? 'bg-[#1F2A3C] text-white shadow-xs'
                  : 'text-[#1F2A3C] hover:bg-[#FAF6EE]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              تجهيز واختيار الأصناف
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'preview'
                  ? 'bg-[#A9762F] text-white shadow-xs'
                  : 'text-[#1F2A3C] hover:bg-[#FAF6EE]'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              معاينة المجلة الحية ({offerItemsList.length})
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'builder' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Column: Inventory Selector & Stagnant Items (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#EFE7D6]">
                <h3 className="font-bold text-sm text-[#1F2A3C] flex items-center gap-2">
                  <Flame className="w-4 h-4 text-[#DC2626]" />
                  اختيار الأصناف من المخزون وتصفية الرواكد
                </h3>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setOnlyStagnant(!onlyStagnant)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                      onlyStagnant
                        ? 'bg-[#DC2626] text-white shadow-xs'
                        : 'bg-[#FAF6EE] text-[#DC2626] border border-red-200 hover:bg-red-50'
                    }`}
                    title="إظهار الأصناف الراكدة التي يتوفر منها كميات فائضة"
                  >
                    <TrendingDown className="w-3.5 h-3.5" />
                    المخزون الفائض والراكد فقط
                  </button>
                  <button
                    onClick={selectAllFiltered}
                    className="px-2.5 py-1 rounded-lg bg-[#5C7A5E] hover:bg-[#4c684e] text-white font-bold cursor-pointer"
                  >
                    تحديد الكل ({filteredProducts.length})
                  </button>
                  {offerItemsList.length > 0 && (
                    <button
                      onClick={clearSelections}
                      className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] hover:bg-[#EFE7D6] text-[#A8503A] border border-[#D8CBB0] font-bold cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  )}
                </div>
              </div>

              {/* Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-[#8E98A6]" />
                  <input
                    type="text"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="بحث باسم الصنف أو الباركود..."
                    className="w-full pl-3 pr-8 py-1.5 text-xs bg-[#FAF6EE] border border-[#D8CBB0] rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="px-2 py-1.5 text-xs bg-[#FAF6EE] border border-[#D8CBB0] rounded-xl focus:bg-white focus:outline-hidden"
                >
                  <option value="">جميع الأقسام</option>
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={selectedGrade}
                  onChange={e => setSelectedGrade(e.target.value)}
                  className="px-2 py-1.5 text-xs bg-[#FAF6EE] border border-[#D8CBB0] rounded-xl focus:bg-white focus:outline-hidden"
                >
                  <option value="">جميع المراحل والصفوف</option>
                  {GRADES.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Products List */}
              <div className="max-h-[500px] overflow-y-auto divide-y divide-[#EFE7D6] border border-[#D8CBB0] rounded-xl bg-white">
                {filteredProducts.length === 0 ? (
                  <div className="p-8 text-center text-[#8E98A6] text-xs">
                    لا توجد أصناف مطابقة لخيارات البحث الحالية بالمخزون.
                  </div>
                ) : (
                  filteredProducts.map(p => {
                    const isSelected = !!selectedOffers[p.id];
                    const isStagnantItem = (p.qty || 0) >= 5;
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleProductSelection(p)}
                        className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#FAF6EE] border-r-4 border-[#A9762F]'
                            : 'hover:bg-[#FAF6EE]/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                            isSelected
                              ? 'bg-[#A9762F] border-[#A9762F] text-white'
                              : 'border-[#D8CBB0] bg-white text-transparent'
                          }`}>
                            <CheckSquare className="w-3.5 h-3.5" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <b className="text-xs text-[#1F2A3C] truncate">{p.name}</b>
                              {isStagnantItem && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-red-100 text-red-700 font-bold">
                                  فائض ({p.qty})
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-[#8E98A6] flex items-center gap-1 mt-0.5 truncate">
                              <span>{p.category}</span>
                              {p.grade && <span>• {p.grade}</span>}
                              {p.term && <span>• {p.term}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="text-left flex-none">
                          <span className="text-xs font-mono font-bold text-[#1F2A3C] block">
                            {fmt(p.sellPrice)} ج
                          </span>
                          <span className="text-[10px] text-[#8E98A6]">
                            متاح: <b className="text-[#5C7A5E] font-mono">{p.qty || 0}</b>
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Offers Customizer & Settings (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Batch Offer Tools */}
            <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#EFE7D6]">
                <h3 className="font-bold text-sm text-[#1F2A3C] flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#5C7A5E]" />
                  تطبيق خصم جماعي سريع على العروض
                </h3>
                <span className="text-xs font-bold text-[#A9762F]">
                  {offerItemsList.length} صنف محدد
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[10, 15, 20, 25, 30, 40, 50].map(pct => (
                  <button
                    key={pct}
                    onClick={() => applyGlobalDiscount(pct)}
                    className="flex-1 min-w-[50px] py-1.5 rounded-lg bg-[#FAF6EE] hover:bg-[#A9762F] hover:text-white text-[#1F2A3C] border border-[#D8CBB0] font-bold text-xs transition-colors cursor-pointer"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Magazine Headers Form */}
              <div className="pt-2 border-t border-[#EFE7D6] space-y-2 text-xs">
                <div>
                  <label className="block font-bold text-[#3A4A63] mb-1">عنوان المجلة الرئيسي:</label>
                  <input
                    type="text"
                    value={catalogTitle}
                    onChange={e => setCatalogTitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#FAF6EE] border border-[#D8CBB0] rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#3A4A63] mb-1">الوصف / النص الترويجي:</label>
                  <input
                    type="text"
                    value={catalogSubtitle}
                    onChange={e => setCatalogSubtitle(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#FAF6EE] border border-[#D8CBB0] rounded-xl focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-[#3A4A63] mb-1">فترة وسريان العرض:</label>
                    <input
                      type="text"
                      value={validUntil}
                      onChange={e => setValidUntil(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[#FAF6EE] border border-[#D8CBB0] rounded-xl focus:bg-white focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#3A4A63] mb-1">شكل وثيم التصميم:</label>
                    <select
                      value={catalogTheme}
                      onChange={e => setCatalogTheme(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-[#FAF6EE] border border-[#D8CBB0] rounded-xl focus:bg-white focus:outline-hidden font-bold"
                    >
                      <option value="gold">الذهبي الفاخر (Gold)</option>
                      <option value="emerald">الزمردي المدرسي (Emerald)</option>
                      <option value="navy">الأزرق الملكي (Navy)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected Items Detail Editor */}
            <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#EFE7D6]">
                <h3 className="font-bold text-sm text-[#1F2A3C]">
                  قائمة العروض وضبط الأسعار الفردية ({offerItemsList.length})
                </h3>
              </div>

              {offerItemsList.length === 0 ? (
                <div className="p-6 text-center text-[#8E98A6] text-xs">
                  اختر أصنافاً من القائمة على اليمين للبدء في تجهيز مجلة العروض.
                </div>
              ) : (
                <div className="max-h-[360px] overflow-y-auto space-y-2.5 pr-1">
                  {offerItemsList.map(it => (
                    <div
                      key={it.productId}
                      className="p-3 rounded-xl bg-white border border-[#D8CBB0] space-y-2 shadow-2xs text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <b className="text-[#1F2A3C] block truncate">{it.name}</b>
                          <span className="text-[10px] text-[#8E98A6]">
                            السعر الأصلي: <s className="text-red-400 font-mono">{fmt(it.originalPrice)} ج</s>
                          </span>
                        </div>
                        <button
                          onClick={() => toggleProductSelection({ id: it.productId })}
                          className="text-[#A8503A] hover:text-red-700 p-1 cursor-pointer"
                          title="حذف من المجلة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 items-center">
                        <div>
                          <label className="block text-[10px] text-[#8E98A6] mb-0.5">سعر العرض (ج):</label>
                          <input
                            type="number"
                            value={it.offerPrice}
                            onChange={e => updateOfferPrice(it.productId, Number(e.target.value))}
                            className="w-full px-2 py-1 bg-[#FAF6EE] border border-[#D8CBB0] rounded-lg font-mono font-bold text-[#5C7A5E] focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-[#8E98A6] mb-0.5">نسبة الخصم %:</label>
                          <input
                            type="number"
                            value={it.discountPercent}
                            onChange={e => updateOfferDiscountPct(it.productId, Number(e.target.value))}
                            className="w-full px-2 py-1 bg-[#FAF6EE] border border-[#D8CBB0] rounded-lg font-mono font-bold text-[#A9762F] focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-[#8E98A6] mb-0.5">شارة العرض:</label>
                          <select
                            value={it.badge || ''}
                            onChange={e => updateOfferBadge(it.productId, e.target.value)}
                            className="w-full px-1.5 py-1 bg-[#FAF6EE] border border-[#D8CBB0] rounded-lg text-[10px] focus:outline-hidden"
                          >
                            {PROMO_BADGES.map(b => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Live Interactive Magazine Preview */
        <div className="space-y-4">
          {/* Quick Summary & Metrics Bar */}
          <div className="p-4 rounded-2xl bg-[#FAF6EE] border border-[#D8CBB0] shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-[#8E98A6]">إجمالي عدد الأصناف:</span>
                <b className="text-[#1F2A3C] font-mono text-sm mr-1.5">{offerItemsList.length} صنف</b>
              </div>
              <div>
                <span className="text-[#8E98A6]">متوسط الخصم:</span>
                <b className="text-[#A9762F] font-mono text-sm mr-1.5">{avgDiscount}%</b>
              </div>
              <div>
                <span className="text-[#8E98A6]">إجمالي وفر الزبائن في الباقة:</span>
                <b className="text-[#5C7A5E] font-mono text-sm mr-1.5">{fmt(totalSavings)} ج</b>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[#8E98A6]">تقسيم الأعمدة:</span>
              <button
                onClick={() => setColumnsCount(2)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  columnsCount === 2 ? 'bg-[#1F2A3C] text-white' : 'bg-white border border-[#D8CBB0] text-[#1F2A3C]'
                }`}
              >
                عمودين (A4 كبير)
              </button>
              <button
                onClick={() => setColumnsCount(3)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  columnsCount === 3 ? 'bg-[#1F2A3C] text-white' : 'bg-white border border-[#D8CBB0] text-[#1F2A3C]'
                }`}
              >
                3 أعمدة (كتالوج مضغوط)
              </button>
            </div>
          </div>

          {/* Interactive Live Magazine Canvas */}
          <div className="p-4 sm:p-6 bg-white border border-[#D8CBB0] rounded-2xl shadow-md max-w-4xl mx-auto space-y-4">
            {/* Header Banner */}
            <div className="p-4 sm:p-5 rounded-xl text-white bg-gradient-to-tr from-[#8A5D20] to-[#A9762F] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <span className="px-3 py-0.5 rounded-full text-[11px] font-black bg-white text-[#8A5D20] inline-block mb-1.5 shadow-xs">
                  🔥 عروض وتخفيضات معرض الكتب والأدوات المدرسية
                </span>
                <h3 className="font-serif font-black text-lg sm:text-xl">{catalogTitle}</h3>
                <p className="text-xs text-white/90 font-medium">{catalogSubtitle}</p>
                <div className="text-[11px] text-white/80 mt-2 flex items-center gap-3">
                  <span>⏳ <b>فترة العرض:</b> {validUntil}</span>
                  <span>📦 <b>الأصناف:</b> {offerItemsList.length}</span>
                </div>
              </div>

              <div className="text-left bg-white/15 backdrop-blur-xs p-2.5 rounded-xl border border-white/20 text-xs space-y-0.5 flex-none">
                <b className="text-sm block">{SHOP_NAME}</b>
                <div>📞 {SHOP_PHONES}</div>
                <div className="text-[10px] text-white/80">📍 {SHOP_ADDRESS}</div>
              </div>
            </div>

            {/* Offers Grid */}
            <div className={`grid ${columnsCount === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'} gap-3`}>
              {offerItemsList.map((it, idx) => (
                <div
                  key={it.productId}
                  className="p-3 rounded-xl bg-[#FAF6EE] border border-[#D8CBB0] relative flex flex-col justify-between space-y-2.5 hover:shadow-sm transition-shadow"
                >
                  {it.badge && (
                    <span className="absolute -top-2.5 left-2.5 px-2 py-0.5 rounded-md text-[10px] font-black bg-[#DC2626] text-white shadow-xs">
                      {it.badge}
                    </span>
                  )}

                  <div>
                    <b className="text-xs text-[#1F2A3C] block leading-tight mt-1">
                      {idx + 1}. {it.name}
                    </b>
                    <div className="text-[10px] text-[#8E98A6] flex items-center gap-1 mt-1">
                      <span>{it.category}</span>
                      {it.grade && <span>• {it.grade}</span>}
                    </div>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-[#D8CBB0] flex items-center justify-between">
                    <div>
                      {it.originalPrice > it.offerPrice && (
                        <s className="text-[10px] text-red-400 font-mono block">
                          {fmt(it.originalPrice)} ج
                        </s>
                      )}
                      <span className="text-base font-black font-mono text-[#5C7A5E]">
                        {fmt(it.offerPrice)} <small className="text-[10px]">ج</small>
                      </span>
                    </div>

                    {it.originalPrice > it.offerPrice && (
                      <div className="text-left text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        وفر {fmt(it.originalPrice - it.offerPrice)} ج
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Magazine Footer */}
            <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0] text-xs text-[#3A4A63] flex flex-col sm:flex-row items-center justify-between gap-2">
              <div>
                <b>📌 ملاحظة وشروط:</b> {catalogNote}
              </div>
              <b className="text-[#A9762F]">
                للطلب والاستفسار: 📞 {SHOP_PHONES}
              </b>
            </div>
          </div>
        </div>
      )}

      {/* Global Bottom Actions Bar */}
      <div className="p-4 bg-[#FAF6EE] border border-[#D8CBB0] rounded-2xl shadow-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Direct High-Quality PDF Download */}
          <button
            onClick={handleDownloadPdf}
            disabled={isExportingPdf || offerItemsList.length === 0}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer ${
              isExportingPdf || offerItemsList.length === 0
                ? 'bg-[#8E98A6] text-white cursor-not-allowed'
                : 'bg-[#5C7A5E] hover:bg-[#4c684e] text-white'
            }`}
            title="تنزيل مجلة المعرض كملف PDF عالي الجودة والوضوح على جهازك"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري إنشاء PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                تنزيل مجلة المعرض PDF
              </>
            )}
          </button>

          {/* Share PDF directly */}
          <button
            onClick={handleSharePdf}
            disabled={isSharingPdf || offerItemsList.length === 0}
            className="px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            title="إرسال ملف مجلة المعرض كـ PDF مباشر للعملاء عبر الواتساب"
          >
            {isSharingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري التجهيز...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                إرسال المجلة PDF
              </>
            )}
          </button>

          {/* Print / Preview */}
          <button
            onClick={handlePrintCatalog}
            disabled={offerItemsList.length === 0}
            className="px-3.5 py-2.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            title="معاينة وطباعة ورقية لمقاس A4"
          >
            <Printer className="w-4 h-4" />
            معاينة وطباعة A4
          </button>

          {/* Copy WhatsApp Broadcast text */}
          <button
            onClick={handleCopyWhatsAppText}
            disabled={offerItemsList.length === 0}
            className="px-3 py-2.5 rounded-xl bg-white hover:bg-[#EFE7D6] text-[#1F2A3C] border border-[#D8CBB0] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="نسخ نص العروض التسويقي لنشره على الواتساب أو السوشيال ميديا"
          >
            <Copy className="w-3.5 h-3.5" />
            نسخ نص العروض
          </button>

          {/* Send text directly via WhatsApp */}
          <button
            onClick={handleSendWhatsApp}
            disabled={offerItemsList.length === 0}
            className="px-3 py-2.5 rounded-xl bg-[#EFE7D6] hover:bg-[#D8CBB0] text-[#25D366] font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="فتح واتساب وإرسال نص العروض"
          >
            <Share2 className="w-3.5 h-3.5" />
            نص واتساب
          </button>
        </div>

        {/* Push to Sale POS Cart */}
        <button
          onClick={handlePushToCart}
          disabled={offerItemsList.length === 0}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#1F2A3C] hover:bg-[#2c3d56] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
          title="تحميل كافة أصناف العروض بأسعار التخفيض في سلة البيع لتنفيذ فواتير المعرض"
        >
          <ShoppingCart className="w-4 h-4 text-[#5C7A5E]" />
          تحميل العروض في سلة المبيعات (POS)
        </button>
      </div>
    </div>
  );
};
