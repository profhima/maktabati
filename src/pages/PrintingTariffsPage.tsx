import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb } from '../lib/firebase';
import { fmt, uid } from '../lib/utils';
import { Printer, Plus, Trash2, Calculator, Edit2 } from 'lucide-react';

export const PrintingTariffsPage: React.FC = () => {
  const { db, toast } = useApp();

  const [serviceName, setServiceName] = useState('');
  const [priceSingle, setPriceSingle] = useState<number | ''>('');
  const [priceDouble, setPriceDouble] = useState<number | ''>('');
  const [priceBulk, setPriceBulk] = useState<number | ''>('');
  const [minBulkQty, setMinBulkQty] = useState(50);
  const [category, setCategory] = useState('طباعة وتصوير');

  // Calculator
  const [calcServiceId, setCalcServiceId] = useState('');
  const [calcQty, setCalcQty] = useState(1);
  const [calcDoubleSided, setCalcDoubleSided] = useState(false);

  const tariffs = db.printingTariffs || [];

  const handleAddTariff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim() || !priceSingle) {
      toast('أدخل اسم الخدمة وسعر الوجه الفردي');
      return;
    }

    const tariff = {
      id: uid(),
      name: serviceName.trim(),
      category,
      priceSingle: Number(priceSingle),
      priceDouble: priceDouble ? Number(priceDouble) : Number(priceSingle) * 1.8,
      priceBulk: priceBulk ? Number(priceBulk) : Number(priceSingle) * 0.8,
      minBulkQty: Number(minBulkQty) || 50,
      createdAt: new Date().toISOString()
    };

    try {
      await fsdb.collection('printingTariffs').doc(tariff.id).set(tariff);
      toast(`تمت إضافة تسعيرة "${tariff.name}" بنجاح`);
      setServiceName('');
      setPriceSingle('');
      setPriceDouble('');
      setPriceBulk('');
    } catch (err: any) {
      toast(`خطأ: ${err.message}`);
    }
  };

  const handleDeleteTariff = async (id: string) => {
    if (!window.confirm('هل تريد حذف هذه التسعيرة؟')) return;
    try {
      await fsdb.collection('printingTariffs').doc(id).delete();
      toast('تم حذف التسعيرة');
    } catch (err: any) {
      toast(`خطأ: ${err.message}`);
    }
  };

  // Calculator logic
  const selectedTariff = tariffs.find(t => t.id === calcServiceId);
  const calcTotal = (() => {
    if (!selectedTariff) return 0;
    const isBulk = calcQty >= (selectedTariff.minBulkQty || 50);
    const unitRate = isBulk
      ? selectedTariff.priceBulk
      : calcDoubleSided
      ? selectedTariff.priceDouble
      : selectedTariff.priceSingle;
    return unitRate * calcQty;
  })();

  return (
    <div className="space-y-4">
      {/* 1. Calculator widget */}
      <div className="p-4 rounded-2xl bg-[#FBF8F1] border border-[#C99A4C] shadow-xs space-y-3">
        <h3 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
          <Calculator className="w-5 h-5 text-[#A9762F]" />
          حاسبة خدمات الطباعة والتصوير الفورية
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">الخدمة المطلوبة</label>
            <select
              className="w-full px-3 py-2 text-xs bg-white border border-[#D8CBB0] rounded-xl"
              value={calcServiceId}
              onChange={e => setCalcServiceId(e.target.value)}
            >
              <option value="">— اختر خدمة الطباعة —</option>
              {tariffs.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} (فردي: {fmt(t.priceSingle)} ج / وجهين: {fmt(t.priceDouble)} ج)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">الكمية (عدد الورق)</label>
            <input
              type="number"
              min="1"
              className="w-full px-3 py-2 text-xs bg-white border border-[#D8CBB0] rounded-xl font-mono text-center font-bold"
              value={calcQty}
              onChange={e => setCalcQty(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          <div className="flex items-center gap-2 pt-4">
            <label className="flex items-center gap-2 text-xs font-bold text-[#1F2A3C] cursor-pointer">
              <input
                type="checkbox"
                checked={calcDoubleSided}
                onChange={e => setCalcDoubleSided(e.target.checked)}
                className="w-4 h-4 accent-[#A9762F] rounded"
              />
              طباعة وجهين (Double)
            </label>
          </div>
        </div>

        {selectedTariff && (
          <div className="p-3 bg-white rounded-xl border border-[#D8CBB0] flex justify-between items-center text-xs">
            <span>
              الحساب الإجمالي لـ <b className="text-[#1F2A3C]">{calcQty}</b> ورقة ({selectedTariff.name}):
            </span>
            <b className="text-lg text-[#A9762F] font-mono">{fmt(calcTotal)} ج</b>
          </div>
        )}
      </div>

      {/* 2. Add Tariff Form */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
        <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#A9762F]" />
          إضافة تسعيرة خدمة جديدة
        </h3>

        <form onSubmit={handleAddTariff} className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-right">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">اسم الخدمة *</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
              placeholder="مثال: تصوير أبيض وأسود A4"
              value={serviceName}
              onChange={e => setServiceName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">سعر وجه واحد (ج.م) *</label>
            <input
              type="number"
              step="0.25"
              min="0"
              required
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono"
              placeholder="1.00"
              value={priceSingle}
              onChange={e => setPriceSingle(parseFloat(e.target.value) || '')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">سعر وجهين (ج.م)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono"
              placeholder="1.75"
              value={priceDouble}
              onChange={e => setPriceDouble(parseFloat(e.target.value) || '')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">سعر كميات وجملة</label>
            <input
              type="number"
              step="0.25"
              min="0"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono"
              placeholder="0.75"
              value={priceBulk}
              onChange={e => setPriceBulk(parseFloat(e.target.value) || '')}
            />
          </div>

          <div className="sm:col-span-5">
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs md:text-sm shadow-xs transition-colors"
            >
              ➕ حفظ التسعيرة
            </button>
          </div>
        </form>
      </div>

      {/* 3. Tariffs Table */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
        <h3 className="font-serif font-bold text-base text-[#1F2A3C] mb-3 flex items-center gap-2">
          <Printer className="w-5 h-5 text-[#A9762F]" />
          قائمة تسعيرات خدمات الطباعة والتجليد ({tariffs.length})
        </h3>

        <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
              <tr>
                <th className="p-2.5">الخدمة</th>
                <th className="p-2.5 text-center">سعر وجه واحد</th>
                <th className="p-2.5 text-center">سعر وجهين</th>
                <th className="p-2.5 text-center">سعر الجملة والكميات</th>
                <th className="p-2.5 text-center">حد أدنى للجملة</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7D6]">
              {tariffs.length > 0 ? (
                tariffs.map(t => (
                  <tr key={t.id} className="hover:bg-[#FAF6EE]">
                    <td className="p-2.5 font-bold">{t.name}</td>
                    <td className="p-2.5 text-center font-mono">{fmt(t.priceSingle)} ج</td>
                    <td className="p-2.5 text-center font-mono">{fmt(t.priceDouble)} ج</td>
                    <td className="p-2.5 text-center font-mono text-[#5C7A5E] font-bold">{fmt(t.priceBulk)} ج</td>
                    <td className="p-2.5 text-center font-mono">{t.minBulkQty || 50} ورقة</td>
                    <td className="p-2.5 text-left">
                      <button
                        onClick={() => handleDeleteTariff(t.id)}
                        className="p-1 text-[#A8503A] hover:bg-[#A8503A]/10 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#8E98A6]">
                    لم يتم تسجيل تسعيرات طباعة بعد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
