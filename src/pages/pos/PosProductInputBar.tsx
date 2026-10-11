import React from 'react';
import { Camera, Plus } from 'lucide-react';
import { fmt, productFullName } from '../../lib/utils';

export interface PosProductInputBarProps {
  barcodeRef: React.RefObject<HTMLInputElement | null>;
  barcodeInput: string;
  setBarcodeInput: (val: string) => void;
  handleBarcodeKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  openScanModal: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  prodSearch: string;
  setProdSearch: (val: string) => void;
  prodResultsOpen: boolean;
  setProdResultsOpen: (val: boolean) => void;
  matchingProducts: any[];
  selectProduct: (prod: any) => void;
  itemQty: number;
  setItemQty: (qty: number) => void;
  itemPrice: number | '';
  setItemPrice: (price: number | '') => void;
  handleManualAddProduct: () => void;
  openQuickAdd: (prefix: 'inv' | 'pur', typedName?: string, qty?: number) => void;
}

export const PosProductInputBar: React.FC<PosProductInputBarProps> = ({
  barcodeRef,
  barcodeInput,
  setBarcodeInput,
  handleBarcodeKeyDown,
  openScanModal,
  searchRef,
  prodSearch,
  setProdSearch,
  prodResultsOpen,
  setProdResultsOpen,
  matchingProducts,
  selectProduct,
  itemQty,
  setItemQty,
  itemPrice,
  setItemPrice,
  handleManualAddProduct,
  openQuickAdd
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Barcode Input for High-speed POS */}
        <div className="sm:col-span-6">
          <label className="block text-xs font-bold text-amber-700 mb-1">
            ⚡ مسح الباركود السريع (قارئ الباركود)
          </label>
          <div className="flex gap-1.5">
            <input
              ref={barcodeRef}
              type="text"
              className="flex-1 px-3 py-2.5 text-base bg-amber-50/50 border-2 border-amber-400/80 rounded-xl focus:bg-white focus:border-amber-600 focus:outline-hidden text-slate-900 font-bold"
              placeholder="امسح الباركود ثم اضغط Enter..."
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              onKeyDown={handleBarcodeKeyDown}
            />
            <button
              onClick={() => openScanModal()}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer border border-slate-200"
              title="مسح بكاميرا الهاتف"
            >
              <Camera className="w-5 h-5 text-amber-600" />
            </button>
          </div>
        </div>

        {/* Omni Product Search */}
        <div className="sm:col-span-6 relative">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            🔍 ابحث بالاسم أو المادة أو المؤسسة
          </label>
          <input
            ref={searchRef}
            type="text"
            className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-slate-900 font-medium"
            placeholder="اكتب اسم كتاب أو صنف أو ماركة..."
            value={prodSearch}
            onChange={e => {
              setProdSearch(e.target.value);
              setProdResultsOpen(true);
            }}
            onFocus={() => setProdResultsOpen(true)}
          />
          {prodResultsOpen && matchingProducts.length > 0 && (
            <div className="absolute top-full right-0 left-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
              {matchingProducts.map(p => (
                <div
                  key={p.id}
                  onClick={() => selectProduct(p)}
                  className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <b className="text-sm block text-slate-900 font-bold">{p.name}</b>
                    <span className="text-slate-500">{productFullName(p)}</span>
                  </div>
                  <div className="text-left">
                    <b className="text-sm text-amber-700 block font-bold">{fmt(p.sellPrice)} ج</b>
                    <span className="text-emerald-600 font-medium">
                      متاح: <span className="font-num">{p.qty}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Add Trigger */}
      <div className="grid grid-cols-12 gap-2 pt-2 border-t border-slate-100">
        <div className="col-span-4 sm:col-span-3">
          <label className="block text-[11px] font-bold text-slate-500 mb-1">الكمية</label>
          <input
            type="number"
            min="1"
            className="w-full px-2 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg font-bold text-center text-slate-900 font-num"
            value={itemQty}
            onChange={e => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
          />
        </div>
        <div className="col-span-4 sm:col-span-3">
          <label className="block text-[11px] font-bold text-slate-500 mb-1">السعر المخصص</label>
          <input
            type="number"
            step="0.01"
            className="w-full px-2 py-1.5 text-sm bg-slate-50 border border-slate-300 rounded-lg font-bold text-center text-slate-900 font-num"
            placeholder="سعر البيع"
            value={itemPrice}
            onChange={e => setItemPrice(parseFloat(e.target.value) || '')}
          />
        </div>
        <div className="col-span-4 sm:col-span-3 flex items-end">
          <button
            onClick={handleManualAddProduct}
            className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            إضافة
          </button>
        </div>
        <div className="col-span-12 sm:col-span-3 flex items-end">
          <button
            onClick={() => openQuickAdd('inv', prodSearch)}
            className="w-full py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer border border-slate-200"
          >
            ➕ صنف جديد
          </button>
        </div>
      </div>
    </div>
  );
};
