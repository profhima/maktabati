import React from 'react';
import { Receipt, Trash2 } from 'lucide-react';
import { fmt } from '../../lib/utils';
import { InvoiceItem } from '../../types';

export interface PosCartTableProps {
  saleCartItems: InvoiceItem[];
  setSaleCartItems: React.Dispatch<React.SetStateAction<InvoiceItem[]>>;
  cartWithDiscounts: any[];
}

export const PosCartTable: React.FC<PosCartTableProps> = ({
  saleCartItems,
  setSaleCartItems,
  cartWithDiscounts
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-md">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <Receipt className="w-5 h-5 text-amber-600" />
          محتويات الفاتورة
        </h3>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-900 text-white font-num">
          {saleCartItems.reduce((s, it) => s + it.qty, 0)} قطعة
        </span>
      </div>

      {/* Detailed Cart Table with Before / After Discount Columns */}
      <div className="overflow-x-auto max-h-64 mb-3 border border-slate-200 rounded-xl">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="bg-slate-100 font-bold text-slate-800 sticky top-0 z-10">
            <tr>
              <th className="p-2 text-right">الصنف</th>
              <th className="p-2 text-center w-20">قبل الخصم</th>
              <th className="p-2 text-center w-20">بعد الخصم</th>
              <th className="p-2 text-center w-24">الكمية</th>
              <th className="p-2 text-center w-24">الإجمالي</th>
              <th className="p-2 text-center w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cartWithDiscounts.length > 0 ? (
              cartWithDiscounts.map((it, idx) => {
                const orig = Number(it.originalPrice ?? it.price) || 0;
                const actual = Number(it.price) || 0;
                const hasDisc = orig > actual;
                const diff = orig - actual;

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="p-2">
                      <b className="block text-slate-900 text-xs font-bold leading-snug">{it.name}</b>
                      {hasDisc && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded inline-block mt-0.5">
                          وفر: -{fmt(diff)} ج
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center font-bold text-xs">
                      {hasDisc ? (
                        <span className="line-through text-slate-400 font-bold">{fmt(orig)}</span>
                      ) : (
                        <span className="text-slate-600 font-bold">{fmt(orig)}</span>
                      )}
                    </td>
                    <td className="p-2 text-center font-bold text-sm text-slate-900">
                      {fmt(actual)}
                    </td>
                    <td className="p-2 text-center">
                      <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden shadow-2xs">
                        <button
                          onClick={() => {
                            setSaleCartItems(prev => {
                              const next = [...prev];
                              const q = Math.max(1, (next[idx].qty || 1) - 1);
                              next[idx] = { ...next[idx], qty: q };
                              return next;
                            });
                          }}
                          className="px-2 py-0.5 text-xs text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          className="w-9 text-center font-bold text-xs py-0.5 bg-transparent border-0 focus:outline-hidden text-slate-900 font-num"
                          value={it.qty}
                          onChange={e => {
                            const q = Math.max(1, parseInt(e.target.value) || 1);
                            setSaleCartItems(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], qty: q };
                              return next;
                            });
                          }}
                        />
                        <button
                          onClick={() => {
                            setSaleCartItems(prev => {
                              const next = [...prev];
                              next[idx] = { ...next[idx], qty: (next[idx].qty || 1) + 1 };
                              return next;
                            });
                          }}
                          className="px-2 py-0.5 text-xs text-slate-700 font-bold hover:bg-slate-100 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="p-2 text-center font-bold text-sm text-amber-700">
                      {fmt(it.qty * actual)}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => {
                          setSaleCartItems(prev => prev.filter((_, i) => i !== idx));
                        }}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        title="حذف البند"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400 font-semibold">
                  الفاتورة فارغة • امسح باركود أو اختر صنفاً
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
