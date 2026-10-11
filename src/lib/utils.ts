export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '0';
  const val = Math.round(Number(n) * 100) / 100;
  return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatTimeEn(dateInput?: string | number | Date): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12; // 12-hour clock
  const minStr = minutes < 10 ? '0' + minutes : String(minutes);
  return `${hours}:${minStr} ${ampm}`;
}

export function formatDateEn(dateInput?: string | number | Date): string {
  if (!dateInput) return todayStr();
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function escapeHtml(v: any): string {
  return String(v ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[c] || c));
}

export function sanitizeFilename(v: string): string {
  return String(v ?? '').replace(/[\\/:*?"<>|]/g, '_').trim() || 'ملف';
}

export function convertArabicDigits(str: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return str.replace(/[٠-٩]/g, d => String(arabicDigits.indexOf(d)));
}

export function cleanPhoneForWhatsapp(phone: string): string {
  if (!phone) return '';
  let p = convertArabicDigits(phone.trim()).replace(/[^0-9+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('00')) p = p.slice(2);
  else if (p.startsWith('0') && (p.length === 11 || p.length === 10)) {
    // Standard Egyptian mobile like 010..., 011..., 012..., 015...
    p = '20' + p.slice(1);
  }
  return p;
}

export function inRange(dateStr: string, from?: string, to?: string): boolean {
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}

export function productFullName(p: { institution?: string; name: string; grade?: string; term?: string }): string {
  return [p.institution, p.name, p.grade, p.term].filter(Boolean).join(' ');
}

export function productLabel(p: { institution?: string; name: string; grade?: string; term?: string; barcode?: string }): string {
  const extra = [p.institution, p.grade, p.term].filter(Boolean).join(' - ');
  const code = p.barcode ? ` [${p.barcode}]` : '';
  return (extra ? `${p.name} (${extra})` : p.name) + code;
}

export function tokenize(str: string): string[] {
  return (str || '').trim().split(/\s+/).filter(Boolean);
}

export function similarityScore(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  ta.forEach(t => { if (tb.has(t)) common++; });
  const jacc = common / Math.max(ta.size, tb.size);
  const aNorm = (a || '').trim(), bNorm = (b || '').trim();
  const substrBonus = (aNorm && bNorm && (aNorm.includes(bNorm) || bNorm.includes(aNorm))) ? 0.3 : 0;
  return Math.min(1, jacc + substrBonus);
}

export function beepSound(): void {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 150);
  } catch (_e) {
    // Ignore audio context errors in unprivileged environments
  }
}

export function stockMovementLabel(type: string): string {
  const m: Record<string, string> = {
    sale: 'بيع',
    purchase: 'شراء',
    return: 'مرتجع نقدي',
    exchange_in: 'تبديل — صنف راجع',
    exchange_out: 'تبديل — صنف بديل',
    adjustment: 'تعديل يدوي'
  };
  return m[type] || type || 'حركة';
}

export function stockMovementId(operationId: string, productId: string, suffix?: string): string {
  return `${operationId}_${String(productId)}_${suffix || uid()}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 140);
}
