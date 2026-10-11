import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb } from '../lib/firebase';
import { fmt, productFullName } from '../lib/utils';
import { CATEGORIES } from '../lib/constants';
import { Calculator, Sparkles, Percent, Tag } from 'lucide-react';

export const PricingPage: React.FC = () => {
  const { db, toast } = useApp();

  const [calcCost, setCalcCost] = useState(100);
  const [calcMargin, setCalcMargin] = useState(25);
  const [roundTo, setRoundTo] = useState(1);

  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkPercent, setBulkPercent] = useState(10);
  const [applying, setApplying] = useState(false);

  // Suggested Sell Price Calculation
  const calcGrossSell = calcCost * (1 + calcMargin / 100);
  const calcFinalSell = roundTo > 0 ? Math.ceil(calcGrossSell / roundTo) * roundTo : calcGrossSell;
  const calcNetProfit = calcFinalSell - calcCost;
  const calcActualMargin = calcFinalSell > 0 ? (calcNetProfit / calcFinalSell) * 100 : 0;

  // Bulk margin application to category
  const handleApplyBulkMargin = async () => {
    if (!bulkCategory) {
      toast('اختر فئة لتطبيق نسبة الربح عليها');
      return;
    }
    const targetProducts = (db.products || []).filter(p => p.category === bulkCategory && p.costPrice > 0);
    if (!targetProducts.length) {
      toast('لا توجد أصناف بتكلفة مسجلة في هذه الفئة');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من إعادة تسعير ${targetProducts.length} صنف في فئة "${bulkCategory}" بهامش ربح ${bulkPercent}%؟`)) {
      return;
    }

    setApplying(true);
    try {
      const CHUNK = 200;
      for (let i = 0; i < targetProducts.length; i += CHUNK) {
        const batch = fsdb.batch();
        targetProducts.slice(i, i + CHUNK).forEach(p => {
          const newSell = Math.ceil(p.costPrice * (1 + bulkPercent / 100));
          batch.update(fsdb.collection('products').doc(p.id), {
            sellPrice: newSell
          });
        });
        await batch.commit();
      }
      toast(`✅ تم تحديث أسعار بيع ${targetProducts.length} صنف بنجاح`);
    } catch (err: any) {
      toast(`خطأ أثناء التحديث: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  // Products with zero or negative margin
  const zeroMarginProducts = (db.products || []).filter(p => (p.sellPrice || 0) <= (p.costPrice || 0) && (p.costPrice || 0) > 0);

  return (
    <div className="space-y-4">
      {/* 1. Calculator & Smart Margin Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-6 p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#A9762F]" />
            حاسبة تسعير الصنف الذكية
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#3A4A63] mb-1">سعر التكلفة (ج.م)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono font-bold text-center"
                value={calcCost}
                onChange={e => setCalcCost(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3A4A63] mb-1">
                نسبة هامش الربح المستهدفة (%)
              </label>
              <input
                type="number"
                min="0"
                className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono font-bold text-center"
                value={calcMargin}
                onChange={e => setCalcMargin(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3A4A63] mb-1">التقريب لأقرب</label>
              <select
                className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
                value={roundTo}
                onChange={e => setRoundTo(parseInt(e.target.value) || 1)}
              >
                <option value="1">1 جنيه</option>
                <option value="5">5 جنيهات</option>
                <option value="10">10 جنيهات</option>
                <option value="0">بدون تقريب (كسور)</option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#D8CBB0] space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-[#8E98A6]">سعر البيع المقترح:</span>
              <b className="text-base text-[#A9762F] font-mono">{fmt(calcFinalSell)} ج</b>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8E98A6]">صافي ربح القطعة:</span>
              <b className="text-sm text-[#5C7A5E] font-mono">+{fmt(calcNetProfit)} ج</b>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8E98A6]">نسبة الربح من سعر البيع:</span>
              <b className="font-mono">{calcActualMargin.toFixed(1)}%</b>
            </div>
          </div>
        </div>

        {/* 2. Bulk Margin Modifier */}
        <div className="lg:col-span-6 p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-4">
          <h3 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#5C7A5E]" />
            تطبيق هامش ربح جماعي لفئة كاملة
          </h3>

          <p className="text-xs text-[#8E98A6]">
            يمكنك إعادة احتساب وتحديث سعر البيع لكل أصناف الفئة بضغطة زر بناءً على سعر تكلفتها المسجل.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#3A4A63] mb-1">الفئة المستهدفة</label>
              <select
                className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
                value={bulkCategory}
                onChange={e => setBulkCategory(e.target.value)}
              >
                <option value="">— اختر الفئة —</option>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#3A4A63] mb-1">هامش الربح (%)</label>
              <input
                type="number"
                min="1"
                className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono text-center font-bold"
                value={bulkPercent}
                onChange={e => setBulkPercent(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <button
            disabled={applying || !bulkCategory}
            onClick={handleApplyBulkMargin}
            className="w-full py-3 rounded-xl bg-[#5C7A5E] hover:bg-[#4c684e] text-white font-bold text-xs md:text-sm shadow-xs transition-all disabled:opacity-50"
          >
            {applying ? 'جاري إعادة التسعير...' : '✨ تطبيق الهامش على كافة أصناف الفئة'}
          </button>
        </div>
      </div>

      {/* 3. Negative / Zero Margin Warning List */}
      {zeroMarginProducts.length > 0 && (
        <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#A8503A]/40 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-bold text-sm md:text-base text-[#A8503A] flex items-center gap-2">
              ⚠️ تنبيه: أصناف بدون ربح أو تباع بأقل من التكلفة ({zeroMarginProducts.length} صنف)
            </h3>
          </div>

          <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl max-h-56">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
                <tr>
                  <th className="p-2">الصنف</th>
                  <th className="p-2">الفئة</th>
                  <th className="p-2 text-center">التكلفة</th>
                  <th className="p-2 text-center">سعر البيع الحالي</th>
                  <th className="p-2 text-center">الفرق</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE7D6]">
                {zeroMarginProducts.map(p => (
                  <tr key={p.id} className="hover:bg-[#FAF6EE]">
                    <td className="p-2 font-medium">{productFullName(p)}</td>
                    <td className="p-2 text-[#8E98A6]">{p.category}</td>
                    <td className="p-2 text-center font-mono">{fmt(p.costPrice)}</td>
                    <td className="p-2 text-center font-mono font-bold text-[#A8503A]">{fmt(p.sellPrice)}</td>
                    <td className="p-2 text-center font-mono text-[#A8503A]">
                      {fmt(p.sellPrice - p.costPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
