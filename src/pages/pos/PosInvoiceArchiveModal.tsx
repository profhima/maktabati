import React from 'react';
import {
  FolderOpen,
  Search,
  X,
  Eye,
  Download,
  Printer,
  Receipt,
  ShoppingCart,
  RotateCcw
} from 'lucide-react';
import { fmt } from '../../lib/utils';

export interface PosInvoiceArchiveModalProps {
  recallArchiveOpen: boolean;
  setRecallArchiveOpen: (open: boolean) => void;
  filteredRecallInvoices: any[];
  totalInvoicesCount: number;
  recallSearchQ: string;
  setRecallSearchQ: (q: string) => void;
  recallDateFilter: 'today' | '7days' | 'month' | 'all';
  setRecallDateFilter: (filter: 'today' | '7days' | 'month' | 'all') => void;
  recallPayFilter: string;
  setRecallPayFilter: (filter: string) => void;
  openInvoiceModal: (inv: any) => void;
  handleDownloadInvoicePdf: (inv: any) => void;
  showA4Print: (inv: any) => void;
  showReceiptPrint: (inv: any) => void;
  reorderInvoiceToCart: (inv: any) => void;
  setReturnInvoice: (inv: any) => void;
  goTo: (page: any) => void;
}

export const PosInvoiceArchiveModal: React.FC<PosInvoiceArchiveModalProps> = ({
  recallArchiveOpen,
  setRecallArchiveOpen,
  filteredRecallInvoices,
  totalInvoicesCount,
  recallSearchQ,
  setRecallSearchQ,
  recallDateFilter,
  setRecallDateFilter,
  recallPayFilter,
  setRecallPayFilter,
  openInvoiceModal,
  handleDownloadInvoicePdf,
  showA4Print,
  showReceiptPrint,
  reorderInvoiceToCart,
  setReturnInvoice,
  goTo
}) => {
  if (!recallArchiveOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F2A3C]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={() => setRecallArchiveOpen(false)}
    >
      <div
        className="bg-[#FFFDF8] border border-[#D8CBB0] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Archive Modal Header */}
        <div className="p-4 bg-[#FAF6EE] border-b border-[#D8CBB0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#A9762F]/15 text-[#A9762F] flex items-center justify-center font-bold">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-black text-base sm:text-lg text-[#1F2A3C] flex items-center gap-2">
                أرشيف واستدعاء فواتير البيع
                <span className="text-xs bg-[#A9762F]/15 text-[#A9762F] font-mono px-2.5 py-0.5 rounded-full font-bold">
                  {filteredRecallInvoices.length} من أصل {totalInvoicesCount} فاتورة
                </span>
              </h3>
              <p className="text-xs text-[#8E98A6] mt-0.5">
                ابحث برقم الفاتورة أو العميل لإعادة الطباعة فوراً بصيغة A4 أو إيصال كاشير أو تكرار الأصناف
              </p>
            </div>
          </div>

          <button
            onClick={() => setRecallArchiveOpen(false)}
            className="w-8 h-8 rounded-full bg-[#EFE7D6] hover:bg-[#D8CBB0] text-[#1F2A3C] flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="p-3 sm:p-4 bg-white border-b border-[#EFE7D6] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Search input */}
            <div className="sm:col-span-6 relative">
              <input
                type="text"
                className="w-full px-3.5 py-2 pr-9 text-xs sm:text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#A9762F]/40"
                placeholder="ابحث برقم الفاتورة (#101)، اسم العميل، الهاتف..."
                value={recallSearchQ}
                onChange={e => setRecallSearchQ(e.target.value)}
                autoFocus
              />
              <Search className="w-4 h-4 text-[#8E98A6] absolute top-3 right-3" />
              {recallSearchQ && (
                <button
                  onClick={() => setRecallSearchQ('')}
                  className="absolute top-2.5 left-2.5 text-xs text-[#8E98A6] hover:text-[#1F2A3C] cursor-pointer"
                >
                  مسح
                </button>
              )}
            </div>

            {/* Date range filters */}
            <div className="sm:col-span-6 flex flex-wrap items-center gap-1">
              {[
                { id: 'today', label: 'اليوم' },
                { id: '7days', label: 'آخر 7 أيام' },
                { id: 'month', label: 'هذا الشهر' },
                { id: 'all', label: 'كافة الفواتير' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRecallDateFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    recallDateFilter === tab.id
                      ? 'bg-[#A9762F] text-white shadow-2xs'
                      : 'bg-[#FAF6EE] text-[#3A4A63] hover:bg-[#EFE7D6]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment methods filter pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1 border-t border-[#FAF6EE]">
            <span className="text-[#8E98A6] font-semibold">طريقة السداد:</span>
            {[
              { id: 'all', label: 'الكل' },
              { id: 'cash', label: 'نقدي (كاش)' },
              { id: 'card', label: 'فيزا / بطاقة' },
              { id: 'vodafone_cash', label: 'فودافون كاش' },
              { id: 'credit', label: 'آجل' }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setRecallPayFilter(p.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${
                  recallPayFilter === p.id
                    ? 'bg-[#1F2A3C] text-white'
                    : 'bg-[#FAF6EE] text-[#8E98A6] hover:bg-[#EFE7D6] hover:text-[#1F2A3C]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invoices List */}
        <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2.5">
          {filteredRecallInvoices.length > 0 ? (
            filteredRecallInvoices.map(inv => (
              <div
                key={inv.id}
                className="p-3 sm:p-4 rounded-xl bg-white border border-[#D8CBB0] hover:border-[#A9762F] shadow-2xs transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Invoice Info */}
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-serif font-black text-sm sm:text-base text-[#1F2A3C]">
                      فاتورة #{inv.number}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        inv.status === 'refunded'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {inv.status === 'refunded' ? 'مرتجعة' : 'مسددة'}
                    </span>
                    <span className="text-xs text-[#8E98A6]">📅 {inv.date}</span>
                    <span className="text-xs font-bold text-[#A9762F] px-2 py-0.5 bg-[#FAF6EE] rounded border border-[#D8CBB0]">
                      {inv.paymentMethod === 'cash'
                        ? 'نقدًا'
                        : inv.paymentMethod === 'credit'
                        ? 'آجل'
                        : inv.paymentMethod === 'card'
                        ? 'بطاقة'
                        : 'فودافون كاش'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#3A4A63]">
                    <span>
                      العميل: <b className="text-[#1F2A3C]">{inv.customerName || 'عميل نقدي'}</b>
                    </span>
                    {inv.customerPhone && (
                      <span className="text-[#8E98A6] font-mono">📱 {inv.customerPhone}</span>
                    )}
                    <span className="text-[#8E98A6]">
                      الأصناف: <b>{inv.items?.length || 0} صنف</b>
                      {inv.items?.[0] ? ` (${inv.items[0].name}${inv.items.length > 1 ? '...' : ''})` : ''}
                    </span>
                  </div>
                </div>

                {/* Totals & Quick Action Buttons */}
                <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-[#EFE7D6]">
                  <div className="text-right md:text-left pl-2">
                    <span className="text-[10px] text-[#8E98A6] block">صافي الفاتورة</span>
                    <b className="font-mono text-sm sm:text-base text-[#5C7A5E] font-black">{fmt(inv.total)} ج</b>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Details Modal */}
                    <button
                      onClick={() => {
                        setRecallArchiveOpen(false);
                        openInvoiceModal(inv);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-[#FAF6EE] hover:bg-[#EFE7D6] text-[#1F2A3C] font-bold text-xs flex items-center gap-1 border border-[#D8CBB0] transition-colors cursor-pointer"
                      title="معاينة كافة تفاصيل الفاتورة"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#A9762F]" />
                      تفاصيل
                    </button>

                    {/* Download PDF Direct */}
                    <button
                      onClick={() => handleDownloadInvoicePdf(inv)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#5C7A5E] hover:bg-[#4c684e] text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="تنزيل ملف PDF حقيقي للفاتورة مباشرة"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>

                    {/* Print A4 */}
                    <button
                      onClick={() => showA4Print(inv)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="معاينة وطباعة فاتورة A4"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      A4
                    </button>

                    {/* Print Receipt */}
                    <button
                      onClick={() => showReceiptPrint(inv)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#1F2A3C] hover:bg-[#2c3d56] text-white font-bold text-xs flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                      title="طباعة إيصال كاشير حراري"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      إيصال
                    </button>

                    {/* Reorder to Cart */}
                    <button
                      onClick={() => {
                        setRecallArchiveOpen(false);
                        reorderInvoiceToCart(inv);
                      }}
                      className="p-1.5 rounded-lg bg-[#5C7A5E]/15 hover:bg-[#5C7A5E] text-[#5C7A5E] hover:text-white transition-colors cursor-pointer"
                      title="تحميل الأصناف في سلة البيع"
                    >
                      <ShoppingCart className="w-4 h-4" />
                    </button>

                    {/* Return Button */}
                    {inv.status !== 'refunded' && (
                      <button
                        onClick={() => {
                          setRecallArchiveOpen(false);
                          setReturnInvoice(inv);
                          goTo('salesReturn');
                        }}
                        className="p-1.5 rounded-lg bg-[#A8503A]/15 hover:bg-[#A8503A] text-[#A8503A] hover:text-white transition-colors cursor-pointer"
                        title="عمل مرتجع على هذه الفاتورة"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-[#8E98A6] space-y-2 bg-[#FAF6EE]/50 rounded-2xl border border-dashed border-[#D8CBB0]">
              <FolderOpen className="w-8 h-8 text-[#A9762F]/40 mx-auto" />
              <p className="font-bold text-sm text-[#1F2A3C]">لا توجد فواتير مطابقة للبحث أو الفلتر المحدد</p>
              <p className="text-xs">جرب تغيير الفترة الزمنية أو إزالة كلمة البحث</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
