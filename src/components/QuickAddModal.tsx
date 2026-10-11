import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CATEGORIES, GRADES, TERMS } from '../lib/constants';
import { fsdb, auditActor } from '../lib/firebase';
import { uid, productFullName } from '../lib/utils';
import { PlusCircle, X } from 'lucide-react';

export const QuickAddModal: React.FC = () => {
  const {
    quickAddOpen,
    closeQuickAdd,
    quickAddContext,
    setSaleCartItems,
    setPurchaseCartItems,
    toast
  } = useApp();

  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [grade, setGrade] = useState('بدون تحديد');
  const [term, setTerm] = useState('الترم الأول');
  const [unit, setUnit] = useState('قطعة');
  const [costPrice, setCostPrice] = useState(0);
  const [sellPrice, setSellPrice] = useState(0);
  const [minQty, setMinQty] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (quickAddOpen && quickAddContext) {
      setName(quickAddContext.typedName || '');
      setInstitution('');
      setCategory(CATEGORIES[0]);
      setGrade('بدون تحديد');
      setTerm('الترم الأول');
      setUnit('قطعة');
      setCostPrice(0);
      setSellPrice(0);
      setMinQty(5);
    }
  }, [quickAddOpen, quickAddContext]);

  if (!quickAddOpen || !quickAddContext) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      toast('من فضلك أدخل اسم الصنف');
      return;
    }

    setSaving(true);
    const actor = auditActor();
    const product = {
      id: uid(),
      name: cleanName,
      category,
      barcode: '',
      institution: institution.trim(),
      grade: grade === 'بدون تحديد' ? '' : grade,
      term: term === 'غير محدد' ? '' : term,
      unit: unit.trim() || 'قطعة',
      costPrice: Number(costPrice) || 0,
      sellPrice: Number(sellPrice) || 0,
      qty: 0,
      minQty: Number(minQty) || 5,
      createdBy: actor.uid,
      actorUid: actor.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await fsdb.collection('products').doc(product.id).set(product);

      const qty = quickAddContext.qty || 1;
      if (quickAddContext.prefix === 'inv') {
        setSaleCartItems(prev => [
          ...prev,
          {
            productId: product.id,
            name: productFullName(product),
            qty,
            price: product.sellPrice,
            originalPrice: product.sellPrice,
            cost: product.costPrice,
            term: product.term || ''
          }
        ]);
      } else if (quickAddContext.prefix === 'pur') {
        setPurchaseCartItems(prev => [
          ...prev,
          {
            productId: product.id,
            name: productFullName(product),
            qty,
            cost: product.costPrice,
            sellPrice: product.sellPrice,
            term: product.term || ''
          }
        ]);
      }

      toast(`تمت إضافة "${product.name}" بنجاح للمخزون وللفاتورة`);
      closeQuickAdd();
    } catch (err: any) {
      toast(`خطأ أثناء إضافة الصنف: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F2A3C]/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={closeQuickAdd}
    >
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-5 shadow-2xl overflow-hidden space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <h3 className="font-bold text-base md:text-lg text-slate-900 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-amber-600" />
            إضافة صنف جديد غير مسجل بالمخزون
          </h3>
          <button
            onClick={closeQuickAdd}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="mt-4 space-y-3.5 text-right">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف *</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="مثال: كشكول 60 ورقة"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المؤسسة / الماركة</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="مثال: المعاصر / ستايلوس"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الفئة</label>
              <select
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">السنة الدراسية</label>
              <select
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                value={grade}
                onChange={e => setGrade(e.target.value)}
              >
                {GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الترم</label>
              <select
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                value={term}
                onChange={e => setTerm(e.target.value)}
              >
                {TERMS.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                value={unit}
                onChange={e => setUnit(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سعر التكلفة</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 font-mono"
                value={costPrice}
                onChange={e => setCostPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 font-mono"
                value={sellPrice}
                onChange={e => setSellPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">حد التنبيه</label>
              <input
                type="number"
                min="0"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 font-mono"
                value={minQty}
                onChange={e => setMinQty(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={closeQuickAdd}
              className="px-4 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 text-xs sm:text-sm rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {saving ? 'جاري الحفظ...' : '💾 حفظ وإضافة للفاتورة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
