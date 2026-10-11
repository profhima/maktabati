import React from 'react';
import { FileText, Receipt } from 'lucide-react';
import { fmt } from '../../lib/utils';

export interface PosCheckoutPanelProps {
  discountValue: number;
  setDiscountValue: (val: number) => void;
  discountType: 'percent' | 'amount';
  setDiscountType: (type: 'percent' | 'amount') => void;
  paymentMethod: 'cash' | 'card' | 'vodafone_cash' | 'credit';
  setPaymentMethod: (method: 'cash' | 'card' | 'vodafone_cash' | 'credit') => void;
  loyaltyBalance: number;
  usePoints: number;
  setUsePoints: (points: number) => void;
  paidAmountInput: number;
  setPaidAmountInput: (amount: number) => void;
  originalSubtotal: number;
  categoryDiscountBreakdown: Record<string, number>;
  generalDiscount: number;
  sanitizedUsedPoints: number;
  totalAllDiscounts: number;
  netTotal: number;
  changeAmount: number;
  dueAmount: number;
  saving: boolean;
  cartLength: number;
  handleSaveInvoice: (isReceipt: boolean) => void;
  clearSaleCart: () => void;
}

export const PosCheckoutPanel: React.FC<PosCheckoutPanelProps> = ({
  discountValue,
  setDiscountValue,
  discountType,
  setDiscountType,
  paymentMethod,
  setPaymentMethod,
  loyaltyBalance,
  usePoints,
  setUsePoints,
  paidAmountInput,
  setPaidAmountInput,
  originalSubtotal,
  categoryDiscountBreakdown,
  generalDiscount,
  sanitizedUsedPoints,
  totalAllDiscounts,
  netTotal,
  changeAmount,
  dueAmount,
  saving,
  cartLength,
  handleSaveInvoice,
  clearSaleCart
}) => {
  return (
    <div className="space-y-4">
      {/* Discount & Payment Controls */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div>
          <label className="block font-bold text-slate-600 mb-1">الخصم العام الإضافي</label>
          <div className="flex gap-1">
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-slate-900 font-num"
              value={discountValue || ''}
              placeholder="0"
              onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
            />
            <select
              className="px-1.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              value={discountType}
              onChange={e => setDiscountType(e.target.value as any)}
            >
              <option value="percent">%</option>
              <option value="amount">ج</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-600 mb-1">طريقة الدفع</label>
          <select
            className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value as any)}
          >
            <option value="cash">💵 نقدًا (كاش)</option>
            <option value="card">💳 بطاقة بنكية / فيزا</option>
            <option value="vodafone_cash">📱 فودافون كاش</option>
            <option value="credit">⏳ آجل (على الحساب)</option>
          </select>
        </div>

        {loyaltyBalance > 0 && (
          <div className="col-span-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-800">
              ⭐ رصيد نقاط العميل: <span className="font-num">{loyaltyBalance}</span> نقطة
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-slate-700">استخدام:</span>
              <input
                type="number"
                min="0"
                max={loyaltyBalance}
                className="w-16 px-1.5 py-1 bg-white border border-emerald-400 rounded text-center text-xs font-bold text-slate-900 font-num"
                value={usePoints || ''}
                placeholder="0"
                onChange={e => setUsePoints(parseInt(e.target.value) || 0)}
              />
            </div>
          </div>
        )}

        {(paymentMethod === 'cash' || paymentMethod === 'credit') && (
          <div className="col-span-2">
            <label className="block font-bold text-slate-600 mb-1">
              {paymentMethod === 'credit' ? 'المقدم المدفوع الآن من العميل' : 'المبلغ المستلم نقداً من العميل'}
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-base font-bold text-center text-slate-900 font-num"
              placeholder="0.00"
              value={paidAmountInput || ''}
              onChange={e => setPaidAmountInput(parseFloat(e.target.value) || 0)}
            />
          </div>
        )}
      </div>

      {/* Financial Summary Card with Full Discount Breakdowns */}
      <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-1.5 text-xs shadow-inner">
        <div className="flex justify-between text-slate-300">
          <span>الإجمالي الأصلي قبل الخصومات:</span>
          <span className="font-bold text-white">{fmt(originalSubtotal)} ج</span>
        </div>

        {/* Category Discounts Breakdown */}
        {Object.keys(categoryDiscountBreakdown).length > 0 && (
          <div className="border-t border-slate-800 pt-1 space-y-0.5">
            {Object.entries(categoryDiscountBreakdown).map(([cat, amount]) => (
              <div key={cat} className="flex justify-between text-amber-300 text-[11px]">
                <span>• خصم قسم ({cat}):</span>
                <span className="font-bold">-{fmt(Number(amount))} ج</span>
              </div>
            ))}
          </div>
        )}

        {generalDiscount > 0 && (
          <div className="flex justify-between text-amber-300">
            <span>الخصم العام {discountType === 'percent' ? `(${discountValue}%)` : ''}:</span>
            <span className="font-bold">-{fmt(generalDiscount)} ج</span>
          </div>
        )}

        {sanitizedUsedPoints > 0 && (
          <div className="flex justify-between text-emerald-300">
            <span>خصم نقاط الولاء ({sanitizedUsedPoints} نقطة):</span>
            <span className="font-bold">-{fmt(sanitizedUsedPoints)} ج</span>
          </div>
        )}

        {totalAllDiscounts > 0 && (
          <div className="flex justify-between text-amber-300 font-bold border-t border-slate-800 pt-1">
            <span>⭐ إجمالي ما وفره العميل:</span>
            <span className="font-bold">-{fmt(totalAllDiscounts)} ج</span>
          </div>
        )}

        {/* Net Total */}
        <div className="flex justify-between text-base md:text-xl font-bold text-amber-400 pt-2 border-t-2 border-amber-500/40">
          <span>الصافي المطلوب:</span>
          <span className="font-bold">{fmt(netTotal)} ج</span>
        </div>

        {paymentMethod === 'cash' && changeAmount > 0 && (
          <div className="flex justify-between text-emerald-300 font-bold pt-1 border-t border-slate-800">
            <span>الباقي المسترد للعميل:</span>
            <span className="font-bold">{fmt(changeAmount)} ج</span>
          </div>
        )}

        {paymentMethod === 'credit' && dueAmount > 0 && (
          <div className="flex justify-between text-rose-300 font-bold pt-1 border-t border-slate-800">
            <span>المتبقي آجل على حساب العميل:</span>
            <span className="font-bold">{fmt(dueAmount)} ج</span>
          </div>
        )}
      </div>

      {/* Checkout Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          disabled={saving || !cartLength}
          onClick={() => handleSaveInvoice(false)}
          className="py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-98"
        >
          <FileText className="w-4 h-4" />
          حفظ + فاتورة A4
        </button>
        <button
          disabled={saving || !cartLength}
          onClick={() => handleSaveInvoice(true)}
          className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs md:text-sm flex items-center justify-center gap-1.5 shadow-md transition-all disabled:opacity-50 cursor-pointer active:scale-98"
        >
          <Receipt className="w-4 h-4" />
          حفظ + إيصال حراري
        </button>
      </div>

      <button
        onClick={() => {
          if (cartLength && window.confirm('تفريغ الفاتورة الحالية؟')) {
            clearSaleCart();
          }
        }}
        className="w-full mt-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer border border-slate-200"
      >
        تفريغ محتويات الفاتورة
      </button>
    </div>
  );
};
