import React from 'react';
import { Plus, BookOpen, Download } from 'lucide-react';
import { CATEGORIES, GRADES, TERMS } from '../../lib/constants';

export interface InventoryAddProductFormProps {
  newName: string;
  setNewName: (val: string) => void;
  newBarcode: string;
  setNewBarcode: (val: string) => void;
  newCategory: string;
  setNewCategory: (val: string) => void;
  newInstitution: string;
  setNewInstitution: (val: string) => void;
  newGrade: string;
  setNewGrade: (val: string) => void;
  newTerm: string;
  setNewTerm: (val: string) => void;
  newCost: number;
  setNewCost: (val: number) => void;
  newSell: number;
  setNewSell: (val: number) => void;
  newQty: number;
  setNewQty: (val: number) => void;
  newMinQty: number;
  setNewMinQty: (val: number) => void;
  newMaxQty: number;
  setNewMaxQty: (val: number) => void;
  handleAddProduct: (e: React.FormEvent) => void;
  onOpenEgyptianCatalog?: () => void;
}

export const InventoryAddProductForm: React.FC<InventoryAddProductFormProps> = ({
  newName,
  setNewName,
  newBarcode,
  setNewBarcode,
  newCategory,
  setNewCategory,
  newInstitution,
  setNewInstitution,
  newGrade,
  setNewGrade,
  newTerm,
  setNewTerm,
  newCost,
  setNewCost,
  newSell,
  setNewSell,
  newQty,
  setNewQty,
  newMinQty,
  setNewMinQty,
  newMaxQty,
  setNewMaxQty,
  handleAddProduct,
  onOpenEgyptianCatalog
}) => {
  return (
    <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFE7D6] pb-3">
        <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#A9762F]" />
          إضافة صنف جديد للمخزون (مع تحديد سقف وحد إعادة الطلب الذكي)
        </h3>

        {onOpenEgyptianCatalog && (
          <button
            type="button"
            onClick={onOpenEgyptianCatalog}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-600/30 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="فتح دليل السلع والقرطاسية المصرية لتنزيل ملفات الإكسيل والـ CSV"
          >
            <BookOpen className="w-4 h-4 text-amber-700" />
            <span>📖 دليل سلع المكتبات المصرية الشامل (Excel / CSV)</span>
          </button>
        )}
      </div>

      <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-right">
        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">اسم الصنف *</label>
          <input
            type="text"
            required
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
            placeholder="مثال: كشكول 60 ورقة"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">الباركود (اختياري)</label>
          <input
            type="text"
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden font-mono"
            placeholder="امسح الباركود..."
            value={newBarcode}
            onChange={e => setNewBarcode(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">الفئة</label>
          <select
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">المؤسسة / الماركة</label>
          <input
            type="text"
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
            placeholder="مثال: سلاح التلميذ"
            value={newInstitution}
            onChange={e => setNewInstitution(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">السنة الدراسية</label>
          <select
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
            value={newGrade}
            onChange={e => setNewGrade(e.target.value)}
          >
            {GRADES.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">الترم</label>
          <select
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
            value={newTerm}
            onChange={e => setNewTerm(e.target.value)}
          >
            {TERMS.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">سعر التكلفة (ج)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden font-mono"
            value={newCost}
            onChange={e => setNewCost(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">سعر البيع (ج)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden font-mono"
            value={newSell}
            onChange={e => setNewSell(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">الكمية الافتتاحية</label>
          <input
            type="number"
            min="0"
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden font-mono"
            value={newQty}
            onChange={e => setNewQty(parseInt(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">حد التنبيه الأدنى (Min Qty)</label>
          <input
            type="number"
            min="1"
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden font-mono"
            value={newMinQty}
            onChange={e => setNewMinQty(parseInt(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#3A4A63] mb-1">السقف المستهدف (Max Qty)</label>
          <input
            type="number"
            min="1"
            className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden font-mono"
            value={newMaxQty}
            onChange={e => setNewMaxQty(parseInt(e.target.value) || 0)}
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs md:text-sm shadow-xs transition-colors cursor-pointer"
          >
            ➕ إضافة الصنف للمخزون
          </button>
        </div>
      </form>
    </div>
  );
};
