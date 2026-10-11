import React from 'react';
import { Sparkles, Printer, ShoppingCart, ArrowRight } from 'lucide-react';
import { fmt } from '../../lib/utils';

export interface ReorderItemData {
  productId: string;
  productName: string;
  category: string;
  unit: string;
  currentQty: number;
  minQty: number;
  maxQty: number;
  suggestedQty: number;
  costPrice: number;
  totalCost: number;
}

export interface InventoryReorderViewProps {
  selectedSupplierId: string;
  setSelectedSupplierId: (id: string) => void;
  suppliers: any[];
  reorderItemsData: ReorderItemData[];
  totalReorderCost: number;
  setCustomReorderQtys: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  poNotes: string;
  setPoNotes: (notes: string) => void;
  handlePrintPurchaseOrder: () => void;
  handleConvertToPurchaseInvoice: () => void;
}

export const InventoryReorderView: React.FC<InventoryReorderViewProps> = ({
  selectedSupplierId,
  setSelectedSupplierId,
  suppliers,
  reorderItemsData,
  totalReorderCost,
  setCustomReorderQtys,
  poNotes,
  setPoNotes,
  handlePrintPurchaseOrder,
  handleConvertToPurchaseInvoice
}) => {
  return (
    <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#D8CBB0] space-y-4 animate-in fade-in duration-150">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFE7D6]">
        <div>
          <h4 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#5C7A5E]" />
            محرك إعادة الطلب الذكي وأمر الشراء (Smart Auto-Reorder & PO)
          </h4>
          <p className="text-xs text-[#8E98A6] mt-0.5">
            يحلل الأصناف التي بلغت حد التنبيه أو نفدت ويحسب الكمية المطلوبة للوصول إلى السقف المستهدف.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-[#1F2A3C]">المورد المستهدف:</span>
          <select
            className="px-3 py-1.5 text-xs bg-white border border-[#D8CBB0] rounded-xl font-bold"
            value={selectedSupplierId}
            onChange={e => setSelectedSupplierId(e.target.value)}
          >
            <option value="">-- مورد عام / غير محدد --</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} {s.phone ? `(${s.phone})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Reorder Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-white rounded-xl border border-[#D8CBB0]">
          <span className="text-xs text-[#8E98A6] block">الأصناف المستحقة للطلب</span>
          <b className="text-xl text-[#A8503A] font-mono">{reorderItemsData.length} صنف</b>
        </div>

        <div className="p-3 bg-white rounded-xl border border-[#D8CBB0]">
          <span className="text-xs text-[#8E98A6] block">إجمالي عدد القطع المقترحة</span>
          <b className="text-xl text-[#1F2A3C] font-mono">
            {reorderItemsData.reduce((s, it) => s + it.suggestedQty, 0)} قطعة
          </b>
        </div>

        <div className="p-3 bg-white rounded-xl border border-[#D8CBB0]">
          <span className="text-xs text-[#8E98A6] block">إجمالي التكلفة التقديرية</span>
          <b className="text-xl text-[#5C7A5E] font-mono">{fmt(totalReorderCost)} ج</b>
        </div>
      </div>

      {/* Reorder Items Table */}
      <div className="overflow-x-auto border border-[#D8CBB0] rounded-xl bg-white max-h-[380px]">
        <table className="w-full text-xs text-right">
          <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C] sticky top-0">
            <tr>
              <th className="p-2.5">الصنف</th>
              <th className="p-2.5">الفئة</th>
              <th className="p-2.5 text-center">المخزون الحالي</th>
              <th className="p-2.5 text-center">حد الطلب (Min/Max)</th>
              <th className="p-2.5 text-center">الكمية المقترحة للطلب</th>
              <th className="p-2.5 text-center">سعر التكلفة</th>
              <th className="p-2.5 text-center">إجمالي البند</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE7D6]">
            {reorderItemsData.length > 0 ? (
              reorderItemsData.map(it => (
                <tr key={it.productId} className="hover:bg-[#FAF6EE]">
                  <td className="p-2.5 font-bold text-[#1F2A3C]">{it.productName}</td>
                  <td className="p-2.5 text-[#8E98A6]">{it.category}</td>
                  <td className="p-2.5 text-center">
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono font-bold text-[11px] ${
                        it.currentQty <= 0 ? 'bg-[#A8503A]/20 text-[#A8503A]' : 'bg-[#A9762F]/20 text-[#A9762F]'
                      }`}
                    >
                      {it.currentQty} {it.unit}
                    </span>
                  </td>
                  <td className="p-2.5 text-center font-mono text-[#8E98A6]">
                    {it.minQty} / {it.maxQty}
                  </td>
                  <td className="p-2.5 text-center">
                    <input
                      type="number"
                      min="1"
                      value={it.suggestedQty}
                      onChange={e => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setCustomReorderQtys(prev => ({ ...prev, [it.productId]: val }));
                      }}
                      className="w-16 px-1.5 py-1 text-center font-mono font-bold bg-[#FBF8F1] border border-[#D8CBB0] rounded-lg text-[#1F2A3C]"
                    />
                  </td>
                  <td className="p-2.5 text-center font-mono">{fmt(it.costPrice)} ج</td>
                  <td className="p-2.5 text-center font-mono font-bold text-[#5C7A5E]">
                    {fmt(it.totalCost)} ج
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-8 text-[#5C7A5E] font-bold">
                  🎉 ممتاز! جميع الأصناف في المخزون ضمن المستويات الآمنة ولا يوجد نقص حالياً.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Notes & Actions Bar */}
      {reorderItemsData.length > 0 && (
        <div className="space-y-3">
          <input
            type="text"
            placeholder="ملاحظات وشروط التوريد لأمر الشراء (اختياري)..."
            value={poNotes}
            onChange={e => setPoNotes(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white border border-[#D8CBB0] rounded-xl"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handlePrintPurchaseOrder}
              className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة وتصدير أمر الشراء الرسمي (PO PDF)
            </button>

            <button
              onClick={handleConvertToPurchaseInvoice}
              className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-[#5C7A5E] hover:bg-[#4c684e] text-white font-bold text-xs sm:text-sm shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              تحويل مباشر إلى فاتورة مشتريات واردة
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
