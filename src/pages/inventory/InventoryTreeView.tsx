import React from 'react';
import { Trash2 } from 'lucide-react';
import { fmt } from '../../lib/utils';
import { getBundleAvailableQty } from '../../lib/bundles';

export interface InventoryTreeViewProps {
  productTree: Record<string, Record<string, Record<string, any[]>>>;
  canSeeCost: boolean;
  stockState: (p: any) => 'zero' | 'low' | 'normal';
  handleAdjustQty: (id: string, delta: number) => void;
  handleDeleteProduct: (id: string) => void;
  allProducts: any[];
}

export const InventoryTreeView: React.FC<InventoryTreeViewProps> = ({
  productTree,
  canSeeCost,
  stockState,
  handleAdjustQty,
  handleDeleteProduct,
  allProducts
}) => {
  return (
    <div className="space-y-2 pt-2">
      {Object.keys(productTree).length > 0 ? (
        Object.keys(productTree).sort().map(inst => (
          <details key={inst} open className="border border-[#D8CBB0] rounded-xl overflow-hidden bg-[#FAF6EE]">
            <summary className="p-3 bg-[#EFE7D6] font-bold text-sm text-[#1F2A3C] cursor-pointer select-none">
              🏢 {inst}
            </summary>
            <div className="p-3 space-y-2 bg-[#FFFDF8]">
              {Object.keys(productTree[inst]).sort().map(name => (
                <details key={name} className="border border-[#EFE7D6] rounded-lg p-2 bg-[#FAF6EE]">
                  <summary className="font-semibold text-xs text-[#1F2A3C] cursor-pointer">
                    📘 {name}
                  </summary>
                  <div className="mt-2 space-y-2">
                    {Object.keys(productTree[inst][name]).sort().map(grade => (
                      <div key={grade} className="p-2 bg-white rounded-lg border border-[#EFE7D6]">
                        <span className="text-[11px] font-bold text-[#A9762F] block mb-1.5">🎓 {grade}</span>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-right">
                            <thead>
                              <tr className="bg-[#FAF6EE] text-[#8E98A6]">
                                <th className="p-1.5">الترم</th>
                                {canSeeCost && <th className="p-1.5 text-center">التكلفة</th>}
                                <th className="p-1.5 text-center">البيع</th>
                                <th className="p-1.5 text-center">الكمية</th>
                                <th className="p-1.5 text-center">الحالة</th>
                                <th className="p-1.5"></th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#EFE7D6]">
                              {productTree[inst][name][grade].map(p => {
                                const st = stockState(p);
                                return (
                                  <tr key={p.id}>
                                    <td className="p-1.5 font-medium">{p.term || '-'}</td>
                                    {canSeeCost && (
                                      <td className="p-1.5 text-center font-mono">{fmt(p.costPrice)}</td>
                                    )}
                                    <td className="p-1.5 text-center font-mono font-bold text-[#A9762F]">
                                      {fmt(p.sellPrice)}
                                    </td>
                                    <td className="p-1.5 text-center">
                                      {p.isBundle ? (
                                        <span
                                          className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[11px]"
                                          title="متاح للتجميع من المكونات"
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
                                    <td className="p-1.5 text-center">
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
                                    <td className="p-1.5 text-left">
                                      <button
                                        onClick={() => handleDeleteProduct(p.id)}
                                        className="p-1 text-[#A8503A] hover:bg-[#A8503A]/10 rounded cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))
      ) : (
        <div className="text-center py-10 text-[#8E98A6] text-xs">لا توجد أصناف مطابقة للفلاتر</div>
      )}
    </div>
  );
};
