import React from 'react';
import { Landmark, ArrowDownLeft, ArrowUpRight, CreditCard, ShoppingBag } from 'lucide-react';
import { fmt } from '../../lib/utils';

export interface TreasuryKpisProps {
  totalIn: number;
  totalOut: number;
  totalNet: number;
  totalNonCash?: number;
  totalGrossSales?: number;
}

export const TreasuryKpis: React.FC<TreasuryKpisProps> = ({
  totalIn,
  totalOut,
  totalNet,
  totalNonCash = 0,
  totalGrossSales
}) => {
  return (
    <div className="space-y-3">
      {/* 1. Primary Physical Cash Drawer KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-[#FFFDF8] rounded-2xl border border-[#D8CBB0] shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-[#8E98A6]">المقبوضات النقدية (وارد الدرج)</span>
            <ArrowDownLeft className="w-4 h-4 text-[#5C7A5E]" />
          </div>
          <b className="text-2xl text-[#5C7A5E] font-mono">+{fmt(totalIn)} ج</b>
          <span className="block text-[10px] text-[#8E98A6] mt-0.5">مبيعات كاش + تحصيلات ديون + إيداعات</span>
        </div>

        <div className="p-4 bg-[#FFFDF8] rounded-2xl border border-[#D8CBB0] shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-[#8E98A6]">المدفوعات النقدية (صادر الدرج)</span>
            <ArrowUpRight className="w-4 h-4 text-[#A8503A]" />
          </div>
          <b className="text-2xl text-[#A8503A] font-mono">-{fmt(totalOut)} ج</b>
          <span className="block text-[10px] text-[#8E98A6] mt-0.5">مشتريات نقدية + سداد موردين + نثريات</span>
        </div>

        <div className="p-4 bg-[#FBF8F1] rounded-2xl border border-[#C99A4C] shadow-xs">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-bold text-[#1F2A3C]">رصيد درج النقدية الفعلي (الصافي)</span>
            <Landmark className="w-4 h-4 text-[#A9762F]" />
          </div>
          <b className="text-2xl text-[#A9762F] font-mono">{fmt(totalNet)} ج</b>
          <span className="block text-[10px] text-[#8E98A6] mt-0.5">النقدية الفعلية المطابقة للدرج وجرد اليوم</span>
        </div>
      </div>

      {/* 2. Secondary Breakdown: Non-Cash Electronic Payments & Gross Sales */}
      {(totalNonCash > 0 || (totalGrossSales !== undefined && totalGrossSales > 0)) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="px-4 py-2.5 bg-[#F8FAFC] rounded-xl border border-[#CBD5E1] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#3B82F6]" />
              <div>
                <span className="text-xs font-semibold text-[#1E293B]">مدفوعات غير نقدية (بطاقات ومحافظ إلكترونية)</span>
                <span className="block text-[10px] text-[#64748B]">فيزا، ماستركارد، فودافون كاش (لا تدخل درج النقدية)</span>
              </div>
            </div>
            <b className="text-base font-mono text-[#2563EB]">{fmt(totalNonCash)} ج</b>
          </div>

          {totalGrossSales !== undefined && (
            <div className="px-4 py-2.5 bg-[#FAF8F5] rounded-xl border border-[#E2D9C8] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#A9762F]" />
                <div>
                  <span className="text-xs font-semibold text-[#1F2A3C]">إجمالي المبيعات الشاملة</span>
                  <span className="block text-[10px] text-[#8E98A6]">شامل كافة الفواتير النقدية والإلكترونية</span>
                </div>
              </div>
              <b className="text-base font-mono text-[#1F2A3C]">{fmt(totalGrossSales)} ج</b>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

