import React from 'react';
import { Barcode, Trash2 } from 'lucide-react';
import { getBundleAvailableQty } from '../../lib/bundles';

export interface InventoryBatchTableViewProps {
  filteredProducts: any[];
  canSeeCost: boolean;
  stockState: (p: any) => 'zero' | 'low' | 'normal';
  setCostEdits: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setSellEdits: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setMinQtyEdits: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setMaxQtyEdits: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  handleAdjustQty: (id: string, delta: number) => void;
  handlePrintBarcode: (p: any) => void;
  handleDeleteProduct: (id: string) => void;
  allProducts: any[];
}

export const InventoryBatchTableView: React.FC<InventoryBatchTableViewProps> = ({
  filteredProducts,
  canSeeCost,
  stockState,
  setCostEdits,
  setSellEdits,
  setMinQtyEdits,
  setMaxQtyEdits,
  handleAdjustQty,
  handlePrintBarcode,
  handleDeleteProduct,
  allProducts
}) => {
  return (
    <div className="overflow-x-auto border border-[#D8CBB0] rounded-xl max-h-[500px]">
      <table className="w-full text-xs text-right">
        <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C] sticky top-0 z-10">
          <tr>
            <th className="p-2.5">الصنف</th>
            <th className="p-2.5">الفئة</th>
            <th className="p-2.5">المؤسسة</th>
            <th className="p-2.5">السنة</th>
            <th className="p-2.5">الترم</th>
            {canSeeCost && <th className="p-2.5 text-center">سعر التكلفة</th>}
            <th className="p-2.5 text-center">سعر البيع</th>
            <th className="p-2.5 text-center">الكمية</th>
            <th className="p-2.5 text-center">حد أدنى</th>
            <th className="p-2.5 text-center">حد أقصى</th>
            <th className="p-2.5 text-center">الحالة</th>
            <th className="p-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EFE7D6]">
          {filteredProducts.map(p => {
            const st = stockState(p);
            return (
              <tr key={p.id} className="hover:bg-[#FAF6EE]">
                <td className="p-2.5 font-bold">
                  <div className="flex items-center gap-1.5">
                    <span>{p.name}</span>
                    {p.isBundle && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                        باقة
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-2.5 text-[#8E98A6]">{p.category}</td>
                <td className="p-2.5">{p.institution || '-'}</td>
                <td className="p-2.5">{p.grade || '-'}</td>
                <td className="p-2.5">{p.term || '-'}</td>
                {canSeeCost && (
                  <td className="p-2.5 text-center">
                    <input
                      type="number"
                      step="0.01"
                      className="w-16 px-1 py-1 border border-[#D8CBB0] rounded text-center font-mono text-xs bg-white"
                      defaultValue={p.costPrice}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        setCostEdits(prev => ({ ...prev, [p.id]: val }));
                      }}
                    />
                  </td>
                )}
                <td className="p-2.5 text-center">
                  <input
                    type="number"
                    step="0.01"
                    className="w-16 px-1 py-1 border border-[#D8CBB0] rounded text-center font-mono font-bold text-[#A9762F] text-xs bg-white"
                    defaultValue={p.sellPrice}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      setSellEdits(prev => ({ ...prev, [p.id]: val }));
                    }}
                  />
                </td>
                <td className="p-2.5 text-center">
                  {p.isBundle ? (
                    <span
                      className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs"
                      title="متاح للتجميع من المكونات بالمخزن"
                    >
                      {getBundleAvailableQty(p, allProducts)} (تجميع)
                    </span>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <button
                        onClick={() => handleAdjustQty(p.id, -1)}
                        className="w-5 h-5 rounded bg-[#EFE7D6] font-bold flex items-center justify-center text-xs cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-8 font-mono font-bold">{p.qty}</span>
                      <button
                        onClick={() => handleAdjustQty(p.id, 1)}
                        className="w-5 h-5 rounded bg-[#EFE7D6] font-bold flex items-center justify-center text-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  )}
                </td>
                <td className="p-2.5 text-center">
                  <input
                    type="number"
                    className="w-12 px-1 py-1 border border-[#D8CBB0] rounded text-center font-mono text-xs bg-white"
                    defaultValue={p.minQty ?? 5}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      setMinQtyEdits(prev => ({ ...prev, [p.id]: val }));
                    }}
                  />
                </td>
                <td className="p-2.5 text-center">
                  <input
                    type="number"
                    className="w-12 px-1 py-1 border border-[#D8CBB0] rounded text-center font-mono text-xs bg-white"
                    defaultValue={p.maxQty ?? 25}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      setMaxQtyEdits(prev => ({ ...prev, [p.id]: val }));
                    }}
                  />
                </td>
                <td className="p-2.5 text-center">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      st === 'zero'
                        ? 'bg-[#A8503A]/20 text-[#A8503A]'
                        : st === 'low'
                        ? 'bg-[#A9762F]/20 text-[#A9762F]'
                        : 'bg-[#5C7A5E]/20 text-[#5C7A5E]'
                    }`}
                  >
                    {st === 'zero' ? 'نافد' : st === 'low' ? 'منخفض' : 'متوفر'}
                  </span>
                </td>
                <td className="p-2.5 text-left">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handlePrintBarcode(p)}
                      title="طباعة استيكر باركود"
                      className="p-1 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded cursor-pointer"
                    >
                      <Barcode className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(p.id)}
                      title="حذف الصنف"
                      className="p-1 text-[#A8503A] hover:bg-[#A8503A]/10 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
