import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Printer, Send, X, Download, Loader2, CheckCircle2, Copy, Share2, Sparkles } from 'lucide-react';
import { cleanPhoneForWhatsapp } from '../lib/utils';
import { exportElementToPdf, sharePdfFile } from '../lib/pdfExporter';

export const PrintModal: React.FC = () => {
  const { printModalData, closePrintModal, toast } = useApp();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [customPhone, setCustomPhone] = useState('');
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const printBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (printModalData) {
      setCustomPhone(printModalData.phone || '');
      setShowPhoneInput(!printModalData.phone);
    }
  }, [printModalData]);

  // Dynamically synchronize document.title so browser's Save-as-PDF uses invoice filename
  useEffect(() => {
    if (!printModalData) return;

    const originalTitle = document.title;
    const targetName = (printModalData.filename || 'فاتورة')
      .replace(/\.pdf$/i, '')
      .replace(/[\\/:*?"<>|]/g, '_');

    document.title = targetName;

    return () => {
      document.title = originalTitle;
    };
  }, [printModalData]);

  if (!printModalData) return null;

  const { bodyHtml, filename, waMessage } = printModalData;
  const activePhone = customPhone.trim() || printModalData.phone || '';
  const cleanPhone = activePhone ? cleanPhoneForWhatsapp(activePhone) : '';
  const cleanTitle = (filename || 'فاتورة').replace(/\.pdf$/i, '');
  const isThermal = filename?.includes('إيصال') || bodyHtml.includes('receipt-container');

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = cleanTitle;
    try {
      window.print();
    } catch (_e) {
      toast('تعذر فتح نافذة الطباعة');
    }
  };

  const handleDirectDownloadPDF = async () => {
    if (isExportingPdf) return;

    try {
      setIsExportingPdf(true);
      toast('⏳ جاري إنشاء وتحميل ملف PDF الفاتورة...');

      await exportElementToPdf({
        html: bodyHtml,
        element: printBodyRef.current || undefined,
        filename: `${cleanTitle}.pdf`,
        isThermal,
      });

      toast(`✅ تم تنزيل ملف (${cleanTitle}.pdf) بنجاح في مجلد التنزيلات`);
    } catch (err: any) {
      console.error('PDF Export Error:', err);
      toast('❌ حدث خطأ أثناء إنشاء ملف PDF، يرجى المحاولة مرة أخرى');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleSharePdfFile = async () => {
    if (isSharingPdf) return;

    try {
      setIsSharingPdf(true);
      toast('⏳ جاري تجهيز ملف PDF لإرساله للعميل...');

      const result = await sharePdfFile({
        html: bodyHtml,
        element: printBodyRef.current || undefined,
        filename: `${cleanTitle}.pdf`,
        isThermal,
        title: cleanTitle,
        phone: activePhone,
        textMessage: waMessage || `السلام عليكم، مرفق لسيادتكم ${cleanTitle} من مكتبة فكرة.`,
      });

      if (result.action === 'shared_mobile') {
        toast('✅ تم فتح نافذة مشاركة ملف PDF بنجاح');
      } else if (result.action === 'downloaded_and_whatsapp') {
        toast('✅ تم تنزيل ملف الـ PDF وفتح محادثة الواتساب. يمكنك سحب الملف المُنزل أو إرفاقه 📎 لإرساله للعميل فوراً');
      } else {
        toast(`✅ تم تنزيل ملف (${cleanTitle}.pdf) بنجاح على جهازك`);
      }
    } catch (err: any) {
      console.error('PDF Share Error:', err);
      toast('⚠️ تعذر إرسال الملف، جاري التنزيل المباشر...');
      handleDirectDownloadPDF();
    } finally {
      setIsSharingPdf(false);
    }
  };

  const handleWhatsapp = () => {
    if (!cleanPhone) {
      setShowPhoneInput(true);
      toast('يرجى كتابة رقم هاتف العميل أولاً لإرسال الواتساب');
      return;
    }
    const link = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMessage || '')}`;
    window.open(link, '_blank');
  };

  const handleCopyMessage = () => {
    if (!waMessage) return;
    navigator.clipboard.writeText(waMessage);
    toast('✅ تم نسخ نص الإيصال للحافظة');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Action Bar (strictly hidden in @media print) */}
      <div className="p-3 bg-[#F6F1E7] border-b border-[#D8CBB0] flex flex-wrap items-center justify-between gap-2 shadow-xs no-print">
        <div className="flex items-center flex-wrap gap-2">
          {/* Direct PDF Download Button */}
          <button
            onClick={handleDirectDownloadPDF}
            disabled={isExportingPdf}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer ${
              isExportingPdf
                ? 'bg-[#8E98A6] text-white cursor-not-allowed'
                : 'bg-[#5C7A5E] hover:bg-[#4c684e] text-white'
            }`}
            title={`تنزيل ملف PDF حقيقي باسم: ${cleanTitle}.pdf`}
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري إنشاء PDF...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                📥 تنزيل ملف PDF مباشر
              </>
            )}
          </button>

          {/* Share PDF File (WhatsApp / Mobile Share Sheet) */}
          <button
            onClick={handleSharePdfFile}
            disabled={isSharingPdf}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
            title="مشاركة ملف الـ PDF كملف مستند عبر الواتساب أو التطبيقات"
          >
            {isSharingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري تجهيز الملف...
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                📲 إرسال ملف PDF
              </>
            )}
          </button>

          {/* Physical Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة ورقية
          </button>

          {/* WhatsApp Text Send */}
          <button
            onClick={handleWhatsapp}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] text-[#1F2A3C] border border-[#D8CBB0] font-bold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer"
            title="إرسال ملخص الفاتورة كنص سريع في الواتساب"
          >
            <Send className="w-3.5 h-3.5 text-[#25D366]" />
            إرسال نص واتساب
          </button>

          {waMessage && (
            <button
              onClick={handleCopyMessage}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-white hover:bg-[#FAF6EE] text-[#3A4A63] border border-[#D8CBB0] font-semibold text-xs transition-colors cursor-pointer"
              title="نسخ نص الإيصال الرقمي"
            >
              <Copy className="w-3.5 h-3.5 text-[#8E98A6]" />
              نسخ النص
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Phone Input */}
          <div className="flex items-center gap-1.5 bg-white border border-[#D8CBB0] rounded-xl px-2.5 py-1">
            <span className="text-[11px] text-[#8E98A6] hidden md:inline">هاتف العميل:</span>
            <input
              type="tel"
              placeholder="010XXXXXXXX"
              value={customPhone}
              onChange={(e) => setCustomPhone(e.target.value)}
              className="text-xs font-mono font-bold w-28 md:w-32 bg-transparent outline-none text-[#1F2A3C]"
            />
          </div>

          <span className="text-xs font-bold text-[#A9762F] bg-[#FFFDF8] px-2.5 py-1.5 rounded-xl border border-[#D8CBB0] hidden lg:inline-block">
            📄 {cleanTitle}.pdf
          </span>
          <button
            onClick={closePrintModal}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-[#EFE7D6] hover:bg-[#e4d9bd] text-[#1F2A3C] font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
            إغلاق
          </button>
        </div>
      </div>

      {/* Hint bar (hidden in print) */}
      <div className="px-4 py-1.5 bg-[#FAF6EE] border-b border-[#D8CBB0] text-[11px] text-[#64748B] flex flex-wrap items-center justify-between no-print gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-[#5C7A5E]" />
          <span>
            اضغط <b>«📥 تنزيل ملف PDF مباشر»</b> لحفظ ملف الفاتورة على جهازك، أو <b>«📲 إرسال ملف PDF»</b> لإرساله كملف مستند للعميل.
          </span>
        </div>
        {cleanPhone ? (
          <span className="text-[#25D366] font-bold">📲 رقم الواتساب: {activePhone}</span>
        ) : (
          <span className="text-[#A8503A]">💡 اكتب رقم العميل في خانة الهاتف بالأعلى لإرسال الواتساب فوراً</span>
        )}
      </div>

      {/* Printable Body */}
      <div
        id="printModalBody"
        ref={printBodyRef}
        className="flex-1 overflow-auto p-4 md:p-8 font-sans text-right printable-content bg-[#F8FAFC]"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </div>
  );
};
