import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import { fmt, uid, productFullName } from '../lib/utils';
import { CATEGORIES } from '../lib/constants';
import { generateBarcodeLabelHtml } from '../lib/barcodeLabelPrinter';
import {
  Package,
  Plus,
  Trash2,
  Sparkles,
  ShoppingBag,
  Printer,
  CheckCircle2,
  Layers,
  Search,
  Tag,
  ArrowRight,
  TrendingDown,
  Info
} from 'lucide-react';
import { Product, BundleComponentItem } from '../types';
import { getBundleAvailableQty, getBundleCalculatedCost } from '../lib/bundles';

export const BundlesPage: React.FC = () => {
  const { db, showPrintModal, setSaleCartItems, goTo, toast, addSaleItemByProduct } = useApp();

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // Search & Filter
  const [searchQ, setSearchQ] = useState('');

  // Form State for creating a new Bundle
  const [bundleName, setBundleName] = useState('');
  const [bundleBarcode, setBundleBarcode] = useState('');
  const [bundleCategory, setBundleCategory] = useState('أدوات مكتبية');
  const [customPrice, setCustomPrice] = useState<number | ''>('');
  const [bundleComponents, setBundleComponents] = useState<BundleComponentItem[]>([]);
  const [searchProductQ, setSearchProductQ] = useState('');
  const [saving, setSaving] = useState(false);

  // Available regular products (non-bundles)
  const regularProducts = useMemo(() => {
    return (db.products || []).filter(p => !p.isBundle);
  }, [db.products]);

  // Existing bundle products
  const existingBundles = useMemo(() => {
    return (db.products || []).filter(p => {
      if (!p.isBundle) return false;
      if (!searchQ.trim()) return true;
      const hay = `${p.name} ${p.barcode || ''}`.toLowerCase();
      return hay.includes(searchQ.trim().toLowerCase());
    });
  }, [db.products, searchQ]);

  // Filter products for bundle picker
  const filteredPickProducts = useMemo(() => {
    if (!searchProductQ.trim()) return regularProducts.slice(0, 8);
    const q = searchProductQ.toLowerCase().trim();
    return regularProducts.filter(p =>
      `${p.name} ${p.barcode || ''} ${p.category}`.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [regularProducts, searchProductQ]);

  // Bundle calculations
  const totalCost = bundleComponents.reduce((s, it) => s + (it.unitCost * it.qty), 0);
  const totalOriginalSell = bundleComponents.reduce((s, it) => s + (it.unitSell * it.qty), 0);
  const finalBundlePrice = typeof customPrice === 'number' && customPrice > 0 ? customPrice : totalOriginalSell;
  const customerDiscount = Math.max(0, totalOriginalSell - finalBundlePrice);
  const bundleProfit = finalBundlePrice - totalCost;

  // Add Component to bundle
  const handleAddComponent = (p: Product) => {
    const existing = bundleComponents.find(c => c.productId === p.id);
    if (existing) {
      setBundleComponents(bundleComponents.map(c =>
        c.productId === p.id ? { ...c, qty: c.qty + 1 } : c
      ));
    } else {
      setBundleComponents([
        ...bundleComponents,
        {
          productId: p.id,
          productName: productFullName(p),
          qty: 1,
          unitCost: p.costPrice || 0,
          unitSell: p.sellPrice || 0
        }
      ]);
    }
  };

  const handleUpdateComponentQty = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      setBundleComponents(bundleComponents.filter(c => c.productId !== productId));
    } else {
      setBundleComponents(bundleComponents.map(c =>
        c.productId === productId ? { ...c, qty: newQty } : c
      ));
    }
  };

  const handleRemoveComponent = (productId: string) => {
    setBundleComponents(bundleComponents.filter(c => c.productId !== productId));
  };

  // Save Bundle Product to Firestore
  const handleSaveBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bundleName.trim()) {
      toast('يرجى كتابة اسم الباقة / العرض');
      return;
    }
    if (bundleComponents.length === 0) {
      toast('يرجى إضافة مكون واحد على الأقل داخل الباقة');
      return;
    }

    setSaving(true);
    const actor = auditActor();
    const bundleId = uid();

    const calculatedInitialQty = getBundleAvailableQty({
      id: bundleId,
      name: bundleName.trim(),
      category: bundleCategory || 'عروض وباقات',
      unit: 'باقة / طقم',
      costPrice: totalCost,
      sellPrice: finalBundlePrice,
      qty: 0,
      minQty: 0,
      isBundle: true,
      bundleComponents: bundleComponents,
      createdAt: new Date().toISOString()
    }, db.products);

    const newBundleProduct: Product = {
      id: bundleId,
      name: bundleName.trim(),
      category: bundleCategory || 'عروض وباقات',
      barcode: bundleBarcode.trim() || `BND-${Math.floor(100000 + Math.random() * 900000)}`,
      unit: 'باقة / طقم',
      costPrice: totalCost,
      sellPrice: finalBundlePrice,
      qty: calculatedInitialQty,
      minQty: 0,
      isBundle: true,
      bundleComponents: bundleComponents,
      createdAt: new Date().toISOString(),
      actorUid: actor.uid,
      createdBy: actor.uid
    };

    try {
      await fsdb.collection('products').doc(bundleId).set(newBundleProduct);
      toast(`✅ تم إنشاء باقة (${bundleName}) بنجاح`);
      
      // Reset
      setBundleName('');
      setBundleBarcode('');
      setCustomPrice('');
      setBundleComponents([]);
      setActiveTab('list');
    } catch (err: any) {
      toast(`خطأ أثناء الحفظ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete Bundle
  const handleDeleteBundle = async (bundle: Product) => {
    if (!window.confirm(`هل أنت متأكد من حذف الباقة "${bundle.name}"؟`)) return;
    try {
      await fsdb.collection('products').doc(bundle.id).delete();
      toast(`تم حذف الباقة بنجاح`);
    } catch (err: any) {
      toast(`خطأ أثناء الحذف: ${err.message}`);
    }
  };

  // Print Barcode for bundle
  const handlePrintBundleBarcode = (bundle: Product) => {
    const html = generateBarcodeLabelHtml({
      productName: bundle.name,
      barcode: bundle.barcode || '',
      price: bundle.sellPrice,
      copies: 2,
      labelSize: '38x25'
    });
    showPrintModal({
      bodyHtml: html,
      filename: `باركود_باقة_${bundle.barcode || bundle.id}.pdf`
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. Header Navigation & Mode */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base md:text-lg text-slate-900">
              الباقات المجمعة وعروض المواسم (Bundles & Kits)
            </h2>
            <p className="text-xs text-slate-500">
              تجميع عدة أصناف (أقلام + كشاكيل + شنطة) في باقة واحدة بسعر عرض مخفض مع خصم المكونات تلقائياً عند البيع
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            استعراض الباقات ({existingBundles.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Plus className="w-4 h-4" />
            إنشاء باقة جديدة
          </button>
        </div>
      </div>

      {/* 2. TAB: List existing bundles */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث في الباقات بالاسم أو الباركود..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="flex-1 bg-transparent border-none text-xs md:text-sm focus:outline-hidden text-slate-900"
            />
          </div>

          {existingBundles.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-slate-700">لا توجد باقات مجمعة مسجلة حتى الآن</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                يمكنك إنشاء باقات مجمعة مثل (باقة العودة للمدارس، طقم هندسة وأقلام، شنطة كاملة) بأسعار خاصة لجذب العملاء وتصريف البضاعة.
              </p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                إنشاء أول باقة مجمعة الآن
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {existingBundles.map(bundle => {
                const availableQty = getBundleAvailableQty(bundle, db.products);
                const currentCost = getBundleCalculatedCost(bundle, db.products);
                const isOutOfStock = availableQty <= 0;

                return (
                  <div
                    key={bundle.id}
                    className="bg-white border border-slate-200 hover:border-amber-400 rounded-2xl p-4 shadow-xs transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-sm text-slate-900 leading-snug">{bundle.name}</h3>
                        <div className="flex flex-col items-end gap-1 flex-none">
                          <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold rounded-lg">
                            باقة عرض
                          </span>
                          {isOutOfStock ? (
                            <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold rounded-lg flex items-center gap-1">
                              غير متوفرة للتجميع
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-lg">
                              متاح: {availableQty} باقة
                            </span>
                          )}
                        </div>
                      </div>
                      {bundle.barcode && (
                        <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                          باركود: {bundle.barcode}
                        </p>
                      )}

                      {/* Components List with Live Component Stock */}
                      <div className="mt-3 bg-slate-50 border border-slate-100 rounded-xl p-2.5 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center text-[11px] text-slate-600 font-bold">
                          <span>محتويات الباقة ({bundle.bundleComponents?.length || 0} أصناف):</span>
                          <span className="text-[10px] text-slate-400">رصيد المكون بالمخزن</span>
                        </div>
                        <ul className="space-y-1 text-slate-700 divide-y divide-slate-200/50">
                          {bundle.bundleComponents?.map((c, i) => {
                            const compProd = db.products.find(p => p.id === c.productId);
                            const compStock = compProd ? Number(compProd.qty) || 0 : 0;
                            const isCompLow = compStock < c.qty;

                            return (
                              <li key={i} className="flex justify-between items-center pt-1 text-[11px]">
                                <span className="truncate pr-1">• {c.productName}</span>
                                <div className="flex items-center gap-1.5 flex-none">
                                  <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                    isCompLow
                                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}>
                                    المخزن: {compStock}
                                  </span>
                                  <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                    × {c.qty}
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block">سعر الباقة:</span>
                        <b className="text-base font-black font-mono text-emerald-700">
                          {fmt(bundle.sellPrice)} ج
                        </b>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const success = addSaleItemByProduct(bundle.id, 1);
                            if (success) goTo('saleInvoice');
                          }}
                          disabled={isOutOfStock}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-colors inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                          title="إضافة الباقة لفاتورة البيع"
                        >
                          <ShoppingBag className="w-3.5 h-3.5" />
                          بيع
                        </button>
                        <button
                          onClick={() => handlePrintBundleBarcode(bundle)}
                          className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="طباعة استيكر باركود للباقة"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBundle(bundle)}
                          className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                          title="حذف الباقة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB: Create New Bundle Form */}
      {activeTab === 'create' && (
        <form onSubmit={handleSaveBundle} className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left / Top: Info & Price */}
          <div className="lg:col-span-5 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sparkles className="w-4 h-4 text-amber-600" />
              بيانات الباقة وسعر العرض
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم الباقة / العرض الترويجي *</label>
              <input
                type="text"
                required
                placeholder="مثال: باقة العودة للمدارس (شنطة + مقلمة + 5 كشكول)"
                value={bundleName}
                onChange={e => setBundleName(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs md:text-sm focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الباركود المخصص</label>
                <input
                  type="text"
                  placeholder="توليد تلقائي إن ترك فارغاً"
                  value={bundleBarcode}
                  onChange={e => setBundleBarcode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-center focus:bg-white focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الفئة</label>
                <select
                  value={bundleCategory}
                  onChange={e => setBundleCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-hidden"
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="عروض وباقات خاصة">عروض وباقات خاصة</option>
                </select>
              </div>
            </div>

            {/* Financial Summary Card */}
            <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>إجمالي تكلفة المكونات:</span>
                <span className="font-mono font-bold text-slate-800">{fmt(totalCost)} ج</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>سعر البيع الأصلي للقطع منفردة:</span>
                <span className="font-mono line-through text-slate-400">{fmt(totalOriginalSell)} ج</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  سعر بيع الباقة النهائي للعميل (ج.م) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  placeholder={totalOriginalSell ? `${totalOriginalSell}` : '0'}
                  value={customPrice}
                  onChange={e => setCustomPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-mono text-center font-bold text-base text-amber-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {customerDiscount > 0 && (
                <div className="p-2 bg-emerald-100/70 border border-emerald-200 rounded-xl text-emerald-800 flex justify-between items-center font-bold text-[11px]">
                  <span>وفر العميل في العرض:</span>
                  <span className="font-mono text-xs">-{fmt(customerDiscount)} ج</span>
                </div>
              )}

              <div className="pt-2 border-t border-amber-200/80 flex justify-between text-xs font-bold text-slate-800">
                <span>صافي ربح الباقة:</span>
                <span className={`font-mono text-sm ${bundleProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  +{fmt(bundleProfit)} ج
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || bundleComponents.length === 0}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs md:text-sm shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {saving ? 'جاري الحفظ...' : 'حفظ الباقة وإتاحتها للبيع فوراً'}
            </button>
          </div>

          {/* Right: Select & Configure Components */}
          <div className="lg:col-span-7 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center justify-between border-b border-slate-100 pb-3">
              <span className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                مكونات وأصناف الباقة ({bundleComponents.length})
              </span>
              <span className="text-xs text-slate-400 font-normal">اختر الأصناف المراد دمجها</span>
            </h3>

            {/* Search Box for picking components */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث عن الأصناف لإضافتها للباقة..."
                  value={searchProductQ}
                  onChange={e => setSearchProductQ(e.target.value)}
                  className="w-full bg-transparent border-none text-xs focus:outline-hidden text-slate-900"
                />
              </div>

              {/* Suggestions dropdown / list */}
              {searchProductQ.trim() && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto divide-y divide-slate-200">
                  {filteredPickProducts.map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleAddComponent(p)}
                      className="p-2 hover:bg-amber-50 rounded-lg flex justify-between items-center cursor-pointer transition-colors text-xs"
                    >
                      <div className="min-w-0 pr-1">
                        <p className="font-bold text-slate-800 truncate">{productFullName(p)}</p>
                        <p className="text-[10px] text-slate-400">الرصيد: {p.qty} | سعر البيع: {fmt(p.sellPrice)} ج</p>
                      </div>
                      <button
                        type="button"
                        className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold text-[10px] hover:bg-amber-700 flex-none"
                      >
                        + إضافة للباقة
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chosen Components Table */}
            {bundleComponents.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs">
                لم يتم اختيار أي أصناف بعد. ابحث عن المنتجات بالأعلى وأضفها للباقة.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-xs text-right">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="p-2.5">الصنف</th>
                      <th className="p-2.5 text-center w-24">الكمية بالباقة</th>
                      <th className="p-2.5 text-center">سعر القطعة</th>
                      <th className="p-2.5 text-center">الإجمالي</th>
                      <th className="p-2.5 text-center w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bundleComponents.map(c => (
                      <tr key={c.productId} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-800">{c.productName}</td>
                        <td className="p-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateComponentQty(c.productId, c.qty - 1)}
                              className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold text-slate-700"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-mono font-bold">{c.qty}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateComponentQty(c.productId, c.qty + 1)}
                              className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 font-bold text-slate-700"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">{fmt(c.unitSell)} ج</td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {fmt(c.unitSell * c.qty)} ج
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveComponent(c.productId)}
                            className="p-1 text-rose-500 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
