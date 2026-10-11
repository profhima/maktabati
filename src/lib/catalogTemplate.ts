import { SHOP_NAME, SHOP_ADDRESS, SHOP_PHONES } from './constants';
import { fmt, formatDateEn } from './utils';

export interface CatalogItemOffer {
  productId: string;
  name: string;
  category: string;
  institution?: string;
  grade?: string;
  term?: string;
  originalPrice: number;
  offerPrice: number;
  discountPercent: number;
  badge?: string;
  qtyAvailable?: number;
  note?: string;
}

export interface ExhibitionCatalogOptions {
  title: string;
  subtitle?: string;
  validUntil?: string;
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
  items: CatalogItemOffer[];
  note?: string;
  columns?: 2 | 3;
  theme?: 'gold' | 'emerald' | 'navy';
}

/**
 * Generate A4 High-Quality Exhibition Catalog / Deals Flyer HTML
 */
export function generateExhibitionCatalogHtml(options: ExhibitionCatalogOptions): string {
  const {
    title = 'مجلة عروض وتخفيضات معرض الكتب والأدوات المدرسية',
    subtitle = 'أقوى العروض والتخفيضات الحصرية • كميات محدودة حتى نفاد المخزون',
    validUntil = 'ساري حتى نفاد الكمية',
    shopName = SHOP_NAME,
    shopPhone = SHOP_PHONES,
    shopAddress = SHOP_ADDRESS,
    items = [],
    note = 'العروض سارية داخل المعرض وللطلبات عبر الواتساب والتوصيل المباشر.',
    columns = 3,
    theme = 'gold'
  } = options;

  const totalItems = items.length;
  const maxDiscount = items.reduce((max, it) => Math.max(max, it.discountPercent || 0), 0);
  const totalSavings = items.reduce((s, it) => s + Math.max(0, it.originalPrice - it.offerPrice), 0);

  const themeColors = {
    gold: {
      primary: '#A9762F',
      primaryDark: '#8A5D20',
      bgLight: '#FAF6EE',
      accent: '#D97706',
      border: '#D8CBB0',
      cardBg: '#FFFFFF',
      badgeBg: '#FEF3C7',
      badgeText: '#92400E'
    },
    emerald: {
      primary: '#059669',
      primaryDark: '#047857',
      bgLight: '#ECFDF5',
      accent: '#10B981',
      border: '#A7F3D0',
      cardBg: '#FFFFFF',
      badgeBg: '#D1FAE5',
      badgeText: '#065F46'
    },
    navy: {
      primary: '#1E3A8A',
      primaryDark: '#172554',
      bgLight: '#EFF6FF',
      accent: '#2563EB',
      border: '#BFDBFE',
      cardBg: '#FFFFFF',
      badgeBg: '#DBEAFE',
      badgeText: '#1E40AF'
    }
  }[theme];

  const colClass = columns === 2 ? 'grid-cols-2' : 'grid-cols-3';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      background-color: #f1f5f9;
      display: flex;
      justify-content: center;
      padding: 20px;
    }

    .invoice-container, .catalog-container {
      width: 210mm;
      min-height: 297mm;
      background: #FFFFFF;
      padding: 14mm 12mm;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-col: column;
      justify-content: space-between;
    }

    .catalog-header {
      background: linear-gradient(135deg, ${themeColors.primaryDark} 0%, ${themeColors.primary} 100%);
      color: #ffffff;
      padding: 16px 20px;
      border-radius: 14px;
      margin-bottom: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      position: relative;
    }

    .catalog-badge-pill {
      background: #FFFFFF;
      color: ${themeColors.primaryDark};
      font-weight: 900;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 20px;
      display: inline-block;
      margin-bottom: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .catalog-grid {
      display: grid;
      grid-template-columns: ${columns === 2 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)'};
      gap: 10px;
      margin-bottom: 16px;
    }

    .offer-card {
      background: #FFFFFF;
      border: 1.5px solid ${themeColors.border};
      border-radius: 12px;
      padding: 10px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 2px 6px rgba(0,0,0,0.03);
      page-break-inside: avoid;
    }

    .offer-badge {
      position: absolute;
      top: -8px;
      left: 8px;
      background: #DC2626;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 6px;
      box-shadow: 0 2px 4px rgba(220,38,38,0.3);
    }

    .item-title {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.35;
      margin-bottom: 4px;
      margin-top: 4px;
    }

    .item-meta {
      font-size: 10px;
      color: #64748B;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .price-box {
      background: ${themeColors.bgLight};
      border-radius: 8px;
      padding: 6px 8px;
      border: 1px dashed ${themeColors.border};
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .price-old {
      font-size: 11px;
      color: #94A3B8;
      text-decoration: line-through;
      font-weight: 600;
    }

    .price-new {
      font-size: 15px;
      color: ${themeColors.primaryDark};
      font-weight: 900;
    }

    .catalog-footer {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 12px 16px;
      font-size: 11px;
      color: #475569;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: auto;
    }

    @media print {
      body {
        background: transparent;
        padding: 0;
      }
      .catalog-container {
        box-shadow: none;
        width: 100%;
        min-height: auto;
        padding: 8mm 6mm;
      }
    }
  </style>
</head>
<body>
  <div class="catalog-container invoice-container">
    <div>
      <!-- Header Banner -->
      <div class="catalog-header">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="catalog-badge-pill">🔥 تخفيضات وتصفية كبرى — خصومات تصل إلى ${maxDiscount}%</div>
            <h1 style="font-size: 20px; font-weight: 900; line-height: 1.2; margin-bottom: 4px;">
              ${title}
            </h1>
            <p style="font-size: 12px; opacity: 0.95; font-weight: 600;">
              ${subtitle}
            </p>
          </div>
          <div style="text-align: left; background: rgba(255,255,255,0.15); padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.25);">
            <div style="font-size: 13px; font-weight: 900;">${shopName}</div>
            <div style="font-size: 11px; opacity: 0.9;">📞 ${shopPhone}</div>
            <div style="font-size: 10px; opacity: 0.85;">📍 ${shopAddress}</div>
          </div>
        </div>
        
        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; font-size: 11px;">
          <span>⏳ <b>فترة العرض:</b> ${validUntil}</span>
          <span>📦 <b>عدد الأصناف بالعرض:</b> ${totalItems} صنف</span>
          <span>💰 <b>إجمالي التوفير في الباقة:</b> ${fmt(totalSavings)} جنيه</span>
        </div>
      </div>

      <!-- Items Grid -->
      <div class="catalog-grid">
        ${items.map((it, idx) => {
          const badgeText = it.badge || (it.discountPercent > 0 ? `خصم ${it.discountPercent}%` : 'عرض مميز');
          const saveVal = it.originalPrice > it.offerPrice ? it.originalPrice - it.offerPrice : 0;
          return `
            <div class="offer-card">
              ${badgeText ? `<div class="offer-badge">${badgeText}</div>` : ''}
              
              <div>
                <div class="item-title">${idx + 1}. ${it.name}</div>
                <div class="item-meta">
                  ${it.category ? `<span style="background:#F1F5F9; padding: 1px 6px; border-radius:4px;">${it.category}</span>` : ''}
                  ${it.grade ? `<span style="background:#FEF3C7; color:#92400E; padding: 1px 6px; border-radius:4px;">${it.grade}</span>` : ''}
                  ${it.term ? `<span>• ${it.term}</span>` : ''}
                </div>
              </div>

              <div>
                <div class="price-box">
                  <div>
                    ${it.originalPrice > it.offerPrice ? `<div class="price-old">${fmt(it.originalPrice)} ج</div>` : ''}
                    <div class="price-new">${fmt(it.offerPrice)} <small style="font-size:10px; font-weight:normal;">جنيه</small></div>
                  </div>
                  ${saveVal > 0 ? `
                    <div style="text-align: left; font-size: 10px; color: #16A34A; font-weight: 800;">
                      وفر<br>${fmt(saveVal)} ج
                    </div>
                  ` : ''}
                </div>
                ${it.qtyAvailable && it.qtyAvailable > 0 ? `
                  <div style="font-size: 9px; color: #64748B; margin-top: 4px; text-align: left;">
                    متاح بالمخزون: <b>${it.qtyAvailable}</b> قطعة
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Catalog Footer -->
    <div>
      <div class="catalog-footer">
        <div>
          <b>📌 ملاحظة وشروط العرض:</b> ${note}
        </div>
        <div style="text-align: left; font-weight: bold; color: ${themeColors.primaryDark};">
          للطلب والحجز واتساب: ${shopPhone}
        </div>
      </div>
      <div style="text-align: center; font-size: 9px; color: #94A3B8; margin-top: 6px;">
        تم تصميم المجلة بواسطة نظام (${shopName}) • تاريخ الطباعة: ${formatDateEn(new Date())}
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate WhatsApp Formatted Deals Message
 */
export function generateWhatsAppCatalogMessage(options: ExhibitionCatalogOptions): string {
  const {
    title = 'مجلة عروض وتخفيضات المعرض',
    subtitle = 'أقوى التخفيضات والأسعار التنافسية',
    validUntil = 'ساري حتى نفاد الكمية',
    shopName = SHOP_NAME,
    shopPhone = SHOP_PHONES,
    items = []
  } = options;

  let msg = `✨ *${shopName}* ✨\n`;
  msg += `📢 *${title}*\n`;
  msg += `🏷️ _${subtitle}_\n`;
  msg += `⏳ *فترة العرض:* ${validUntil}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

  items.forEach((it, idx) => {
    const badge = it.badge ? `[${it.badge}] ` : '';
    const discount = it.discountPercent > 0 ? `(خصم ${it.discountPercent}%)` : '';
    msg += `🔹 *${idx + 1}. ${it.name}* ${badge}\n`;
    if (it.grade || it.term || it.category) {
      msg += `   📂 ${[it.category, it.grade, it.term].filter(Boolean).join(' - ')}\n`;
    }
    if (it.originalPrice > it.offerPrice) {
      msg += `   💵 السعر: ~${fmt(it.originalPrice)} ج~ ⬅️ *${fmt(it.offerPrice)} ج فقط* ${discount}\n`;
    } else {
      msg += `   💵 السعر: *${fmt(it.offerPrice)} ج*\n`;
    }
    msg += `\n`;
  });

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `📦 *للطلب والاستفسار أو التوصيل:* 📞 ${shopPhone}\n`;
  msg += `📍 *العنوان:* ${SHOP_ADDRESS}\n`;
  msg += `_العروض سارية حتى نفاد الكمية بالمكتبة_`;

  return msg;
}
