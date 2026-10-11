import { SHOP_NAME } from './constants';
import { fmt } from './utils';

export interface BarcodeLabelOptions {
  productName: string;
  barcode: string;
  price: number;
  category?: string;
  copies?: number;
  labelSize?: '38x25' | '50x25' | '50x30' | 'a4_grid';
  showShopName?: boolean;
}

/**
 * Generates an HTML printable string for Thermal Barcode Label Printers (e.g. Xprinter, Zebra, Rongta)
 * Supports standard label sizes (38x25mm, 50x25mm, 50x30mm) and A4 Sticker Sheets.
 */
export function generateBarcodeLabelHtml(options: BarcodeLabelOptions): string {
  const {
    productName,
    barcode,
    price,
    copies = 1,
    labelSize = '38x25',
    showShopName = true
  } = options;

  // Generate SVG Code128-like barcode visualization or standard pattern
  const generateBarcodeSvg = (code: string) => {
    if (!code) return '';
    // Generate clean barcode bars pattern based on characters
    const bars: number[] = [];
    for (let i = 0; i < code.length; i++) {
      const charCode = code.charCodeAt(i);
      bars.push((charCode % 3) + 1, (charCode % 2) + 1, (charCode % 4) + 1);
    }
    // Repeat to ensure standard width
    const totalBars = bars.length < 30 ? [...bars, ...bars, ...bars].slice(0, 45) : bars.slice(0, 45);
    
    let svgBars = '';
    let x = 4;
    totalBars.forEach((w, idx) => {
      if (idx % 2 === 0) {
        svgBars += `<rect x="${x}" y="0" width="${w * 1.5}" height="28" fill="#000" />`;
      }
      x += (w * 1.5) + 1.2;
    });

    return `
      <svg viewBox="0 0 ${Math.max(120, x + 4)} 28" class="barcode-svg" preserveAspectRatio="none" style="width: 85%; height: 26px; display: block; margin: 0 auto;">
        ${svgBars}
      </svg>
    `;
  };

  const barcodeSvg = generateBarcodeSvg(barcode || '1001001');

  // Dimensions based on label type
  let pageCss = '';
  let labelContainerCss = '';

  if (labelSize === '38x25') {
    pageCss = `@page { size: 38mm 25mm; margin: 0; } body { width: 38mm; margin: 0; }`;
    labelContainerCss = `width: 38mm; height: 25mm; max-height: 25mm; padding: 1.5mm; box-sizing: border-box; page-break-after: always;`;
  } else if (labelSize === '50x25') {
    pageCss = `@page { size: 50mm 25mm; margin: 0; } body { width: 50mm; margin: 0; }`;
    labelContainerCss = `width: 50mm; height: 25mm; max-height: 25mm; padding: 1.5mm; box-sizing: border-box; page-break-after: always;`;
  } else if (labelSize === '50x30') {
    pageCss = `@page { size: 50mm 30mm; margin: 0; } body { width: 50mm; margin: 0; }`;
    labelContainerCss = `width: 50mm; height: 30mm; max-height: 30mm; padding: 2mm; box-sizing: border-box; page-break-after: always;`;
  } else {
    // A4 grid of labels (e.g. 40 labels per A4 sheet)
    pageCss = `@page { size: A4; margin: 10mm; } body { width: 100%; margin: 0; }`;
    labelContainerCss = `width: 48mm; height: 28mm; border: 1px dashed #ccc; padding: 2mm; box-sizing: border-box; margin: 1mm; float: right; border-radius: 4px;`;
  }

  // Generate label items for copies
  let labelsHtml = '';
  for (let i = 0; i < copies; i++) {
    labelsHtml += `
      <div class="label-box" style="${labelContainerCss} text-align: center; font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; direction: rtl; display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; background: #fff; color: #000;">
        ${showShopName ? `<div style="font-size: 8.5px; font-weight: bold; color: #333; line-height: 1; border-bottom: 0.5px solid #ddd; padding-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${SHOP_NAME}</div>` : ''}
        
        <div style="font-size: 9.5px; font-weight: 700; color: #000; line-height: 1.15; max-height: 22px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; margin-top: 1px;">
          ${productName}
        </div>

        <div style="margin: 1px 0; display: flex; flex-direction: column; align-items: center;">
          ${barcodeSvg}
          <div style="font-size: 8px; font-family: monospace; font-weight: bold; letter-spacing: 1px; color: #111; line-height: 1; margin-top: 1px;">
            ${barcode || 'بدون باركود'}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid #000; padding-top: 1px; margin-top: 1px;">
          <span style="font-size: 7.5px; font-weight: bold; color: #444;">السعر:</span>
          <span style="font-size: 13px; font-weight: 900; font-family: monospace; color: #000; direction: ltr;">
            ${fmt(price)} <span style="font-size: 8px; font-weight: bold; font-family: 'Cairo', sans-serif;">ج.م</span>
          </span>
        </div>
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>طباعة باركود - ${productName}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background-color: #fff;
          color: #000;
          font-family: 'Cairo', sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        ${pageCss}
        @media print {
          body { background: transparent; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div style="${labelSize === 'a4_grid' ? 'display: flex; flex-wrap: wrap; justify-content: flex-start;' : ''}">
        ${labelsHtml}
      </div>
    </body>
    </html>
  `;
}
