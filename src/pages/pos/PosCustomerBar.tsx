import React from 'react';
import { UserCheck } from 'lucide-react';
import { fmt, todayStr } from '../../lib/utils';

export interface PosCustomerBarProps {
  custSearch: string;
  setCustSearch: (val: string) => void;
  custResultsOpen: boolean;
  setCustResultsOpen: (val: boolean) => void;
  matchingCustomers: any[];
  selectCustomer: (cust: any) => void;
  clearSelectedCustomer: () => void;
  selectedCustomerId: string | null;
  customerName: string;
  setCustomerName: (val: string) => void;
  customerPhone: string;
  setCustomerPhone: (val: string) => void;
  customerAddress: string;
  setCustomerAddress: (val: string) => void;
  selectedCustObj?: any;
  custPrevBalance: number;
  loyaltyBalance: number;
}

export const PosCustomerBar: React.FC<PosCustomerBarProps> = ({
  custSearch,
  setCustSearch,
  custResultsOpen,
  setCustResultsOpen,
  matchingCustomers,
  selectCustomer,
  clearSelectedCustomer,
  selectedCustomerId,
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerAddress,
  setCustomerAddress,
  selectedCustObj,
  custPrevBalance,
  loyaltyBalance
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
        <h3 className="font-bold text-sm md:text-base text-slate-900 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-amber-600" />
          بيانات العميل (تظهر بالكامل في الفاتورة المطبوعة)
        </h3>
        {selectedCustomerId ? (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2.5 py-0.5 rounded-full">
              عميل مسجل: {customerName}
            </span>
            <button
              onClick={clearSelectedCustomer}
              className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-num">{todayStr()}</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <label className="block text-xs font-bold text-slate-700 mb-1">🔍 ابحث عن عميل مسجل</label>
          <input
            type="text"
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-slate-900 font-medium"
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            value={custSearch}
            onChange={e => {
              setCustSearch(e.target.value);
              setCustResultsOpen(true);
            }}
            onFocus={() => setCustResultsOpen(true)}
          />
          {custResultsOpen && matchingCustomers.length > 0 && (
            <div className="absolute top-full right-0 left-0 z-30 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100">
              {matchingCustomers.map(c => (
                <div
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className="p-2.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                >
                  <div>
                    <b className="block text-slate-900 font-bold">{c.name}</b>
                    <span className="text-[10px] text-slate-500">{c.address || 'بدون عنوان'}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-amber-700 font-bold block font-num">{c.phone || '—'}</span>
                    {c.loyaltyPoints ? (
                      <span className="text-[10px] text-emerald-600 font-bold">⭐ {c.loyaltyPoints} نقطة</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">اسم العميل</label>
          <input
            type="text"
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-slate-900 font-medium"
            placeholder="عميل نقدي / مبيعات صالة"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (واتساب)</label>
          <input
            type="tel"
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-slate-900 font-medium font-num"
            placeholder="010XXXXXXXX"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">العنوان / ملاحظات</label>
          <input
            type="text"
            className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/40 text-slate-900 font-medium"
            placeholder="المدينة / المنطقة"
            value={customerAddress}
            onChange={e => setCustomerAddress(e.target.value)}
          />
        </div>
      </div>

      {/* Selected Customer Stats Pill */}
      {selectedCustObj && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4 text-xs">
          <span className="text-slate-700 font-medium">
            كود العميل: <b className="font-num">#{selectedCustObj.id.slice(-6).toUpperCase()}</b>
          </span>
          <span className="text-slate-700 font-medium">
            الرصيد السابق: <b className={custPrevBalance > 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmt(custPrevBalance)} ج</b>
          </span>
          <span className="text-amber-700 font-bold">
            ⭐ رصيد نقاط الولاء: <span className="font-num">{loyaltyBalance}</span> نقطة
          </span>
        </div>
      )}
    </div>
  );
};
