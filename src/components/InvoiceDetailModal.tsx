import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fmt, formatTimeEn } from '../lib/utils';
import {
  generateA4SaleInvoiceHtml,
  generateThermalReceiptHtml,
  generateWhatsAppReceiptMessage
} from '../lib/invoiceTemplates';
import { exportElementToPdf, sharePdfFile } from '../lib/pdfExporter';
import { getShopSettings } from '../lib/settings';
import { SHOP_NAME, SHOP_DEFAULT_LOGO } from '../lib/constants';
import {
  X,
  Printer,
  Receipt,
  Share2,
  Copy,
  ShoppingCart,
  RotateCcw,
  Calendar,
  User,
  Phone,
  MapPin,
  CreditCard,
  UserCheck,
  Download,
  Loader2,
  FileText
} from 'lucide-react';

export const InvoiceDetailModal: React.FC = () => {
  const {
    selectedInvoiceForModal,
    closeInvoiceModal,
    showPrintModal,
    reorderInvoiceToCart,
    setReturnInvoice,
    goTo,
    currentProfile,
    toast
  } = useApp();

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);

  if (!selectedInvoiceForModal) return null;

  const inv = selectedInvoiceForModal;
  const cashierName = inv.createdBy || currentProfile?.name || 'المدير المسؤول';

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      toast('⏳ جاري إنشاء وتحميل ملف PDF الفاتورة...');

      const bodyHtml = generateA4SaleInvoiceHtml({
        invoice: inv,
        cashierName
      });

      await exportElementToPdf({
        html: bodyHtml,
        filename: `فاتورة_مبيعات_رقم_${inv.number}.pdf`,
        isThermal: false
      });

      toast(`✅ تم تنزيل ملف (فاتورة_مبيعات_رقم_${inv.number}.pdf) بنجاح`);
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      toast('❌ حدث خطأ أثناء إنشاء ملف PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleSharePdf = async () => {
    try {
      setIsSharingPdf(true);
      toast('⏳ جاري تجهيز ملف PDF لإرساله للعميل...');

      const bodyHtml = generateA4SaleInvoiceHtml({
        invoice: inv,
        cashierName
      });

      const res = await sharePdfFile({
        html: bodyHtml,
        filename: `فاتورة_مبيعات_رقم_${inv.number}.pdf`,
        title: `فاتورة مبيعات #${inv.number} - ${inv.customerName || 'عميل'}`,
        isThermal: false,
        phone: inv.customerPhone,
        textMessage: generateWhatsAppReceiptMessage(inv, cashierName)
      });

      if (res.action === 'shared_mobile') {
        toast('✅ تم فتح نافذة مشاركة ملف PDF بنجاح');
      } else if (res.action === 'downloaded_and_whatsapp') {
        toast('✅ تم تنزيل ملف الـ PDF وفتح محادثة الواتساب. يمكنك الآن سحب الملف المُنزل أو إرفاقه 📎 لإرساله للعميل فوراً');
      } else {
        toast(`✅ تم تنزيل ملف (فاتورة_مبيعات_رقم_${inv.number}.pdf) على جهازك`);
      }
    } catch (err: any) {
      console.error('PDF Share Error:', err);
      toast('⚠️ تعذر إرسال الملف، جاري التنزيل المباشر...');
      handleDownloadPdf();
    } finally {
      setIsSharingPdf(false);
    }
  };

  const handlePrintA4 = () => {
    const bodyHtml = generateA4SaleInvoiceHtml({
      invoice: inv,
      cashierName
    });

    showPrintModal({
      bodyHtml,
      phone: inv.customerPhone,
      filename: `فاتورة_مبيعات_رقم_${inv.number}.pdf`,
      waMessage: generateWhatsAppReceiptMessage(inv, cashierName)
    });
  };

  const handlePrintThermal = () => {
    const bodyHtml = generateThermalReceiptHtml({
      invoice: inv,
      cashierName
    });

    showPrintModal({
      bodyHtml,
      phone: inv.customerPhone,
      filename: `إيصال_حراري_رقم_${inv.number}.pdf`,
      waMessage: generateWhatsAppReceiptMessage(inv, cashierName)
    });
  };

  const handleCopyText = async () => {
    const text = generateWhatsAppReceiptMessage(inv, cashierName);
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast('📋 تم نسخ نص الفاتورة إلى الحافظة بنجاح');
      } else {
        toast('⚠️ الحافظة غير مدعومة في هذا المتصفح');
      }
    } catch {
      toast('⚠️ تعذر نسخ النص');
    }
  };

  const handleWhatsAppText = () => {
    const phone = (inv.customerPhone || '').replace(/\D/g, '');
    const text = encodeURIComponent(generateWhatsAppReceiptMessage(inv, cashierName));
    const targetPhone = phone.startsWith('0') ? `2${phone}` : phone;
    const url = targetPhone ? `https://wa.me/${targetPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleStartReturn = () => {
    setReturnInvoice(inv);
    closeInvoiceModal();
    goTo('salesReturn');
  };

  const getPaymentLabel = (m: string) => {
    switch (m) {
      case 'cash': return 'نقدًا (كاش)';
      case 'card': return 'بطاقة مصرفية (فيزا)';
      case 'vodafone_cash': return 'محفظة إلكترونية (فودافون كاش)';
      case 'credit': return 'آجل (ذمم عملاء)';
      default: return m || 'نقدًا';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F2A3C]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={closeInvoiceModal}
    >
      <div
        className="bg-[#FFFDF8] border border-[#D8CBB0] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white p-0.5 border border-amber-400/60 shadow-2xs flex items-center justify-center overflow-hidden">
              <img
                src={getShopSettings().logoUrl || SHOP_DEFAULT_LOGO}
                alt={SHOP_NAME}
                className="w-full h-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-900">
                  فاتورة مبيعات رقم #{inv.number}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  inv.status === 'refunded'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {inv.status === 'refunded' ? 'مرتجعة' : 'مكتملة ومسددة'}
                </span>
              </div>
              <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-amber-700" />
                {inv.date} {inv.createdAt ? `• ${formatTimeEn(inv.createdAt)}` : ''}
              </p>
            </div>
          </div>

          <button
            onClick={closeInvoiceModal}
            className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {/* Customer & Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Box */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <User className="w-3.5 h-3.5" />
                بيانات العميل
              </span>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">الاسم:</span>
                <b className="text-slate-900 text-sm">{inv.customerName || 'عميل نقدي'}</b>
              </div>
              {inv.customerPhone && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-700" />
                    الهاتف:
                  </span>
                  <span className="font-mono font-bold text-slate-900">{inv.customerPhone}</span>
                </div>
              )}
              {inv.customerAddress && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-700" />
                    العنوان:
                  </span>
                  <span className="text-slate-900 truncate max-w-[200px]">{inv.customerAddress}</span>
                </div>
              )}
            </div>

            {/* Payment & Cashier Box */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 shadow-2xs">
              <span className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5 pb-1 border-b border-slate-100">
                <CreditCard className="w-3.5 h-3.5" />
                تفاصيل العملية والكاشير
              </span>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">طريقة الدفع:</span>
                <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                  {getPaymentLabel(inv.paymentMethod)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium flex items-center gap-1">
                  <UserCheck className="w-3 h-3 text-emerald-700" />
                  المسؤول / الكاشير:
                </span>
                <b className="text-slate-900">{cashierName}</b>
              </div>
              {(inv.usedPoints || 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-medium">نقاط ولاء مستخدمة:</span>
                  <span className="font-mono font-bold text-emerald-700">⭐ {inv.usedPoints} نقطة ({fmt(inv.usedPoints! * 0.1)} ج)</span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
            <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-800 flex items-center justify-between border-b border-slate-200">
              <span>قائمة الأصناف والمنتجات ({inv.items?.length || 0})</span>
              <span className="text-[11px] text-slate-600">سعر الوحدة بالجنيه</span>
            </div>
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2 text-center w-8">#</th>
                    <th className="p-2">اسم الصنف</th>
                    <th className="p-2 text-center">الكمية</th>
                    <th className="p-2 text-center">السعر</th>
                    <th className="p-2 text-center">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(inv.items || []).map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-2">
                        <b className="text-slate-900 block">{it.name}</b>
                        {it.term && <span className="text-[10px] text-slate-500 font-semibold">الترم: {it.term}</span>}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-slate-900">{it.qty}</td>
                      <td className="p-2 text-center font-mono text-slate-700">
                        {it.originalPrice && it.originalPrice !== it.price ? (
                          <span>
                            <s className="text-rose-400 mr-1">{fmt(it.originalPrice)}</s>
                            <b className="text-emerald-700">{fmt(it.price)}</b>
                          </span>
                        ) : (
                          fmt(it.price)
                        )}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-amber-700">
                        {fmt(it.qty * it.price)} ج
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Calculation Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-700">
              <span>إجمالي الأصناف الأساسي:</span>
              <span className="font-mono font-bold text-slate-900">{fmt(inv.originalSubtotal ?? inv.subtotal ?? inv.total)} ج</span>
            </div>

            {(inv.discount || 0) > 0 && (
              <div className="flex items-center justify-between text-xs text-rose-700">
                <span>إجمالي الخصم الممنوح:</span>
                <span className="font-mono font-bold">- {fmt(inv.discount)} ج</span>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm sm:text-base font-black">
              <span className="text-slate-900">صافي الفاتورة النهائي:</span>
              <span className="font-mono text-emerald-700 text-lg sm:text-xl">{fmt(inv.total)} ج</span>
            </div>

            <div className="flex flex-wrap items-center justify-between text-xs pt-1 border-t border-slate-200 text-slate-600">
              <span>المدفوع: <b className="text-slate-900 font-mono">{fmt(inv.paidAmount ?? inv.total)} ج</b></span>
              <span>المتبقي (آجل): <b className={(inv.dueAmount || 0) > 0 ? 'text-rose-700 font-mono' : 'text-emerald-700 font-mono'}>{fmt(inv.dueAmount || 0)} ج</b></span>
            </div>
          </div>
        </div>

        {/* Modal Actions Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Direct PDF Download Button */}
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className={`flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer ${
                isDownloadingPdf
                  ? 'bg-slate-400 text-white cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
              }`}
              title="تنزيل ملف PDF حقيقي للفاتورة مباشرة على جهازك"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري التنزيل...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  تنزيل ملف PDF
                </>
              )}
            </button>

            {/* Share PDF file */}
            <button
              onClick={handleSharePdf}
              disabled={isSharingPdf}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="إرسال ملف الـ PDF كملف مستند للعميل عبر الواتساب أو التطبيقات"
            >
              {isSharingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري التجهيز...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  إرسال ملف PDF
                </>
              )}
            </button>

            {/* A4 Print Modal Button */}
            <button
              onClick={handlePrintA4}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="معاينة وطباعة مقاس A4"
            >
              <Printer className="w-4 h-4" />
              معاينة وطباعة A4
            </button>

            {/* Thermal Receipt Print */}
            <button
              onClick={handlePrintThermal}
              className="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              title="طباعة إيصال حراري للكاشير"
            >
              <Receipt className="w-4 h-4" />
              إيصال كاشير
            </button>

            {/* WhatsApp Text */}
            <button
              onClick={handleWhatsAppText}
              className="px-2.5 py-2.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-slate-200 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
              title="إرسال نص الفاتورة السريع عبر الواتساب"
            >
              <Share2 className="w-3.5 h-3.5" />
              نص واتساب
            </button>

            {/* Copy Text */}
            <button
              onClick={handleCopyText}
              className="px-2.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-200"
              title="نسخ نص الفاتورة للحافظة"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
            {/* Clone / Re-order to Cart */}
            <button
              onClick={() => reorderInvoiceToCart(inv)}
              className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              title="تحميل أصناف هذه الفاتورة في سلة المبيعات لتكرارها أو تعديلها"
            >
              <ShoppingCart className="w-4 h-4 text-emerald-700" />
              تكرار في السلة
            </button>

            {/* Sales Return */}
            {inv.status !== 'refunded' && (
              <button
                onClick={handleStartReturn}
                className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                title="إنشاء مرتجع أو تبديل على بنود هذه الفاتورة"
              >
                <RotateCcw className="w-4 h-4" />
                عمل مرتجع
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
