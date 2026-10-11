import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cleanPhoneForWhatsapp } from './utils';

export interface ExportPdfOptions {
  element?: HTMLElement;
  html?: string;
  filename: string;
  isThermal?: boolean;
}

export interface SharePdfOptions extends ExportPdfOptions {
  title?: string;
  phone?: string;
  textMessage?: string;
}

/**
 * Preload all images inside an element to ensure html2canvas captures them completely
 */
async function preloadImages(container: HTMLElement): Promise<void> {
  const images = Array.from(container.querySelectorAll('img'));
  if (images.length === 0) return;

  const loadPromises = images.map(img => {
    if (img.complete && img.naturalWidth !== 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve(); // continue even if an image fails
      // timeout safeguard after 1.5s
      setTimeout(resolve, 1500);
    });
  });

  await Promise.all(loadPromises);
}

/**
 * Creates a high-resolution canvas from an HTMLElement or HTML string
 */
async function captureToCanvas(elementOrHtml: HTMLElement | string, isThermal = false): Promise<HTMLCanvasElement> {
  let containerToClean: HTMLElement | null = null;
  let targetElement: HTMLElement;

  if (typeof elementOrHtml === 'string') {
    // Render in an isolated off-screen wrapper with explicit dimensions & styles
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = isThermal ? '360px' : '820px';
    wrapper.style.minHeight = '100px';
    wrapper.style.background = '#ffffff';
    wrapper.style.color = '#000000';
    wrapper.style.zIndex = '-99999';
    wrapper.style.direction = 'rtl';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.padding = isThermal ? '8px' : '20px';
    wrapper.innerHTML = elementOrHtml;
    document.body.appendChild(wrapper);
    containerToClean = wrapper;
    targetElement = wrapper;
  } else {
    // If an HTMLElement was passed, clone its HTML into the clean off-screen wrapper
    // to avoid parent modal flex/scroll/overflow conflicts
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = isThermal ? '360px' : '820px';
    wrapper.style.minHeight = '100px';
    wrapper.style.background = '#ffffff';
    wrapper.style.color = '#000000';
    wrapper.style.zIndex = '-99999';
    wrapper.style.direction = 'rtl';
    wrapper.style.boxSizing = 'border-box';
    wrapper.style.padding = isThermal ? '8px' : '20px';
    wrapper.innerHTML = elementOrHtml.innerHTML;
    document.body.appendChild(wrapper);
    containerToClean = wrapper;
    targetElement = wrapper;
  }

  try {
    // 1. Wait for document fonts
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (_e) {
        // Ignore font load errors
      }
    }

    // 2. Preload any images inside target (e.g. logos)
    await preloadImages(targetElement);

    // 3. Small delay for reflow
    await new Promise(res => setTimeout(res, 80));

    const canvas = await html2canvas(targetElement, {
      scale: 2.5, // 2.5x crisp DPI
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      windowWidth: isThermal ? 420 : 920,
    });

    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      throw new Error('فشل التقاط محتوى الفاتورة لإنشاء ملف PDF');
    }

    return canvas;
  } finally {
    if (containerToClean && containerToClean.parentNode) {
      containerToClean.parentNode.removeChild(containerToClean);
    }
  }
}

/**
 * Converts canvas to a jsPDF instance
 */
function canvasToPdf(canvas: HTMLCanvasElement, isThermal = false): jsPDF {
  const imgData = canvas.toDataURL('image/jpeg', 0.96);

  if (isThermal) {
    // 80mm thermal receipt format
    const pdfWidth = 80; // mm
    const pdfHeight = Math.max((canvas.height * pdfWidth) / canvas.width, 50);

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pdfWidth, pdfHeight],
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
    return pdf;
  } else {
    // Standard A4 format
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const margin = 6; // 6mm margin
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    let heightLeft = contentHeight;
    let position = margin;
    let page = 1;

    // First page
    pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
    heightLeft -= (pageHeight - margin * 2);

    // Multi-page handling if invoice is extra long
    while (heightLeft > 0) {
      position = -(pageHeight - margin * 2) * page + margin;
      pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData, 'JPEG', margin, position, contentWidth, contentHeight, undefined, 'FAST');
      heightLeft -= (pageHeight - margin * 2);
      page++;
    }

    return pdf;
  }
}

/**
 * Direct file download helper using Blob and temporary link
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    if (a.parentNode) a.parentNode.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 1500);
}

/**
 * Generates a valid PDF Blob
 */
export async function generatePdfBlob(
  options: ExportPdfOptions
): Promise<{ blob: Blob; filename: string; pdf: jsPDF }> {
  const source = options.html || options.element;
  if (!source) {
    throw new Error('لم يتم توفير محتوى الفاتورة لإنشاء ملف PDF');
  }

  const cleanFilename = (options.filename || 'فاتورة')
    .replace(/\.pdf$/i, '')
    .replace(/[\\/:*?"<>|]/g, '_') + '.pdf';

  const canvas = await captureToCanvas(source, options.isThermal);
  const pdf = canvasToPdf(canvas, options.isThermal);
  const blob = pdf.output('blob');

  return { blob, filename: cleanFilename, pdf };
}

/**
 * Generates and downloads a crystal-clear PDF file to the user's device
 */
export async function exportElementToPdf(options: ExportPdfOptions): Promise<void> {
  const { blob, filename } = await generatePdfBlob(options);
  triggerBlobDownload(blob, filename);
}

export type SharePdfResult = 'shared_mobile' | 'downloaded_and_whatsapp' | 'downloaded';

/**
 * Multi-Platform PDF Sender:
 * 1. Mobile (Android/iOS): Opens native system share sheet (WhatsApp, AirDrop, etc.) with the actual PDF file.
 * 2. PC / Desktop: Downloads the PDF file to the device AND opens WhatsApp Web chat with the customer ready to attach.
 */
export async function sharePdfFile(options: SharePdfOptions): Promise<{
  action: SharePdfResult;
  filename: string;
}> {
  const { blob, filename } = await generatePdfBlob(options);
  const cleanTitle = (options.title || options.filename || 'فاتورة').replace(/\.pdf$/i, '');
  const file = new File([blob], filename, { type: 'application/pdf' });

  // 1. Mobile Web Share API
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: cleanTitle,
        text: `مرفق ملف PDF: ${cleanTitle}`,
        files: [file],
      });
      return { action: 'shared_mobile', filename };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { action: 'shared_mobile', filename }; // User cancelled share dialog
      }
      // If native share fails, fallback to download + WhatsApp
    }
  }

  // 2. PC / Desktop Fallback: Always download the PDF file to Downloads folder
  triggerBlobDownload(blob, filename);

  // If customer phone is available, also launch WhatsApp chat with greeting / summary
  const phone = options.phone?.trim();
  if (phone) {
    const cleanPhone = cleanPhoneForWhatsapp(phone);
    const textMsg =
      options.textMessage ||
      `السلام عليكم ورحمة الله وبركاته، مرفق لسيادتكم ملف ${cleanTitle} من مكتبة فكرة. شكراً لتعاملكم معنا!`;
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(textMsg)}`
      : `https://wa.me/?text=${encodeURIComponent(textMsg)}`;

    try {
      window.open(waUrl, '_blank');
      return { action: 'downloaded_and_whatsapp', filename };
    } catch (_e) {
      return { action: 'downloaded', filename };
    }
  }

  return { action: 'downloaded', filename };
}

