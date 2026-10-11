import { SHOP_NAME, SHOP_ADDRESS, SHOP_PHONES } from './constants';
import { fmt, todayStr, formatTimeEn, formatDateEn } from './utils';
import { getShopSettings } from './settings';

export interface InvoicePrintOptions {
  invoice: any;
  customer?: any;
  cashierName?: string;
}

// Convert numbers to Arabic words (Tafqeet helper)
export function tafqeetArabic(n: number): string {
  const num = Math.round(n * 100) / 100;
  const whole = Math.floor(num);
  const fraction = Math.round((num - whole) * 100);

  if (whole === 0 && fraction === 0) return 'صفر جنيه مصري فقط لا غير';

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const thousands = ['', 'ألف', 'ألفان', 'آلاف', 'ألفاً'];

  function convertGroup(val: number): string {
    let res = '';
    const h = Math.floor(val / 100);
    const rem = val % 100;
    if (h > 0) res += hundreds[h];
    if (rem > 0) {
      if (res) res += ' و ';
      if (rem < 20) {
        res += ones[rem];
      } else {
        const o = rem % 10;
        const t = Math.floor(rem / 10);
        if (o > 0) res += ones[o] + ' و ';
        res += tens[t];
      }
    }
    return res;
  }

  let wholeStr = '';
  if (whole >= 1000000) {
    const mill = Math.floor(whole / 1000000);
    wholeStr += convertGroup(mill) + ' مليون ';
  }
  const thPart = Math.floor((whole % 1000000) / 1000);
  if (thPart > 0) {
    if (wholeStr) wholeStr += ' و ';
    if (thPart === 1) wholeStr += 'ألف';
    else if (thPart === 2) wholeStr += 'ألفان';
    else if (thPart >= 3 && thPart <= 10) wholeStr += convertGroup(thPart) + ' آلاف';
    else wholeStr += convertGroup(thPart) + ' ألفاً';
  }
  const remPart = whole % 1000;
  if (remPart > 0) {
    if (wholeStr) wholeStr += ' و ';
    wholeStr += convertGroup(remPart);
  }
  if (!wholeStr) wholeStr = 'صفر';

  let result = `فقط ${wholeStr} جنيه مصري`;
  if (fraction > 0) {
    result += ` و ${fraction} قرشاً`;
  }
  result += ' لا غير';
  return result;
}

/**
 * Generate Luxury A4 / A5 Sale Invoice HTML
 */
export function generateA4SaleInvoiceHtml(options: InvoicePrintOptions): string {
  const settings = getShopSettings();
  const shopName = settings.shopName || SHOP_NAME || 'مكتبة فكرة';
  const shopSlogan = settings.slogan || 'للأدوات المكتبية والمدرسية والخدمات الطلابية والتصوير';
  const shopAddress = settings.address || SHOP_ADDRESS || 'نادي الياسمين واحد — مدينة المستقبل';
  const shopPhones = settings.phones || SHOP_PHONES || 'تليفون وواتس: 01001515297 / 01002226173';
  const { invoice: inv, cashierName = 'المدير المسؤول' } = options;
  const originalSubtotal = Number(inv.originalSubtotal ?? inv.subtotal ?? inv.total) || 0;
  const subtotalAfterCat = Number(inv.subtotal ?? inv.total) || 0;
  const categoryDiscounts: Record<string, number> = inv.categoryDiscounts || {};
  const totalCatDiscount = Object.values(categoryDiscounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const generalDiscount = Number(inv.discount) || 0;
  const usedPoints = Number(inv.usedPoints) || 0;
  const totalSavings = totalCatDiscount + generalDiscount + usedPoints;
  const netTotal = Number(inv.total) || 0;
  const paidAmount = Number(inv.paidAmount ?? inv.total) || 0;
  const dueAmount = Number(inv.dueAmount ?? (inv.paymentMethod === 'credit' ? netTotal - paidAmount : 0)) || 0;
  const changeAmount = Number(inv.changeAmount ?? (inv.paymentMethod === 'cash' ? Math.max(0, paidAmount - netTotal) : 0)) || 0;

  // Payment method label
  const payLabels: Record<string, string> = {
    cash: 'نقداً (كاش)',
    card: 'بطاقة بنكية / فيزا',
    vodafone_cash: 'فودافون كاش / محفظة إلكترونية',
    credit: 'آجل (على الحساب)'
  };

  const paymentMethodLabel = payLabels[inv.paymentMethod] || 'نقداً';

  // Customer Info
  const custName = inv.customerName?.trim() || 'عميل نقدي / مبيعات صالة';
  const custPhone = inv.customerPhone?.trim() || '—';
  const custAddress = inv.customerAddress?.trim() || '—';
  const custCode = inv.customerCode || (inv.customerId ? `#${inv.customerId.slice(-6).toUpperCase()}` : 'عميل نقدي');

  // Customer Balances & Points
  const prevBal = inv.previousBalance !== undefined ? Number(inv.previousBalance) : null;
  const newBal = inv.newBalance !== undefined ? Number(inv.newBalance) : (prevBal !== null ? prevBal + dueAmount : null);
  const prevPoints = inv.previousPoints !== undefined ? Number(inv.previousPoints) : null;
  const earnedPoints = Number(inv.earnedPoints) || 0;
  const newPoints = inv.newPoints !== undefined ? Number(inv.newPoints) : (prevPoints !== null ? prevPoints - usedPoints + earnedPoints : null);

  const tafqeetText = tafqeetArabic(netTotal);

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>فاتورة_رقم_${inv.number}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Arabic', 'Cairo', Tahoma, Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #FFFFFF;
      color: #0F172A;
      font-size: 13px;
      line-height: 1.5;
      direction: rtl;
      -webkit-font-smoothing: antialiased;
    }
    .invoice-container {
      max-width: 800px;
      margin: 0 auto;
      border: 1.5px solid #CBD5E1;
      border-radius: 12px;
      padding: 24px 28px;
      background: #FFFFFF;
    }
    /* Header Branding */
    .inv-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #B45309;
      padding-bottom: 16px;
      margin-bottom: 18px;
    }
    .shop-brand {
      flex: 1;
    }
    .shop-name {
      font-size: 26px;
      font-weight: 900;
      color: #92400E;
      margin: 0 0 4px;
      letter-spacing: -0.5px;
    }
    .shop-slogan {
      font-size: 12px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 4px;
    }
    .shop-meta {
      font-size: 11px;
      color: #64748B;
    }
    .inv-badge-card {
      text-align: left;
      background: #FEF3C7;
      border: 1px solid #FDE68A;
      border-radius: 10px;
      padding: 10px 16px;
      min-width: 220px;
    }
    .inv-type-title {
      font-size: 15px;
      font-weight: 800;
      color: #92400E;
      margin: 0 0 4px;
    }
    .inv-number {
      font-size: 18px;
      font-weight: 900;
      font-family: 'Segoe UI', Roboto, -apple-system, Arial, sans-serif;
      font-variant-numeric: tabular-nums;
      color: #0F172A;
      margin: 0 0 4px;
    }
    .inv-date {
      font-size: 11.5px;
      color: #475569;
    }

    /* Customer Info Box */
    .customer-panel {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 18px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px 20px;
      font-size: 12px;
    }
    .cust-field {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .cust-label {
      color: #64748B;
      font-weight: 600;
      min-width: 75px;
    }
    .cust-val {
      color: #0F172A;
      font-weight: 700;
    }
    .cust-badge {
      display: inline-block;
      padding: 2px 8px;
      background: #E2E8F0;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #334155;
    }

    /* Items Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
      font-size: 12.5px;
    }
    .items-table th {
      background: #F1F5F9;
      color: #0F172A;
      font-weight: 800;
      padding: 9px 8px;
      border: 1.5px solid #CBD5E1;
      text-align: center;
    }
    .items-table th.col-desc {
      text-align: right !important;
    }
    .items-table td {
      padding: 8px 8px;
      border: 1px solid #CBD5E1;
      vertical-align: middle;
    }
    .items-table tbody tr:nth-child(even) {
      background: #FAFAFA;
    }
    .col-center { text-align: center !important; }
    .col-desc { text-align: right !important; }
    .col-num {
      text-align: center !important;
      font-family: 'Segoe UI', Roboto, -apple-system, Arial, sans-serif;
      font-variant-numeric: tabular-nums;
      font-weight: 800;
    }
    .price-orig {
      font-family: 'Segoe UI', Roboto, -apple-system, Arial, sans-serif;
      font-variant-numeric: tabular-nums;
      font-weight: 800;
      font-size: 13px;
      color: #334155;
      text-align: center !important;
    }
    .price-after {
      font-family: 'Segoe UI', Roboto, -apple-system, Arial, sans-serif;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
      font-size: 13.5px;
      color: #0F172A;
      text-align: center !important;
    }
    .price-total {
      font-family: 'Segoe UI', Roboto, -apple-system, Arial, sans-serif;
      font-variant-numeric: tabular-nums;
      font-weight: 900;
      font-size: 14px;
      color: #92400E;
      text-align: center !important;
    }
    .orig-price-crossed {
      text-decoration: line-through;
      color: #94A3B8;
      font-size: 11.5px;
      display: block;
    }
    .disc-tag {
      display: inline-block;
      padding: 1.5px 6px;
      background: #FEE2E2;
      color: #B91C1C;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
      font-family: 'Segoe UI', Roboto, -apple-system, Arial, sans-serif;
      font-variant-numeric: tabular-nums;
    }

    /* Summary & Totals Layout */
    .summary-grid {
      display: grid;
      grid-template-columns: 1.1fr 1fr;
      gap: 16px;
      margin-bottom: 18px;
      align-items: start;
    }
    .discounts-card {
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 11.5px;
    }
    .discounts-card h4 {
      margin: 0 0 8px;
      font-size: 12.5px;
      font-weight: 800;
      color: #92400E;
      border-bottom: 1px dashed #FCD34D;
      padding-bottom: 4px;
    }
    .disc-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      color: #78350F;
    }
    .totals-card {
      background: #F8FAFC;
      border: 1.5px solid #CBD5E1;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 12px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      color: #334155;
    }
    .grand-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0 4px;
      margin-top: 6px;
      border-top: 2px solid #B45309;
      font-size: 16px;
      font-weight: 900;
      color: #92400E;
    }
    .tafqeet-box {
      background: #F1F5F9;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 11.5px;
      font-weight: 700;
      color: #1E293B;
      margin-top: 8px;
      text-align: center;
    }

    /* Footer & Terms */
    .inv-footer {
      border-top: 1.5px dashed #CBD5E1;
      padding-top: 14px;
      font-size: 11px;
      color: #64748B;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .terms-text {
      max-width: 480px;
      line-height: 1.6;
    }
    .signature-area {
      text-align: center;
      min-width: 140px;
    }
    .sig-line {
      margin-top: 25px;
      border-top: 1px solid #94A3B8;
      padding-top: 4px;
      font-weight: 700;
      color: #334155;
    }
  </style>
</head>
<body>
  <div class="invoice-container">
    <!-- Header -->
    <div class="inv-header">
      <div class="shop-brand" style="display:flex;align-items:center;gap:16px;">
        ${settings.showLogoOnA4 && settings.logoUrl ? `
          <div style="flex-shrink:0;">
            <img src="${settings.logoUrl}" alt="${shopName}" style="max-height:75px;max-width:140px;object-fit:contain;border-radius:6px;" />
          </div>
        ` : ''}
        <div>
          <h1 class="shop-name">${shopName}</h1>
          <div class="shop-slogan">${shopSlogan}</div>
          <div class="shop-meta">📍 ${shopAddress}</div>
          <div class="shop-meta">📞 ${shopPhones}</div>
          ${settings.taxNumber || settings.commercialReg ? `
            <div class="shop-meta" style="font-weight:700;margin-top:2px;">
              ${settings.taxNumber ? `<span>ضريبي: ${settings.taxNumber}</span>` : ''}
              ${settings.taxNumber && settings.commercialReg ? ' • ' : ''}
              ${settings.commercialReg ? `<span>س.ت: ${settings.commercialReg}</span>` : ''}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="inv-badge-card">
        <div class="inv-type-title">${settings.a4HeaderNote || 'فاتورة مبيعات نقدية'}</div>
        <div class="inv-number">رقم #${inv.number}</div>
        <div class="inv-date">📅 التاريخ: ${inv.date}</div>
        <div class="inv-date">👤 الكاشير: ${cashierName}</div>
      </div>
    </div>

    <!-- Customer Details -->
    <div class="customer-panel">
      <div class="cust-field">
        <span class="cust-label">👤 اسم العميل:</span>
        <span class="cust-val">${custName}</span>
      </div>
      <div class="cust-field">
        <span class="cust-label">📞 رقم الهاتف:</span>
        <span class="cust-val">${custPhone}</span>
      </div>
      <div class="cust-field">
        <span class="cust-label">🏢 العنوان:</span>
        <span class="cust-val">${custAddress}</span>
      </div>
      <div class="cust-field">
        <span class="cust-label">💳 طريقة الدفع:</span>
        <span class="cust-badge">${paymentMethodLabel}</span>
      </div>

      ${(prevBal !== null && prevBal > 0) || dueAmount > 0 ? `
        <div class="cust-field">
          <span class="cust-label">📋 كشف الرصيد:</span>
          <span class="cust-val">
            ${prevBal !== null ? `سابق: ${fmt(prevBal)} ج • ` : ''}
            الحالي: ${fmt(netTotal)} ج • 
            <b>المتبقي: ${fmt(newBal ?? dueAmount)} ج</b>
          </span>
        </div>
      ` : ''}

      ${earnedPoints > 0 || (prevPoints !== null && prevPoints > 0) ? `
        <div class="cust-field">
          <span class="cust-label">⭐ نقاط الولاء:</span>
          <span class="cust-val text-[#B45309]">
            ${prevPoints !== null ? `السابق: ${prevPoints} • ` : ''}
            مكتسبة: +${earnedPoints} • 
            <b>الرصيد الجديد: ${newPoints ?? earnedPoints} نقطة</b>
          </span>
        </div>
      ` : ''}
    </div>

    <!-- Items Table -->
    <table class="items-table">
      <thead>
        <tr>
          <th style="width:34px;" class="col-center">#</th>
          <th class="col-desc">بيان الصنف والمواصفات</th>
          <th style="width:60px;" class="col-center">الكمية</th>
          <th style="width:105px;" class="col-center">السعر قبل الخصم</th>
          <th style="width:90px;" class="col-center">قيمة الخصم</th>
          <th style="width:105px;" class="col-center">السعر بعد الخصم</th>
          <th style="width:110px;" class="col-center">الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${(inv.items || []).map((it: any, idx: number) => {
          const orig = Number(it.originalPrice ?? it.price) || 0;
          const actual = Number(it.price) || 0;
          const itemDisc = Math.max(0, orig - actual);
          const hasDisc = itemDisc > 0.001;
          const discPct = orig > 0 ? Math.round((itemDisc / orig) * 100) : 0;
          const rowTotal = (Number(it.qty) || 1) * actual;

          return `
            <tr>
              <td class="col-center">${idx + 1}</td>
              <td class="col-desc">
                <b style="font-size:13px;color:#0F172A;">${it.name}</b>
                ${it.term ? `<span style="color:#64748B;font-size:11px;"> (${it.term})</span>` : ''}
              </td>
              <td class="col-num" style="font-size:13px;">${it.qty}</td>
              <td class="price-orig">
                ${hasDisc ? `<span class="orig-price-crossed">${fmt(orig)}</span>` : `<span>${fmt(orig)}</span>`}
              </td>
              <td class="col-center">
                ${hasDisc ? `<span class="disc-tag">-${fmt(itemDisc)} (${discPct}%)</span>` : '<span style="color:#94A3B8;font-weight:bold;">—</span>'}
              </td>
              <td class="price-after">${fmt(actual)}</td>
              <td class="price-total">${fmt(rowTotal)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <!-- Totals & Category Discounts -->
    <div class="summary-grid">
      <!-- Category Discounts Breakdown -->
      <div class="discounts-card">
        <h4>🏷️ تفصيل الخصومات ووفورات العميل</h4>
        ${Object.keys(categoryDiscounts).length > 0 ? (
          Object.entries(categoryDiscounts).map(([cat, val]) => `
            <div class="disc-row">
              <span>خصم قسم (${cat}):</span>
              <b>-${fmt(val)} ج</b>
            </div>
          `).join('')
        ) : `
          <div class="disc-row" style="color:#64748B;">
            <span>خصم الأصناف / الفئات:</span>
            <span>${totalCatDiscount > 0 ? `-${fmt(totalCatDiscount)} ج` : 'لا يوجد'}</span>
          </div>
        `}

        ${generalDiscount > 0 ? `
          <div class="disc-row" style="border-top:1px dashed #FCD34D;margin-top:4px;padding-top:4px;">
            <span>خصم عام إضافي ${inv.discountType === 'percent' ? `(${inv.discountValue}%)` : ''}:</span>
            <b>-${fmt(generalDiscount)} ج</b>
          </div>
        ` : ''}

        ${usedPoints > 0 ? `
          <div class="disc-row" style="color:#15803D;">
            <span>خصم استبدال نقاط ولاء:</span>
            <b>-${fmt(usedPoints)} ج</b>
          </div>
        ` : ''}

        ${totalSavings > 0 ? `
          <div class="disc-row" style="border-top:1.5px solid #F59E0B;margin-top:6px;padding-top:6px;font-weight:900;color:#92400E;font-size:12px;">
            <span>⭐ إجمالي ما تم توفيره:</span>
            <b>-${fmt(totalSavings)} ج</b>
          </div>
        ` : ''}
      </div>

      <!-- Financial Totals -->
      <div class="totals-card">
        <div class="total-row">
          <span>الإجمالي قبل الخصم:</span>
          <span style="font-family:'Segoe UI', Roboto, -apple-system, Arial, sans-serif;font-variant-numeric:tabular-nums;font-weight:700;">${fmt(originalSubtotal)} ج</span>
        </div>

        ${totalSavings > 0 ? `
          <div class="total-row" style="color:#DC2626;">
            <span>إجمالي الخصومات:</span>
            <span style="font-family:'Segoe UI', Roboto, -apple-system, Arial, sans-serif;font-variant-numeric:tabular-nums;font-weight:700;">-${fmt(totalSavings)} ج</span>
          </div>
        ` : ''}

        <div class="grand-total-row">
          <span>صافي المطلوب:</span>
          <span style="font-family:'Segoe UI', Roboto, -apple-system, Arial, sans-serif;font-variant-numeric:tabular-nums;font-size:19px;font-weight:900;">${fmt(netTotal)} ج</span>
        </div>

        <div class="total-row" style="margin-top:6px;border-top:1px solid #E2E8F0;padding-top:6px;">
          <span>المدفوع:</span>
          <span style="font-family:'Segoe UI', Roboto, -apple-system, Arial, sans-serif;font-variant-numeric:tabular-nums;font-weight:700;">${fmt(paidAmount)} ج</span>
        </div>

        ${dueAmount > 0 ? `
          <div class="total-row" style="color:#DC2626;font-weight:800;">
            <span>المتبقي آجل على الحساب:</span>
            <span style="font-family:'Segoe UI', Roboto, -apple-system, Arial, sans-serif;font-variant-numeric:tabular-nums;font-size:14px;font-weight:800;">${fmt(dueAmount)} ج</span>
          </div>
        ` : ''}

        ${changeAmount > 0 ? `
          <div class="total-row" style="color:#15803D;font-weight:800;">
            <span>الباقي المسترد للعميل:</span>
            <span style="font-family:'Segoe UI', Roboto, -apple-system, Arial, sans-serif;font-variant-numeric:tabular-nums;font-size:14px;font-weight:800;">${fmt(changeAmount)} ج</span>
          </div>
        ` : ''}

        <div class="tafqeet-box">
          ${tafqeetText}
        </div>
      </div>
    </div>

    <!-- Footer & Return Policy -->
    <div class="inv-footer">
      <div class="terms-text">
        <b>شروط الاستبدال والاسترجاع:</b><br>
        ${settings.a4FooterTerms ? settings.a4FooterTerms.replace(/\n/g, '<br>') : `
          • البضاعة المباعة تستبدل أو تسترد خلال 14 يوماً من تاريخ الفاتورة مع إحضار أصل الفاتورة وبحالتها الأصلية.<br>
          • الكتب الخارجية وأوراق التصوير لا تسترد بعد الكتابة عليها أو فك تغليفها الأصلي.<br>
        `}
        ${settings.showBankDetailsOnA4 && settings.bankDetails ? `
          <div style="margin-top:6px;font-weight:700;color:#0F172A;background:#F1F5F9;padding:4px 8px;border-radius:4px;">
            🏦 بيانات التحويل البنكي / المحافظ: ${settings.bankDetails}
          </div>
        ` : ''}
        <div style="font-weight:800;color:#92400E;margin-top:4px;">
          ${settings.thermalFooterNote || 'نسعد دائماً بخدمتكم وتلبية كافة احتياجاتكم المدرسية والمكتبية!'}
        </div>
      </div>
      <div class="signature-area">
        <div class="sig-line">توقيع المستلم / المحاسب</div>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate 80mm / 58mm Thermal POS Receipt HTML
 */
export function generateThermalReceiptHtml(options: InvoicePrintOptions): string {
  const settings = getShopSettings();
  const shopName = settings.shopName || SHOP_NAME || 'مكتبة فكرة';
  const shopSlogan = settings.slogan || 'للأدوات المكتبية والمدرسية والخدمات الطلابية';
  const shopAddress = settings.address || SHOP_ADDRESS || 'نادي الياسمين واحد — مدينة المستقبل';
  const shopPhones = settings.phones || SHOP_PHONES || '01001515297 / 01002226173';
  
  const is58mm = settings.thermalPaperWidth === '58mm';
  const pageWidth = is58mm ? '58mm' : '80mm';
  const bodyWidth = is58mm ? '54mm' : '76mm';
  
  // Font sizes based on settings
  const baseFontSize = settings.thermalFontSize === 'small' ? (is58mm ? '9px' : '10px') :
                       settings.thermalFontSize === 'large' ? (is58mm ? '11px' : '12.5px') :
                       (is58mm ? '10px' : '11px');

  const { invoice: inv, cashierName = 'كاشير' } = options;
  const originalSubtotal = Number(inv.originalSubtotal ?? inv.subtotal ?? inv.total) || 0;
  const categoryDiscounts: Record<string, number> = inv.categoryDiscounts || {};
  const totalCatDiscount = Object.values(categoryDiscounts).reduce((s, v) => s + (Number(v) || 0), 0);
  const generalDiscount = Number(inv.discount) || 0;
  const usedPoints = Number(inv.usedPoints) || 0;
  const totalSavings = totalCatDiscount + generalDiscount + usedPoints;
  const netTotal = Number(inv.total) || 0;
  const paidAmount = Number(inv.paidAmount ?? inv.total) || 0;
  const dueAmount = Number(inv.dueAmount ?? (inv.paymentMethod === 'credit' ? netTotal - paidAmount : 0)) || 0;
  const changeAmount = Number(inv.changeAmount ?? (inv.paymentMethod === 'cash' ? Math.max(0, paidAmount - netTotal) : 0)) || 0;

  const custName = inv.customerName?.trim() || 'عميل نقدي';
  const custPhone = inv.customerPhone?.trim() || '';

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>إيصال_رقم_${inv.number}</title>
  <style>
    @page {
      size: ${pageWidth} auto;
      margin: 2mm 2mm;
    }
    * {
      box-sizing: border-box;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans Arabic', 'Cairo', Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0 auto;
      padding: ${is58mm ? '2px' : '4px'};
      width: ${bodyWidth};
      font-size: ${baseFontSize};
      color: #000000;
      background: #FFFFFF;
      line-height: 1.35;
      direction: rtl;
      -webkit-font-smoothing: antialiased;
    }
    .header-center {
      text-align: center;
      margin-bottom: 6px;
    }
    .shop-logo-img {
      max-height: ${is58mm ? '40px' : '52px'};
      max-width: 80%;
      object-fit: contain;
      margin-bottom: 4px;
      filter: grayscale(100%) contrast(130%);
    }
    .shop-title {
      font-size: ${is58mm ? '13px' : '16px'};
      font-weight: 900;
      margin: 0 0 2px;
    }
    .shop-sub {
      font-size: ${is58mm ? '8.5px' : '10px'};
      color: #111;
      line-height: 1.25;
    }
    .divider {
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .double-divider {
      border-top: 2px solid #000;
      margin: 6px 0;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: ${is58mm ? '9px' : '10.5px'};
      padding: 1px 0;
    }
    .receipt-table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${is58mm ? '9px' : '10.5px'};
      margin: 4px 0;
    }
    .receipt-table th {
      border-bottom: 1.5px solid #000;
      padding: 3px 1px;
      text-align: center;
      font-weight: 900;
    }
    .receipt-table th.col-desc {
      text-align: right !important;
    }
    .receipt-table td {
      padding: 3px 1px;
      vertical-align: middle;
      border-bottom: 1px dashed #DDD;
    }
    .num { text-align: center; font-family: 'Segoe UI', Roboto, -apple-system, Arial, sans-serif; font-variant-numeric: tabular-nums; font-weight: 900; }
    .center { text-align: center; font-family: 'Segoe UI', Roboto, -apple-system, Arial, sans-serif; font-variant-numeric: tabular-nums; }
    .total-line {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      font-size: ${is58mm ? '9.5px' : '11px'};
      font-weight: 700;
    }
    .total-line .num {
      font-size: ${is58mm ? '10.5px' : '12px'};
      font-weight: 900;
    }
    .grand-total {
      display: flex;
      justify-content: space-between;
      font-size: ${is58mm ? '13px' : '15px'};
      font-weight: 900;
      padding: 4px 0;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      margin: 4px 0;
    }
    .grand-total .num {
      font-size: ${is58mm ? '14px' : '16px'};
      font-weight: 900;
    }
    .footer-text {
      text-align: center;
      font-size: ${is58mm ? '8.5px' : '10px'};
      margin-top: 6px;
      line-height: 1.35;
    }
    .qr-box {
      text-align: center;
      margin-top: 6px;
      padding-top: 4px;
      border-top: 1px dashed #000;
    }
    .barcode-display {
      font-family: monospace;
      letter-spacing: 2px;
      font-size: 11px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="header-center">
    ${settings.showLogoOnThermal && settings.logoUrl ? `
      <div>
        <img src="${settings.logoUrl}" alt="${shopName}" class="shop-logo-img" />
      </div>
    ` : ''}
    <div class="shop-title">${shopName}</div>
    ${shopSlogan ? `<div class="shop-sub">${shopSlogan}</div>` : ''}
    <div class="shop-sub">${shopAddress}</div>
    <div class="shop-sub">${shopPhones}</div>
    ${settings.taxNumber ? `<div class="shop-sub">الرقم الضريبي: ${settings.taxNumber}</div>` : ''}
    ${settings.thermalHeaderNote ? `<div style="margin-top:3px;font-weight:bold;font-size:9.5px;">${settings.thermalHeaderNote}</div>` : ''}
  </div>

  <div class="divider"></div>

  <div class="meta-row">
    <span>إيصال رقم: <b>#${inv.number}</b></span>
    <span>التاريخ: ${inv.date}</span>
  </div>
  <div class="meta-row">
    <span>العميل: <b>${custName}</b></span>
    ${custPhone ? `<span>${custPhone}</span>` : `<span>كاشير: ${cashierName}</span>`}
  </div>

  <div class="divider"></div>

  <table class="receipt-table">
    <thead>
      <tr>
        <th style="width:40%;" class="col-desc">الصنف</th>
        <th style="width:14%;" class="center">الكمية</th>
        <th style="width:22%;" class="center">السعر</th>
        <th style="width:24%;" class="center">الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${(inv.items || []).map((it: any) => {
        const orig = Number(it.originalPrice ?? it.price) || 0;
        const actual = Number(it.price) || 0;
        const rowTotal = (Number(it.qty) || 1) * actual;
        const hasDisc = orig > actual;

        return `
          <tr>
            <td style="text-align:right;">
              <b style="font-size:${is58mm ? '9.5px' : '10.5px'};display:block;">${it.name}</b>
              ${hasDisc ? `<span style="font-size:8.5px;font-weight:bold;color:#000;">(وفر: -${fmt(orig - actual)})</span>` : ''}
            </td>
            <td class="center" style="font-weight:900;">${it.qty}</td>
            <td class="center" style="font-weight:800;${hasDisc ? 'text-decoration:line-through;' : ''}">${fmt(actual)}</td>
            <td class="center" style="font-weight:900;">${fmt(rowTotal)}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="double-divider"></div>

  <div class="total-line">
    <span>الإجمالي قبل الخصم:</span>
    <span class="num">${fmt(originalSubtotal)} ج</span>
  </div>

  ${totalSavings > 0 ? `
    <div class="total-line" style="color:#000;font-weight:bold;">
      <span>إجمالي الخصومات:</span>
      <span class="num">-${fmt(totalSavings)} ج</span>
    </div>
  ` : ''}

  <div class="grand-total">
    <span>الصافي المطلوب:</span>
    <span class="num">${fmt(netTotal)} ج</span>
  </div>

  <div class="divider"></div>

  <div class="total-line">
    <span>المدفوع:</span>
    <span class="num">${fmt(paidAmount)} ج</span>
  </div>

  ${dueAmount > 0 ? `
    <div class="total-line" style="font-weight:bold;">
      <span>المتبقي آجل:</span>
      <span class="num">${fmt(dueAmount)} ج</span>
    </div>
  ` : ''}

  ${changeAmount > 0 ? `
    <div class="total-line" style="font-weight:bold;">
      <span>الباقي للعميل:</span>
      <span class="num">${fmt(changeAmount)} ج</span>
    </div>
  ` : ''}

  ${inv.earnedPoints > 0 ? `
    <div class="meta-row" style="margin-top:3px;font-weight:bold;">
      <span>⭐ نقاط ولاء مكتسبة:</span>
      <span>+${inv.earnedPoints} نقطة</span>
    </div>
  ` : ''}

  <div class="divider"></div>

  <div class="footer-text">
    ${settings.returnPolicyTerms ? settings.returnPolicyTerms : 'الاستبدال والاسترجاع خلال 14 يوماً مع أصل الفاتورة.'}<br>
    <b>${settings.thermalFooterNote || 'شكراً لزيارتكم ونسعد بخدمتكم دائماً!'}</b>
  </div>

  ${settings.showBarcodeOnThermal ? `
    <div class="qr-box">
      <div class="barcode-display">||| | |||| | ||||| | ||</div>
      <div style="font-size:8px;font-family:monospace;">INV-${inv.number}-${inv.date.replace(/-/g, '')}</div>
    </div>
  ` : ''}
</body>
</html>
  `.trim();
}

/**
 * Generate formatted WhatsApp receipt message
 */
export function generateWhatsAppReceiptMessage(inv: any, cashierName?: string): string {
  const shopName = SHOP_NAME || 'مكتبتي';
  const lines: string[] = [];
  lines.push(`📚 *${shopName}*`);
  lines.push(`🧾 *إيصال مبيعات رقمي*`);
  lines.push(`───────────────`);
  lines.push(`🔢 *رقم الفاتورة:* #${inv.number}`);
  lines.push(`📅 *التاريخ:* ${inv.date || todayStr()} ${inv.createdAt ? formatTimeEn(inv.createdAt) : ''}`);
  if (inv.customerName && inv.customerName !== 'عميل نقدي' && inv.customerName !== 'عميل نقدي / مبيعات صالة') {
    lines.push(`👤 *العميل:* ${inv.customerName}`);
  }
  if (cashierName) {
    lines.push(`💼 *الكاشير:* ${cashierName}`);
  }
  lines.push(`───────────────`);
  lines.push(`📦 *الأصناف:*`);

  (inv.items || []).forEach((it: any, i: number) => {
    const qty = it.qty || 1;
    const price = Number(it.price) || 0;
    const total = qty * price;
    lines.push(`${i + 1}. ${it.name}`);
    lines.push(`   ${qty} × ${fmt(price)} = *${fmt(total)} ج*`);
  });

  lines.push(`───────────────`);
  const orig = Number(inv.originalSubtotal ?? inv.subtotal ?? inv.total) || 0;
  const net = Number(inv.total) || 0;
  const totalSavings = Number(inv.totalSavings ?? ((inv.totalCatDiscount || 0) + (inv.discount || 0) + (inv.usedPoints || 0))) || 0;

  if (totalSavings > 0) {
    lines.push(`💰 *الإجمالي قبل الخصم:* ${fmt(orig)} ج`);
    lines.push(`🎁 *إجمالي الخصم والوفورات:* -${fmt(totalSavings)} ج`);
  }
  lines.push(`💵 *الصافي النهائي:* *${fmt(net)} ج*`);

  if (inv.paymentMethod === 'credit' && inv.dueAmount > 0) {
    lines.push(`📌 *المسدد الآن:* ${fmt(inv.paidAmount || 0)} ج`);
    lines.push(`⏳ *المتبقي آجل:* ${fmt(inv.dueAmount)} ج`);
  } else if (inv.paymentMethod === 'cash' && inv.changeAmount > 0) {
    lines.push(`💵 *المدفوع:* ${fmt(inv.paidAmount)} ج`);
    lines.push(`🔄 *الباقي للعميل:* ${fmt(inv.changeAmount)} ج`);
  }

  if (inv.earnedPoints > 0 || (inv.newPoints !== undefined && inv.newPoints !== null)) {
    lines.push(`───────────────`);
    if (inv.earnedPoints > 0) {
      lines.push(`⭐ *نقاط ولاء مكتسبة:* +${inv.earnedPoints} نقطة`);
    }
    if (inv.newPoints !== null && inv.newPoints !== undefined) {
      lines.push(`🌟 *إجمالي رصيد نقاطك:* ${inv.newPoints} نقطة`);
    }
  }

  lines.push(`───────────────`);
  lines.push(`شكراً لتعاملكم معنا ونرحب بكم دائماً! 🌹`);
  if (SHOP_PHONES) lines.push(`📞 للاستفسار: ${SHOP_PHONES}`);
  return lines.join('\n');
}

/**
 * Generate Z-Report HTML for Daily Shift Closing
 */
export function generateZReportHtml(data: {
  date: string;
  shiftId?: string;
  closedBy?: string;
  expectedCash?: number;
  actualCash?: number;
  difference?: number;
  invoicesCount?: number;
  salesGross?: number;
  salesCash?: number;
  salesCard?: number;
  salesVodafone?: number;
  salesCredit?: number;
  customerPayments?: number;
  returnsCashOut?: number;
  returnsCashIn?: number;
  expensesCashOut?: number;
  purchasesCashOut?: number;
  supplierPayments?: number;
  deposits?: number;
  withdrawals?: number;
  denominations?: Record<number, number>;
  notes?: string;
  [key: string]: any;
}): string {
  const shopName = SHOP_NAME || 'مكتبتي';
  const diff = data.difference ?? 0;
  const isMatch = Math.abs(diff) < 0.01;
  const isSurplus = diff > 0.01;

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير_تقفيل_الوردية_ZReport_${data.date}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; font-family: 'Cairo', 'Tajawal', sans-serif; }
    body { width: 76mm; margin: 0 auto; padding: 10px 5px; font-size: 11px; color: #000; line-height: 1.4; direction: rtl; }
    .center { text-align: center; }
    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
    .header h2 { margin: 0 0 4px 0; font-size: 16px; font-weight: 900; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; border: 1px solid #000; font-weight: bold; font-size: 11px; margin-top: 4px; }
    .row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px; }
    .row.bold { font-weight: bold; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .section-title { font-weight: 900; font-size: 12px; margin: 6px 0 3px 0; background: #eee; padding: 2px 4px; }
    .grand-box { border: 2px solid #000; padding: 6px; margin: 8px 0; text-align: center; background: #fafafa; }
    .grand-box .num { font-size: 16px; font-weight: 900; }
  </style>
</head>
<body>
  <div class="header">
    <h2>${shopName}</h2>
    <div><b>تقرير إغلاق الوردية وجرد الخزينة (Z-Report)</b></div>
    <div style="font-size:10px;margin-top:2px;">التاريخ: ${data.date} | الوقت: ${formatTimeEn(new Date())}</div>
    ${data.closedBy ? `<div style="font-size:10px;">المسؤول: ${data.closedBy}</div>` : ''}
  </div>

  <div class="section-title">📊 ملخص المبيعات والحركة</div>
  <div class="row"><span>عدد فواتير البيع:</span><b>${data.invoicesCount} فاتورة</b></div>
  <div class="row"><span>إجمالي المبيعات الشاملة:</span><b>${fmt(data.salesGross)} ج</b></div>
  <div class="row"><span>مبيعات نقدية (كاش):</span><b>${fmt(data.salesCash)} ج</b></div>
  ${data.salesCard > 0 ? `<div class="row"><span>مبيعات فيزا / بطاقات:</span><b>${fmt(data.salesCard)} ج</b></div>` : ''}
  ${data.salesVodafone > 0 ? `<div class="row"><span>مبيعات محافظ إلكترونية:</span><b>${fmt(data.salesVodafone)} ج</b></div>` : ''}
  ${data.salesCredit > 0 ? `<div class="row"><span>مبيعات آجل (شكك):</span><b>${fmt(data.salesCredit)} ج</b></div>` : ''}

  <div class="section-title">📥 المقبوضات النقدية الأخرى</div>
  <div class="row"><span>تحصيل ديون عملاء:</span><b>+${fmt(data.customerPayments)} ج</b></div>
  <div class="row"><span>إيداعات نقدية بالدرج:</span><b>+${fmt(data.deposits)} ج</b></div>
  <div class="row"><span>مرتجع بديل (وارد نقدي):</span><b>+${fmt(data.returnsCashIn)} ج</b></div>

  <div class="section-title">📤 المدفوعات والمنصرفات النقدية</div>
  <div class="row"><span>مرتجعات نقدية للعملاء:</span><b style="color:#b00;">-${fmt(data.returnsCashOut)} ج</b></div>
  <div class="row"><span>مصروفات ونثريات:</span><b style="color:#b00;">-${fmt(data.expensesCashOut)} ج</b></div>
  <div class="row"><span>مشتريات مسددة نقداً:</span><b style="color:#b00;">-${fmt(data.purchasesCashOut)} ج</b></div>
  <div class="row"><span>سداد ديون موردين:</span><b style="color:#b00;">-${fmt(data.supplierPayments)} ج</b></div>
  <div class="row"><span>سحوبات من الخزينة:</span><b style="color:#b00;">-${fmt(data.withdrawals)} ج</b></div>

  <div class="double-divider"></div>

  <div class="section-title">⚖️ مطابقة النقدية بالدرج</div>
  <div class="row bold"><span>النقدية المتوقعة بالدرج (الدفترية):</span><span>${fmt(data.expectedCash)} ج</span></div>
  <div class="row bold"><span>النقدية الفعلية بعد العد (المعدودة):</span><span>${fmt(data.actualCash)} ج</span></div>

  <div class="grand-box">
    <div><b>نتيجة مطابقة الوردية:</b></div>
    <div class="num" style="color: ${isMatch ? '#166534' : isSurplus ? '#1e40af' : '#991b1b'};">
      ${isMatch ? '✓ مطابقة تامة (0.00 ج)' : isSurplus ? `+${fmt(diff)} ج (زيادة)` : `-${fmt(Math.abs(diff))} ج (عجز)`}
    </div>
  </div>

  ${data.notes ? `
    <div class="divider"></div>
    <div style="font-size:10px;"><b>ملاحظات الإغلاق:</b> ${data.notes}</div>
  ` : ''}

  <div class="divider"></div>
  <div class="center" style="font-size:9.5px;margin-top:8px;">
    توقيع الكاشير: __________________<br>
    توقيع المدير: __________________<br>
    <i>نظام إدارة المكتبات ERP - تقرير رسمي معتمد</i>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate Purchase Order HTML
 */
export function generatePurchaseOrderHtml(po: {
  poNumber: string | number;
  date: string;
  supplierName: string;
  supplierPhone?: string;
  items: Array<{ name: string; barcode?: string; currentQty: number; orderQty: number; estimatedCost?: number; unit?: string }>;
  totalEstimatedCost: number;
  notes?: string;
}): string {
  const shopName = SHOP_NAME || 'مكتبتي';

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>أمر_شراء_وتوريد_رقم_${po.poNumber}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; font-family: 'Cairo', 'Tajawal', sans-serif; }
    body { margin: 0; padding: 0; font-size: 12px; color: #1e293b; direction: rtl; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 900; color: #0f172a; }
    .po-meta { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th { background: #0f172a; color: #fff; padding: 8px; font-size: 11px; text-align: center; }
    th:first-child { text-align: right; }
    td { border-bottom: 1px solid #e2e8f0; padding: 8px; font-size: 11px; text-align: center; }
    td:first-child { text-align: right; }
    .total-box { margin-right: auto; width: 280px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
    .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 13px; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; border-top: 1px solid #cbd5e1; padding-top: 16px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${shopName}</h1>
      <div style="font-size:12px;color:#64748b;">أمر شراء وتوريد بضاعة (Purchase Order)</div>
    </div>
    <div style="text-align:left;">
      <div style="font-size:16px;font-weight:900;color:#d97706;">PO #${po.poNumber}</div>
      <div style="font-size:11px;color:#64748b;">التاريخ: ${po.date}</div>
    </div>
  </div>

  <div class="po-meta">
    <div><b>المورد الموجه له:</b> ${po.supplierName || 'مورد عام / بدون تحديد'}</div>
    <div><b>هاتف المورد:</b> ${po.supplierPhone || '—'}</div>
    <div><b>عدد الأصناف المطلوبة:</b> ${po.items.length} صنف</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th style="width:45%;text-align:right;">اسم الصنف</th>
        <th style="width:15%;">الباركود</th>
        <th style="width:10%;">المخزون الحالي</th>
        <th style="width:12%;">الكمية المطلوبة</th>
        <th style="width:13%;">التكلفة التقديرية</th>
      </tr>
    </thead>
    <tbody>
      ${po.items.map((it, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td style="text-align:right;font-weight:bold;">${it.name}</td>
          <td style="font-family:monospace;">${it.barcode || '—'}</td>
          <td>${it.currentQty} ${it.unit || ''}</td>
          <td style="font-weight:900;font-size:13px;color:#0f172a;background:#fef3c7;">${it.orderQty}</td>
          <td>${it.estimatedCost ? `${fmt(it.orderQty * it.estimatedCost)} ج` : '—'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${po.totalEstimatedCost > 0 ? `
    <div class="total-box">
      <div class="total-row">
        <span>إجمالي التكلفة التقديرية:</span>
        <span style="color:#d97706;">${fmt(po.totalEstimatedCost)} ج</span>
      </div>
    </div>
  ` : ''}

  ${po.notes ? `
    <div style="margin-top:16px;background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:8px;font-size:11px;">
      <b>ملاحظات التوريد:</b> ${po.notes}
    </div>
  ` : ''}

  <div class="footer">
    <div>توقيع مسؤول المشتريات: ____________________</div>
    <div>اعتماد إدارة المكتبة: ____________________</div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate Barcode Labels HTML for standard sticker printers (e.g. 38x25mm)
 */
export function generateBarcodeLabelHtml(data: {
  productName: string;
  barcode: string;
  price: number;
  copies?: number;
  labelSize?: '38x25' | '50x30' | 'A4';
}): string {
  const shopName = SHOP_NAME || 'مكتبتي';
  const copies = data.copies || 2;
  const labels = Array.from({ length: copies });

  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>استيكر_باركود_${data.barcode}</title>
  <style>
    @page { size: 38mm 25mm; margin: 1mm; }
    * { box-sizing: border-box; font-family: 'Cairo', 'Tajawal', sans-serif; }
    body { margin: 0; padding: 0; background: #fff; }
    .label-page {
      width: 36mm;
      height: 23mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      text-align: center;
      page-break-after: always;
      padding: 1.5mm;
      border: 1px dashed #e2e8f0;
    }
    .shop-tag { font-size: 8px; font-weight: bold; color: #64748b; line-height: 1; }
    .prod-name { font-size: 9px; font-weight: 900; color: #0f172a; line-height: 1.1; max-height: 18px; overflow: hidden; }
    .barcode-svg { font-family: monospace; font-size: 10px; font-weight: bold; letter-spacing: 1px; color: #000; }
    .price-tag { font-size: 11px; font-weight: 900; color: #d97706; }
  </style>
</head>
<body>
  ${labels.map(() => `
    <div class="label-page">
      <div class="shop-tag">${shopName}</div>
      <div class="prod-name">${data.productName}</div>
      <div class="barcode-svg">||| | |||| | ||| ${data.barcode}</div>
      <div class="price-tag">${fmt(data.price)} ج</div>
    </div>
  `).join('')}
</body>
</html>
  `.trim();
}

