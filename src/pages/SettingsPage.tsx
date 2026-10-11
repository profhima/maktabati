import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { ShopSettings, BusinessCalendarConfig, BusinessCalendarVersionRecord } from '../types';
import {
  getShopSettings,
  updateLocalShopSettings,
  saveShopSettingsToCloud,
  DEFAULT_SHOP_SETTINGS
} from '../lib/settings';
import {
  fetchCurrentBusinessCalendar,
  fetchCalendarVersionHistory,
  saveBusinessCalendarMutation,
  UserActorContext
} from '../lib/businessCalendar';
import { getCairoDateStr } from '../lib/dateUtils';
import { SHOP_DEFAULT_LOGO, SHOP_NAME } from '../lib/constants';
import { generateThermalReceiptHtml, generateA4SaleInvoiceHtml } from '../lib/invoiceTemplates';
import { todayStr } from '../lib/utils';
import {
  Store,
  Upload,
  Trash2,
  Printer,
  FileText,
  Eye,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Smartphone,
  QrCode,
  ShieldCheck,
  Building2,
  Phone,
  MapPin,
  FileCheck2,
  Layers,
  HelpCircle,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Calendar as CalendarIcon,
  Plus,
  AlertTriangle,
  History,
  ShieldAlert
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { toast, showPrintModal, isAdmin, activeOperator, currentProfile, db } = useApp();
  const [settings, setSettings] = useState<ShopSettings>(() => getShopSettings());
  const [activeTab, setActiveTab] = useState<'branding' | 'thermal' | 'a4' | 'calendar'>('branding');
  const [previewMode, setPreviewMode] = useState<'thermal' | 'a4'>('thermal');
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Business Calendar State
  const [calendarConfig, setCalendarConfig] = useState<BusinessCalendarConfig | null>(null);
  const [calendarVersions, setCalendarVersions] = useState<BusinessCalendarVersionRecord[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [calWeeklyHolidays, setCalWeeklyHolidays] = useState<number[]>([5]); // Default Friday
  const [newOfficialHoliday, setNewOfficialHoliday] = useState('');
  const [newNonWorkingDate, setNewNonWorkingDate] = useState('');
  const [calEffectiveFrom, setCalEffectiveFrom] = useState(getCairoDateStr());
  const [calReason, setCalReason] = useState('');
  const [savingCalendar, setSavingCalendar] = useState(false);

  const actorRole = activeOperator?.role || currentProfile?.role || (isAdmin ? 'admin' : 'cashier');
  const userActor: UserActorContext = {
    uid: activeOperator?.uid || currentProfile?.uid || 'u_admin',
    name: activeOperator?.name || currentProfile?.name || 'المدير المسؤول',
    role: actorRole
  };

  // Sync state if settings change externally
  useEffect(() => {
    setSettings(getShopSettings());
    loadCalendarData();
  }, []);

  const loadCalendarData = async () => {
    setLoadingCalendar(true);
    try {
      const cur = await fetchCurrentBusinessCalendar();
      setCalendarConfig(cur);
      if (cur) {
        setCalWeeklyHolidays(cur.weeklyHolidays || []);
      }
      const history = await fetchCalendarVersionHistory();
      setCalendarVersions(history);
    } catch (err) {
      console.warn('Failed to load business calendar in settings:', err);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleToggleWeeklyHoliday = (dayIndex: number) => {
    if (userActor.role !== 'admin') {
      toast('⛔ عذراً: تعديل العطلات الأسبوعية مقتصر على المدير العام (Admin) فقط.');
      return;
    }
    setCalWeeklyHolidays(prev => {
      if (prev.includes(dayIndex)) {
        return prev.filter(d => d !== dayIndex);
      } else {
        return [...prev, dayIndex].sort();
      }
    });
  };

  const handleAddOfficialHoliday = () => {
    if (userActor.role !== 'admin') {
      toast('⛔ عذراً: إضافة العطلات الرسمية مقتصر على المدير العام (Admin) فقط.');
      return;
    }
    if (!newOfficialHoliday) {
      toast('اختر تاريخ العطلة الرسمية');
      return;
    }
    const currentList = calendarConfig?.officialHolidays || [];
    if (currentList.includes(newOfficialHoliday)) {
      toast('هذا التاريخ مسجل بالفعل في العطلات الرسمية');
      return;
    }
    if ((calendarConfig?.nonWorkingDates || []).includes(newOfficialHoliday)) {
      toast('هذا التاريخ مسجل بالفعل في أيام التوقف التشغيلي');
      return;
    }
    handleSaveCalendarChange({
      officialHolidays: [...currentList, newOfficialHoliday]
    });
    setNewOfficialHoliday('');
  };

  const handleRemoveOfficialHoliday = (dateToRemove: string) => {
    if (userActor.role !== 'admin') {
      toast('⛔ عذراً: حذف العطلات الرسمية مقتصر على المدير العام (Admin) فقط.');
      return;
    }
    const currentList = calendarConfig?.officialHolidays || [];
    handleSaveCalendarChange({
      officialHolidays: currentList.filter(d => d !== dateToRemove)
    });
  };

  const handleAddNonWorkingDate = () => {
    if (userActor.role !== 'admin' && userActor.role !== 'manager') {
      toast('⛔ عذراً: تسجيل أيام التوقف مقتصر على الإدارة (Admin / Manager).');
      return;
    }
    if (!newNonWorkingDate) {
      toast('اختر تاريخ التوقف التشغيلي');
      return;
    }
    if (userActor.role === 'manager' && !calReason.trim()) {
      toast('⚠️ إلزامي لمدير الفرع: يرجى كتابة سبب التوقف التشغيلي في خانة البيان.');
      return;
    }
    const currentList = calendarConfig?.nonWorkingDates || [];
    if (currentList.includes(newNonWorkingDate)) {
      toast('هذا التاريخ مسجل بالفعل في أيام التوقف التشغيلي');
      return;
    }
    if ((calendarConfig?.officialHolidays || []).includes(newNonWorkingDate)) {
      toast('هذا التاريخ مسجل بالفعل في العطلات الرسمية');
      return;
    }
    handleSaveCalendarChange({
      nonWorkingDates: [...currentList, newNonWorkingDate]
    });
    setNewNonWorkingDate('');
  };

  const handleRemoveNonWorkingDate = (dateToRemove: string) => {
    if (userActor.role !== 'admin' && userActor.role !== 'manager') {
      toast('⛔ عذراً: حذف أيام التوقف مقتصر على الإدارة.');
      return;
    }
    if (userActor.role === 'manager' && !calReason.trim()) {
      toast('⚠️ إلزامي لمدير الفرع: يرجى كتابة سبب الحذف في خانة البيان.');
      return;
    }
    const currentList = calendarConfig?.nonWorkingDates || [];
    handleSaveCalendarChange({
      nonWorkingDates: currentList.filter(d => d !== dateToRemove)
    });
  };

  const handleSaveCalendarChange = async (partialInput: Partial<{
    weeklyHolidays: number[];
    officialHolidays: string[];
    nonWorkingDates: string[];
  }>) => {
    setSavingCalendar(true);
    try {
      const closedDatesSet = new Set((db.dailyClosings || []).map(c => c.date || c.id));
      const res = await saveBusinessCalendarMutation(
        userActor,
        {
          weeklyHolidays: partialInput.weeklyHolidays !== undefined ? partialInput.weeklyHolidays : calWeeklyHolidays,
          officialHolidays: partialInput.officialHolidays !== undefined ? partialInput.officialHolidays : (calendarConfig?.officialHolidays || []),
          nonWorkingDates: partialInput.nonWorkingDates !== undefined ? partialInput.nonWorkingDates : (calendarConfig?.nonWorkingDates || []),
          effectiveFrom: calEffectiveFrom,
          changeReason: calReason.trim()
        },
        closedDatesSet
      );
      setCalendarConfig(res);
      const history = await fetchCalendarVersionHistory();
      setCalendarVersions(history);
      toast(`✅ تم تحديث روزنامة العمل بنجاح (الإصدار ${res.version}) وحفظ نسخته المحصنة.`);
      setCalReason('');
    } catch (err: any) {
      toast(`خطأ: ${err.message}`);
    } finally {
      setSavingCalendar(false);
    }
  };

  const handleChange = <K extends keyof ShopSettings>(key: K, value: ShopSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
    // Instant local update so preview can reflect instantly
    updateLocalShopSettings({ [key]: value });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('يرجى اختيار ملف صورة صالح (PNG, JPG, WEBP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast('حجم الصورة كبير، يفضل اختيار صورة أقل من 2 ميجابايت');
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      handleChange('logoUrl', result);
      toast('✓ تم تحميل شعار المكتبة بنجاح');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    if (window.confirm('هل أنت متأكد من حذف شعار المكتبة؟')) {
      handleChange('logoUrl', '');
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast('تم حذف الشعار');
    }
  };

  const handleSetDefaultLogo = () => {
    handleChange('logoUrl', SHOP_DEFAULT_LOGO);
    toast('✓ تم تعيين الشعار الرسمي المعتمد للمكتبة');
  };

  const handleDownloadLogo = () => {
    const activeUrl = settings.logoUrl || SHOP_DEFAULT_LOGO;
    const link = document.createElement('a');
    link.href = activeUrl;
    link.download = `شعار_${settings.shopName || SHOP_NAME}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('✓ جاري تنزيل ملف الشعار بجودة عالية إلى جهازك');
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await saveShopSettingsToCloud(settings);
      setIsDirty(false);
      toast('✓ تم حفظ إعدادات الهوية وقوالب الفواتير بنجاح وتطبيقها في كل النظام');
    } catch (_err) {
      toast('تم حفظ الإعدادات محلياً');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('هل تريد استعادة الإعدادات والنصوص الافتراضية للفواتير؟')) {
      setSettings(DEFAULT_SHOP_SETTINGS);
      updateLocalShopSettings(DEFAULT_SHOP_SETTINGS);
      setIsDirty(true);
      toast('تمت استعادة الإعدادات الافتراضية');
    }
  };

  // Sample Mock Invoice for Live Preview
  const sampleInvoice = {
    number: 1042,
    date: todayStr(),
    createdAt: new Date().toISOString(),
    customerName: 'أحمد محمود الكردي',
    customerPhone: '01098765432',
    customerAddress: 'عمارة 14 - الحي الثاني',
    items: [
      { productId: '1', name: 'كشكول سلك 100 ورقة ديزني', qty: 2, price: 35, originalPrice: 40 },
      { productId: '2', name: 'قلم جاف يوني بول أزرق 0.7mm', qty: 3, price: 15, originalPrice: 15 },
      { productId: '3', name: 'كتاب المعاصر في الرياضيات 2 إعدادي', qty: 1, price: 130, originalPrice: 140 }
    ],
    originalSubtotal: 250,
    subtotal: 235,
    discount: 10,
    total: 225,
    paidAmount: 250,
    changeAmount: 25,
    dueAmount: 0,
    paymentMethod: 'cash',
    earnedPoints: 12,
    previousBalance: 0,
    newBalance: 0
  };

  const currentPreviewHtml = previewMode === 'thermal'
    ? generateThermalReceiptHtml({ invoice: sampleInvoice, cashierName: 'أحمد (الكاشير)' })
    : generateA4SaleInvoiceHtml({ invoice: sampleInvoice, cashierName: 'أحمد (المسؤول)' });

  const handleTestPrint = () => {
    showPrintModal({
      title: previewMode === 'thermal' ? 'طباعة تجريبية - إيصال حراري' : 'طباعة تجريبية - فاتورة A4',
      bodyHtml: currentPreviewHtml
    });
  };

  return (
    <div className="p-3 sm:p-6 space-y-6 max-w-7xl mx-auto text-slate-900 pb-20">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center text-2xl flex-none border border-amber-500/20">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
              <span>هوية المكتبة وتخصيص الفواتير</span>
              <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                الشعار والطباعة
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              تخصيص اسم وشعار المكتبة، أرقام التواصل، وقوالب الإيصالات الحرارية وفواتير A4 مع معاينة حية فورية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 border border-slate-200"
            title="استعادة القيم الافتراضية"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>استعادة الافتراضي</span>
          </button>

          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs ${
              isDirty
                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isSaving ? 'جارٍ الحفظ...' : isDirty ? 'حفظ التعديلات الآن' : 'تم الحفظ (تحديث)'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Settings on Right/Top, Live Preview on Left/Bottom */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Navigation Tabs */}
          <div className="bg-slate-100/90 p-1.5 rounded-2xl flex items-center gap-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('branding')}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'branding'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-4 h-4 text-amber-600" />
              <span>بيانات وشعار المكتبة</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('thermal');
                setPreviewMode('thermal');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'thermal'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-4 h-4 text-sky-600" />
              <span>الإيصال الحراري (POS)</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('a4');
                setPreviewMode('a4');
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'a4'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>فاتورة A4 الفاخرة</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('calendar');
                loadCalendarData();
              }}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-4 h-4 text-emerald-600" />
              <span>روزنامة العمل</span>
            </button>
          </div>

          {/* Tab 1: Branding & Logo */}
          {activeTab === 'branding' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Store className="w-4 h-4 text-amber-600" />
                <span>الهوية الرسمية وشعار المكتبة</span>
              </h2>

              {/* Logo Upload & Download Card */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  {/* Logo Preview Frame */}
                  <div className="relative group shrink-0">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-2xl p-2 border-2 border-amber-500/40 shadow-md flex items-center justify-center overflow-hidden">
                      <img
                        src={settings.logoUrl || SHOP_DEFAULT_LOGO}
                        alt="شعار المكتبة"
                        className="w-full h-full object-contain rounded-xl"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                      شعار معتمد
                    </span>
                  </div>

                  {/* Actions & Description */}
                  <div className="space-y-3 flex-1 text-center sm:text-right">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center justify-center sm:justify-start gap-2">
                        <span>شعار وهوية {settings.shopName || SHOP_NAME}</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        يتم طباعة هذا الشعار بدقة عالية على ترويسة فواتير A4، إيصالات الكاشير الحرارية، وشاشات نقاط البيع.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      {/* Download High Quality Logo Button */}
                      <button
                        type="button"
                        onClick={handleDownloadLogo}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                        title="تنزيل ملف الصورة بجودة أصلية لجهازك"
                      >
                        <Download className="w-4 h-4" />
                        <span>تحميل الشعار لجهازك (HD)</span>
                      </button>

                      {/* Upload Custom Logo Button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5 text-amber-600" />
                        <span>رفع شعار مخصص</span>
                      </button>

                      {/* Reset to Default Official Logo */}
                      <button
                        type="button"
                        onClick={handleSetDefaultLogo}
                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-xl border border-amber-200 transition-colors cursor-pointer flex items-center gap-1.5"
                        title="استعادة الشعار الرسمي المصمم"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>الشعار الرسمي</span>
                      </button>

                      {settings.logoUrl && (
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                          title="إخفاء الشعار"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-amber-600" />
                    <span>اسم المكتبة / المتجر *</span>
                  </label>
                  <input
                    type="text"
                    value={settings.shopName}
                    onChange={e => handleChange('shopName', e.target.value)}
                    placeholder="مثال: مكتبة فكرة"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>الشعار اللفظي / النشاط (Slogan)</span>
                  </label>
                  <input
                    type="text"
                    value={settings.slogan || ''}
                    onChange={e => handleChange('slogan', e.target.value)}
                    placeholder="مثال: للأدوات المكتبية والمدرسية والخدمات الطلابية والتصوير"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>العنوان بالتفصيل</span>
                  </label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={e => handleChange('address', e.target.value)}
                    placeholder="مثال: نادي الياسمين واحد — مدينة المستقبل"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-600" />
                    <span>أرقام الهاتف والواتساب</span>
                  </label>
                  <input
                    type="text"
                    value={settings.phones}
                    onChange={e => handleChange('phones', e.target.value)}
                    placeholder="مثال: تليفون وواتس: 01001515297 / 01002226173"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <FileCheck2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>الرقم الضريبي (اختياري)</span>
                  </label>
                  <input
                    type="text"
                    value={settings.taxNumber || ''}
                    onChange={e => handleChange('taxNumber', e.target.value)}
                    placeholder="مثال: 123-456-789"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>رقم السجل التجاري (اختياري)</span>
                  </label>
                  <input
                    type="text"
                    value={settings.commercialReg || ''}
                    onChange={e => handleChange('commercialReg', e.target.value)}
                    placeholder="مثال: 987654"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Thermal POS Receipt Customization */}
          {activeTab === 'thermal' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <Printer className="w-4 h-4 text-sky-600" />
                <span>إعدادات وتخصيص إيصال طابعة الكاشير الحرارية</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Paper Width Selector */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    مقاس ورق الطابعة الحرارية
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleChange('thermalPaperWidth', '80mm')}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        settings.thermalPaperWidth === '80mm'
                          ? 'border-sky-500 bg-sky-50/50 text-sky-900 ring-2 ring-sky-500/20 font-bold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-black">80 ملم (80mm)</span>
                        <span className="text-xs bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-bold">القياسي الشائع</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        مناسب لطابعات إبسون، Xprinter، وسائر طابعات الفواتير العريضة 80mm
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChange('thermalPaperWidth', '58mm')}
                      className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                        settings.thermalPaperWidth === '58mm'
                          ? 'border-sky-500 bg-sky-50/50 text-sky-900 ring-2 ring-sky-500/20 font-bold'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-black">58 ملم (58mm)</span>
                        <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">مدمج صغير</span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        مناسب لطابعات البلوتوث المحمولة وأجهزة نقاط البيع الصغيرة 58mm
                      </p>
                    </button>
                  </div>
                </div>

                {/* Font Size Selector */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    حجم الخط في الإيصال الحراري
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'small', label: 'صغير (مكثف)' },
                      { id: 'normal', label: 'عادي (متوازن)' },
                      { id: 'large', label: 'كبير (واضح جداً)' }
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleChange('thermalFontSize', f.id as any)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          settings.thermalFontSize === f.id
                            ? 'border-sky-500 bg-sky-50 text-sky-900 font-black'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Toggles */}
                <div className="sm:col-span-2 space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-bold text-slate-800">
                      طباعة شعار المكتبة أعلى الإيصال الحراري
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showLogoOnThermal}
                      onChange={e => handleChange('showLogoOnThermal', e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer border-t border-slate-200/60 pt-2.5">
                    <span className="text-xs font-bold text-slate-800">
                      طباعة رمز الباركود التعريفي للفاتورة بالأسفل
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showBarcodeOnThermal}
                      onChange={e => handleChange('showBarcodeOnThermal', e.target.checked)}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Custom Notes & Terms */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    جملة ترحيبية أعلى الإيصال (اختياري)
                  </label>
                  <input
                    type="text"
                    value={settings.thermalHeaderNote || ''}
                    onChange={e => handleChange('thermalHeaderNote', e.target.value)}
                    placeholder="مثال: أهلاً وسهلاً بكم في مكتبتنا"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    جملة الشكر وختام الإيصال
                  </label>
                  <input
                    type="text"
                    value={settings.thermalFooterNote || ''}
                    onChange={e => handleChange('thermalFooterNote', e.target.value)}
                    placeholder="مثال: نسعد دائماً بزيارتكم وخدمتكم!"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    شروط الاستبدال والاسترجاع المطبوعة
                  </label>
                  <textarea
                    rows={2}
                    value={settings.returnPolicyTerms || ''}
                    onChange={e => handleChange('returnPolicyTerms', e.target.value)}
                    placeholder="شروط استبدال البضاعة والكتب..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: A4 Luxury Invoice Customization */}
          {activeTab === 'a4' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-5">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>إعدادات وتخصيص فاتورة A4 / A5 الرسمية الفاخرة</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2.5 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs font-bold text-slate-800">
                      إظهار الشعار الرسمي في ترويسة فاتورة A4
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showLogoOnA4}
                      onChange={e => handleChange('showLogoOnA4', e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer border-t border-slate-200/60 pt-2.5">
                    <span className="text-xs font-bold text-slate-800">
                      إظهار بيانات الحساب البنكي / المحافظ الإلكترونية في التذييل
                    </span>
                    <input
                      type="checkbox"
                      checked={settings.showBankDetailsOnA4}
                      onChange={e => handleChange('showBankDetailsOnA4', e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    عنوان المستند في الفاتورة الرسمية
                  </label>
                  <input
                    type="text"
                    value={settings.a4HeaderNote || ''}
                    onChange={e => handleChange('a4HeaderNote', e.target.value)}
                    placeholder="مثال: فاتورة مبيعات ضريبية رسمية"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                {settings.showBankDetailsOnA4 && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      بيانات التحويل البنكي / إنستاباي / فودافون كاش
                    </label>
                    <input
                      type="text"
                      value={settings.bankDetails || ''}
                      onChange={e => handleChange('bankDetails', e.target.value)}
                      placeholder="مثال: بنك مصر: 12345678 | إنستاباي / فودافون كاش: 01001515297"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    الشروط وسياسة الضمان في فاتورة A4 (سطر لكل شرط)
                  </label>
                  <textarea
                    rows={3}
                    value={settings.a4FooterTerms || ''}
                    onChange={e => handleChange('a4FooterTerms', e.target.value)}
                    placeholder="• البضاعة المباعة تستبدل خلال 14 يوماً..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Business Calendar */}
          {activeTab === 'calendar' && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-emerald-600" />
                    <span>روزنامة العمل التشغيلية والعطلات (Business Calendar)</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    تحديد أيام العطلات الأسبوعية، الإجازات الرسمية، والتوقفات التشغيلية. تؤثر على توجيه وترحيل الحركات النقدية المتأخرة.
                  </p>
                </div>
                {calendarConfig && (
                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold font-mono">
                    الإصدار الحالي: v{calendarConfig.version}
                  </span>
                )}
              </div>

              {/* Weekly Holidays Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>العطلات الأسبوعية الثابتة للمتجر</span>
                    {userActor.role !== 'admin' && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        (مقتصر على المدير العام Admin)
                      </span>
                    )}
                  </label>
                  {userActor.role === 'admin' && (
                    <button
                      type="button"
                      disabled={savingCalendar}
                      onClick={() => handleSaveCalendarChange({ weeklyHolidays: calWeeklyHolidays })}
                      className="text-xs text-emerald-700 hover:underline font-bold"
                    >
                      تثبيت أيام الأسبوع
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {[
                    { id: 0, label: 'الأحد' },
                    { id: 1, label: 'الإثنين' },
                    { id: 2, label: 'الثلاثاء' },
                    { id: 3, label: 'الأربعاء' },
                    { id: 4, label: 'الخميس' },
                    { id: 5, label: 'الجمعة' },
                    { id: 6, label: 'السبت' }
                  ].map(day => {
                    const isSelected = calWeeklyHolidays.includes(day.id);
                    return (
                      <button
                        key={day.id}
                        type="button"
                        disabled={userActor.role !== 'admin' || savingCalendar}
                        onClick={() => handleToggleWeeklyHoliday(day.id)}
                        className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                          isSelected
                            ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs font-black'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        } ${userActor.role !== 'admin' ? 'opacity-80 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        {day.label}
                        <span className="block text-[10px] mt-0.5 font-normal">
                          {isSelected ? 'عطلة أسبوعية' : 'يوم عمل'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Effective From Date & Manager Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تاريخ سريان التعديل (Effective From) *
                  </label>
                  <input
                    type="date"
                    value={calEffectiveFrom}
                    onChange={e => setCalEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">بتوقيت القاهرة الرسمي (Africa/Cairo)</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    سبب التعديل / البيان {userActor.role === 'manager' && '<إلزامي لمدير الفرع>'}
                  </label>
                  <input
                    type="text"
                    value={calReason}
                    onChange={e => setCalReason(e.target.value)}
                    placeholder="مثال: إضافة إجازة 6 أكتوبر / صيانة طارئة للفرع..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Official Holidays Management */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>العطلات الرسمية والمناسبات القومية (Official Holidays)</span>
                  </h3>
                  {userActor.role !== 'admin' && (
                    <span className="text-[10px] text-slate-400">(صلاحية Admin فقط)</span>
                  )}
                </div>

                {userActor.role === 'admin' && (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newOfficialHoliday}
                      onChange={e => setNewOfficialHoliday(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                    <button
                      type="button"
                      disabled={savingCalendar}
                      onClick={handleAddOfficialHoliday}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة عطلة رسمية</span>
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {(calendarConfig?.officialHolidays || []).length === 0 ? (
                    <span className="text-xs text-slate-400 italic">لا توجد عطلات رسمية مسجلة حالياً.</span>
                  ) : (
                    calendarConfig?.officialHolidays.map(h => (
                      <span
                        key={h}
                        className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5"
                      >
                        {h}
                        {userActor.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOfficialHoliday(h)}
                            className="text-rose-400 hover:text-rose-700 font-bold cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Non-Working Dates (Operational Exceptions) */}
              <div className="space-y-3 p-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>أيام التوقف التشغيلي الاستثنائي (Non-Working Dates)</span>
                  </h3>
                  <span className="text-[10px] text-slate-400">(متاح للمدير Admin / Manager)</span>
                </div>

                {(userActor.role === 'admin' || userActor.role === 'manager') && (
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newNonWorkingDate}
                      onChange={e => setNewNonWorkingDate(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                    />
                    <button
                      type="button"
                      disabled={savingCalendar}
                      onClick={handleAddNonWorkingDate}
                      className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>تسجيل يوم توقف</span>
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {(calendarConfig?.nonWorkingDates || []).length === 0 ? (
                    <span className="text-xs text-slate-400 italic">لا توجد أيام توقف تشغيلي مسجلة.</span>
                  ) : (
                    calendarConfig?.nonWorkingDates.map(nw => (
                      <span
                        key={nw}
                        className="px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5"
                      >
                        {nw}
                        {(userActor.role === 'admin' || userActor.role === 'manager') && (
                          <button
                            type="button"
                            onClick={() => handleRemoveNonWorkingDate(nw)}
                            className="text-amber-500 hover:text-amber-800 font-bold cursor-pointer"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Version History Table */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-slate-600" />
                  <span>سجل الإصدارات المحصن للروزنامة ({calendarVersions.length} إصدار محفوظ)</span>
                </h3>
                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-56">
                  <table className="w-full text-[11px] text-right">
                    <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0">
                      <tr>
                        <th className="p-2">الإصدار</th>
                        <th className="p-2">تاريخ السريان</th>
                        <th className="p-2">العطلات الأسبوعية</th>
                        <th className="p-2">العطلات الرسمية</th>
                        <th className="p-2">أيام التوقف</th>
                        <th className="p-2">المسؤول</th>
                        <th className="p-2">البيان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {calendarVersions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-slate-400 font-sans">
                            لا يوجد سجل إصدارات بعد. قم بحفظ أول إعداد للروزنامة.
                          </td>
                        </tr>
                      ) : (
                        calendarVersions.map(ver => (
                          <tr key={ver.version} className="hover:bg-slate-50/50">
                            <td className="p-2 font-bold text-emerald-700">v{ver.version}</td>
                            <td className="p-2">{ver.effectiveFrom}</td>
                            <td className="p-2 font-sans">
                              {ver.weeklyHolidays.map(d => ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'][d]).join(', ') || 'لا يوجد'}
                            </td>
                            <td className="p-2">{ver.officialHolidays.length} يوم</td>
                            <td className="p-2">{ver.nonWorkingDates.length} يوم</td>
                            <td className="p-2 font-sans">{ver.createdByName || 'Admin'}</td>
                            <td className="p-2 font-sans truncate max-w-xs">{ver.changeReason || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Interactive Split Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-3 sticky top-20">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-sm text-slate-900">المعاينة الحية الفورية</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPreviewMode('thermal')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewMode === 'thermal'
                      ? 'bg-sky-100 text-sky-800 border border-sky-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  حراري ({settings.thermalPaperWidth})
                </button>
                <button
                  onClick={() => setPreviewMode('a4')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    previewMode === 'a4'
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  A4 فاخرة
                </button>
              </div>
            </div>

            {/* Test Print Button */}
            <button
              onClick={handleTestPrint}
              className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-amber-400" />
              <span>تجربة طباعة عينة حقيقية ({previewMode === 'thermal' ? `طابعة حرارية ${settings.thermalPaperWidth}` : 'فاتورة A4'})</span>
            </button>

            {/* Iframe Viewport Container */}
            <div className="bg-slate-100 rounded-xl p-2.5 border border-slate-200 flex items-center justify-center overflow-hidden min-h-[480px]">
              <div
                className={`bg-white shadow-md transition-all duration-300 overflow-hidden ${
                  previewMode === 'thermal'
                    ? settings.thermalPaperWidth === '58mm'
                      ? 'w-[240px] rounded-lg'
                      : 'w-[310px] rounded-lg'
                    : 'w-full rounded-lg'
                }`}
              >
                <iframe
                  title="المعاينة الحية"
                  srcDoc={currentPreviewHtml}
                  className="w-full h-[500px] border-0 select-none pointer-events-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
