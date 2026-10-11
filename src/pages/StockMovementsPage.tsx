import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, stockMovementLabel, productFullName } from '../lib/utils';
import { History, Package, Search } from 'lucide-react';

export const StockMovementsPage: React.FC = () => {
  const { db } = useApp();

  const [filterQ, setFilterQ] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');

  const movements = (db.stockMovements || []).filter(r => {
    const hay = `${r.productName || ''} ${r.barcode || ''} ${r.referenceNumber || ''} ${r.referenceId || ''} ${r.note || ''}`.toLowerCase();
    const q = filterQ.trim().toLowerCase();
    if (q && !hay.includes(q)) return false;
    if (filterType && r.type !== filterType) return false;
    if (filterFrom && (r.date || '') < filterFrom) return false;
    if (filterTo && (r.date || '') > filterTo) return false;
    return true;
  }).sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date));

  const totalInc = movements.reduce((s, r) => s + (Number(r.delta) > 0 ? Number(r.delta) : 0), 0);
  const totalDec = movements.reduce((s, r) => s + (Number(r.delta) < 0 ? Math.abs(Number(r.delta)) : 0), 0);

  // Selected Product Stock Card
  const selectedProduct = (db.products || []).find(x => x.id === selectedProductId);
  const productMovements = selectedProductId
    ? (db.stockMovements || [])
        .filter(r => r.productId === selectedProductId)
        .sort((a, b) => (a.createdAt || a.date).localeCompare(b.createdAt || b.date))
    : [];

  const prodInc = productMovements.reduce((s, r) => s + (Number(r.delta) > 0 ? Number(r.delta) : 0), 0);
  const prodDec = productMovements.reduce((s, r) => s + (Number(r.delta) < 0 ? Math.abs(Number(r.delta)) : 0), 0);
  const prodNet = prodInc - prodDec;
  const initialQty = productMovements.length ? (productMovements[0].qtyBefore ?? selectedProduct?.qty ?? 0) : (selectedProduct?.qty ?? 0);
  const calculatedQty = initialQty + prodNet;
  const currentActualQty = selectedProduct?.qty ?? 0;
  const variance = currentActualQty - calculatedQty;

  return (
    <div className="space-y-4">
      {/* Header & Stats */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#EFE7D6] mb-3">
          <div>
            <h3 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
              <History className="w-5 h-5 text-[#A9762F]" />
              سجل حركة المخزون التفصيلي (Stock Ledger)
            </h3>
            <p className="text-xs text-[#8E98A6] mt-0.5">
              كل حركة زيادة أو نقصان تسجل آلياً مع بيان العملية ورقم الفاتورة والرصيد قبل وبعد.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#A9762F] text-white">
            {movements.length} حركة
          </span>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
            <span className="text-xs text-[#8E98A6] block">إجمالي الزيادات (وارد)</span>
            <b className="text-xl text-[#5C7A5E] font-mono">+{fmt(totalInc)}</b>
          </div>
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
            <span className="text-xs text-[#8E98A6] block">إجمالي المنصرف (مبيعات)</span>
            <b className="text-xl text-[#A8503A] font-mono">-{fmt(totalDec)}</b>
          </div>
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
            <span className="text-xs text-[#8E98A6] block">صافي الحركة المسجلة</span>
            <b className="text-xl text-[#A9762F] font-mono">{fmt(totalInc - totalDec)}</b>
          </div>
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
            <span className="text-xs text-[#8E98A6] block">عدد الحركات</span>
            <b className="text-xl text-[#1F2A3C] font-mono">{movements.length}</b>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-[#EFE7D6]">
          <div className="relative">
            <input
              type="text"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              placeholder="بحث بالصنف، الباركود، رقم المرجع..."
              value={filterQ}
              onChange={e => setFilterQ(e.target.value)}
            />
            <Search className="w-3.5 h-3.5 text-[#8E98A6] absolute top-2.5 right-2.5" />
          </div>

          <div>
            <select
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">كل أنواع الحركات</option>
              <option value="sale">بيع</option>
              <option value="purchase">شراء</option>
              <option value="return">مرتجع نقدي</option>
              <option value="exchange_in">تبديل — صنف راجع</option>
              <option value="exchange_out">تبديل — صنف بديل</option>
              <option value="adjustment">تعديل يدوي</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
            />
          </div>

          <div>
            <input
              type="date"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Product Stock Card Inspector */}
      <div className="p-4 rounded-2xl bg-[#FBF8F1] border border-[#C99A4C] shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] flex items-center gap-2">
              <Package className="w-4 h-4 text-[#A9762F]" />
              🔎 بطاقة صنف تفصيلية وفحص المطابقة
            </h3>
            <p className="text-xs text-[#8E98A6]">
              اختر صنفاً لعرض كل حركاته ومطابقة الرصيد الحالي مع مسار الحركات المسجلة.
            </p>
          </div>

          <div className="w-full sm:w-80">
            <select
              className="w-full px-3 py-2 text-xs bg-white border border-[#D8CBB0] rounded-xl font-medium"
              value={selectedProductId}
              onChange={e => setSelectedProductId(e.target.value)}
            >
              <option value="">— اختر صنفاً للمطابقة —</option>
              {(db.products || []).map(p => (
                <option key={p.id} value={p.id}>
                  {productFullName(p)} {p.barcode ? `[${p.barcode}]` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedProduct && (
          <div className="p-3 bg-white rounded-xl border border-[#D8CBB0] space-y-3 mt-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFE7D6] pb-2 text-xs">
              <b>{productFullName(selectedProduct)}</b>
              <span className="font-mono">الرصيد الفعلي الحالي بالمخزن: <b className="text-sm text-[#A9762F]">{currentActualQty}</b> قطعة</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-center">
              <div className="p-2 bg-[#FAF6EE] rounded-lg"><span>وارد:</span> <b className="font-mono text-[#5C7A5E]">+{prodInc}</b></div>
              <div className="p-2 bg-[#FAF6EE] rounded-lg"><span>منصرف:</span> <b className="font-mono text-[#A8503A]">-{prodDec}</b></div>
              <div className="p-2 bg-[#FAF6EE] rounded-lg"><span>الصافي:</span> <b className="font-mono">{prodNet}</b></div>
              <div className={`p-2 rounded-lg font-bold ${variance === 0 ? 'bg-[#5C7A5E]/10 text-[#5C7A5E]' : 'bg-[#A8503A]/10 text-[#A8503A]'}`}>
                {variance === 0 ? '✓ مطابق تماماً' : `فرق: ${variance}`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Movements Table */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
        <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl max-h-[550px]">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C] sticky top-0">
              <tr>
                <th className="p-2.5">التاريخ والوقت</th>
                <th className="p-2.5">الصنف</th>
                <th className="p-2.5">نوع الحركة</th>
                <th className="p-2.5 text-center">الرصيد قبل</th>
                <th className="p-2.5 text-center">التغيير</th>
                <th className="p-2.5 text-center">الرصيد بعد</th>
                <th className="p-2.5">المرجع</th>
                <th className="p-2.5">البيان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7D6]">
              {movements.length > 0 ? (
                movements.map(r => {
                  const deltaNum = Number(r.delta) || 0;
                  return (
                    <tr key={r.id} className="hover:bg-[#FAF6EE]">
                      <td className="p-2.5 text-[#8E98A6]">
                        {r.date}
                        <span className="block text-[10px]">{(r.createdAt || '').slice(11, 19)}</span>
                      </td>
                      <td className="p-2.5 font-bold text-[#1F2A3C]">{r.productName || '-'}</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EFE7D6] text-[#1F2A3C]">
                          {stockMovementLabel(r.type)}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-mono">{fmt(r.qtyBefore)}</td>
                      <td className={`p-2.5 text-center font-mono font-bold ${deltaNum > 0 ? 'text-[#5C7A5E]' : 'text-[#A8503A]'}`}>
                        {deltaNum > 0 ? `+${deltaNum}` : deltaNum}
                      </td>
                      <td className="p-2.5 text-center font-mono">{fmt(r.qtyAfter)}</td>
                      <td className="p-2.5 text-[#8E98A6]">
                        {r.referenceNumber ? `#${r.referenceNumber}` : '-'}
                      </td>
                      <td className="p-2.5 text-[#8E98A6]">{r.note || '-'}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-[#8E98A6]">
                    لا توجد حركات مخزون مسجلة مطابقة للبحث
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
