import React from 'react';
import { Landmark } from 'lucide-react';
import { fmt } from '../../lib/utils';

export interface TreasuryEvent {
  id: string;
  type: string;
  label: string;
  ref: string;
  date: string;
  time: string;
  in: number;
  out: number;
  note: string;
  paymentMethod?: string;
  isNonCash?: boolean;
  nonCashAmount?: number;
}

export interface TreasuryLedgerTableProps {
  filteredEvents: TreasuryEvent[];
  filterDate: string;
  setFilterDate: (date: string) => void;
  filterType: string;
  setFilterType: (type: string) => void;
}

export const TreasuryLedgerTable: React.FC<TreasuryLedgerTableProps> = ({
  filteredEvents,
  filterDate,
  setFilterDate,
  filterType,
  setFilterType
}) => {
  return (
    <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#EFE7D6]">
        <h3 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
          <Landmark className="w-5 h-5 text-[#A9762F]" />
          سجل التدفق النقدي التفصيلي للدرج والخزينة ({filteredEvents.length})
        </h3>

        <div className="flex gap-2">
          <input
            type="date"
            className="px-3 py-1.5 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
          <select
            className="px-3 py-1.5 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
          >
            <option value="">كل الحركات</option>
            <option value="in">وارد نقدي فقط (+)</option>
            <option value="out">منصرف نقدي فقط (-)</option>
            <option value="non_cash">مدفوعات إلكترونية غير نقدية (بطاقات / محافظ)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl max-h-[500px]">
        <table className="w-full text-xs text-right">
          <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C] sticky top-0">
            <tr>
              <th className="p-2.5">التاريخ / الوقت</th>
              <th className="p-2.5">نوع الحركة</th>
              <th className="p-2.5">المرجع</th>
              <th className="p-2.5 text-center">وارد نقدي (+)</th>
              <th className="p-2.5 text-center">منصرف نقدي (-)</th>
              <th className="p-2.5">البيان والتفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EFE7D6]">
            {filteredEvents.length > 0 ? (
              filteredEvents.map(ev => (
                <tr key={ev.id} className="hover:bg-[#FAF6EE]">
                  <td className="p-2.5 text-[#8E98A6]">
                    {ev.date}
                    <span className="block text-[10px]">{ev.time}</span>
                  </td>
                  <td className="p-2.5 font-bold text-[#1F2A3C]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span>{ev.label}</span>
                      {ev.isNonCash && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 border border-blue-200">
                          إلكتروني
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2.5 text-[#8E98A6]">{ev.ref}</td>
                  <td className="p-2.5 text-center font-mono font-bold">
                    {ev.in > 0 ? (
                      <span className="text-[#5C7A5E] font-bold">+{fmt(ev.in)} ج</span>
                    ) : ev.isNonCash ? (
                      <span className="text-blue-600 block font-normal text-[11px]" title="تم الدفع إلكترونياً ولا يدخل درج النقدية">
                        {fmt(ev.nonCashAmount || 0)} ج
                        <span className="block text-[9px] text-[#64748B]">(غير نقدي)</span>
                      </span>
                    ) : (
                      <span className="text-[#CBD5E1]">-</span>
                    )}
                  </td>
                  <td className="p-2.5 text-center font-mono font-bold">
                    {ev.out > 0 ? (
                      <span className="text-[#A8503A]">-{fmt(ev.out)} ج</span>
                    ) : (
                      <span className="text-[#CBD5E1]">-</span>
                    )}
                  </td>
                  <td className="p-2.5 text-[#8E98A6]">{ev.note}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-8 text-[#8E98A6]">
                  لا توجد حركات مسجلة بالخزينة
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
