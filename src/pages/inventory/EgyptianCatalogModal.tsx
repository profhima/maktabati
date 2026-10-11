import React, { useState, useMemo } from 'react';
import {
  EGYPTIAN_STATIONERY_CATALOG,
  CatalogProductItem,
  downloadCatalogCsv,
  downloadCatalogJson
} from '../../data/egyptianStationeryCatalog';
import {
  FileSpreadsheet,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Copy,
  BookOpen,
  Filter,
  X,
  Package,
  Layers,
  Sparkles,
  Tag
} from 'lucide-react';
import { fmt } from '../../lib/utils';

export interface EgyptianCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const EgyptianCatalogModal: React.FC<EgyptianCatalogModalProps> = ({
  isOpen,
  onClose,
  onToast
}) => {
  const [searchQ, setSearchQ] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    EGYPTIAN_STATIONERY_CATALOG.forEach(item => set.add(item.category));
    return Array.from(set);
  }, []);

  // Brands list
  const brands = useMemo(() => {
    const set = new Set<string>();
    EGYPTIAN_STATIONERY_CATALOG.forEach(item => set.add(item.brand));
    return Array.from(set);
  }, []);

  // Filtered items
  const filteredItems = useMemo(() => {
    return EGYPTIAN_STATIONERY_CATALOG.filter(item => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedBrand !== 'all' && item.brand !== selectedBrand) return false;
      if (searchQ.trim()) {
        const q = searchQ.trim().toLowerCase();
        const hay = `${item.name} ${item.brand} ${item.category} ${item.unit} ${item.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [searchQ, selectedCategory, selectedBrand]);

  if (!isOpen) return null;

  const handleCopySummary = () => {
    const text = filteredItems
      .map(
        (it, idx) =>
          `${idx + 1}. [${it.category}] ${it.name} - الماركة: ${it.brand} - الوحدة: ${it.unit}`
      )
      .join('\n');
    navigator.clipboard.writeText(text);
    onToast(`✅ تم نسخ ${filteredItems.length} صنف إلى الحافظة بنجاح`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-[#FFFDF8] border border-[#D8CBB0] rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#F6F1E7] border-b border-[#D8CBB0] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#A9762F]/15 rounded-xl border border-[#A9762F]/30 text-[#A9762F]">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-serif font-bold text-[#1F2A3C] flex items-center gap-2">
                دليل سلع ومنتجات المكتبات والقرطاسية المصرية الشامل
                <span className="text-[11px] px-2 py-0.5 bg-[#5C7A5E]/15 border border-[#5C7A5E]/30 text-[#5C7A5E] rounded-full font-sans font-bold">
                  {EGYPTIAN_STATIONERY_CATALOG.length} صنف مجمع
                </span>
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                مستخلص من أسواق الفجالة والمكتبات المصرية الكبرى • بدون أسعار (جاهز للمراجعة والتنزيل بصيغ Excel / CSV / JSON)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#8E98A6] hover:text-[#1F2A3C] hover:bg-[#EFE7D6] rounded-xl transition-all cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="px-4 py-2.5 bg-[#FAF6EE] border-b border-[#EFE7D6] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-[#3A4A63]">
            <AlertCircle className="w-4 h-4 text-[#A9762F] shrink-0" />
            <span>
              <strong>وضع المراجعة المستقل:</strong> هذه السلع لم يتم إدراجها في مخزونك الفعلي تلقائياً. يمكنك مراجعتها وتنزيل الملف كاملاً لإضافة أسعارك الخاصة أولاً.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                downloadCatalogCsv();
                onToast('📥 تم بدء تنزيل ملف الإكسيل (CSV UTF-8) باللغة العربية');
              }}
              className="px-3 py-1.5 rounded-xl bg-[#5C7A5E] hover:bg-[#4D684F] text-white font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تنزيل ملف إكسيل (CSV)
            </button>

            <button
              onClick={() => {
                downloadCatalogJson();
                onToast('📥 تم بدء تنزيل ملف البيانات البرمجي (JSON)');
              }}
              className="px-3 py-1.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              تنزيل ملف (JSON)
            </button>

            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 rounded-xl bg-[#EFE7D6] hover:bg-[#E2D6C0] text-[#1F2A3C] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="نسخ الأسماء إلى الحافظة"
            >
              <Copy className="w-4 h-4 text-[#A9762F]" />
              نسخ القائمة
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="p-3 bg-[#FAF6EE]/70 border-b border-[#EFE7D6] grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-6 relative">
            <input
              type="text"
              className="w-full px-3 py-2 pr-9 text-xs bg-white border border-[#D8CBB0] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#A9762F]"
              placeholder="ابحث عن ماركة، قلم، لانش بوكس، زمزمية، شنطة، ورق، شمع، لعبة..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <Search className="w-4 h-4 text-[#8E98A6] absolute top-2.5 right-3" />
          </div>

          <div className="sm:col-span-3">
            <select
              className="w-full px-2.5 py-2 text-xs bg-white border border-[#D8CBB0] rounded-xl"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="all">كل الفئات ({EGYPTIAN_STATIONERY_CATALOG.length})</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat} ({EGYPTIAN_STATIONERY_CATALOG.filter(i => i.category === cat).length})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              className="w-full px-2.5 py-2 text-xs bg-white border border-[#D8CBB0] rounded-xl"
              value={selectedBrand}
              onChange={e => setSelectedBrand(e.target.value)}
            >
              <option value="all">كل الماركات والمصادر</option>
              {brands.map(b => (
                <option key={b} value={b}>
                  {b} ({EGYPTIAN_STATIONERY_CATALOG.filter(i => i.brand === b).length})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Items Table View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-[#8E98A6] px-1">
            <span>
              عرض <b>{filteredItems.length}</b> صنف من أصل {EGYPTIAN_STATIONERY_CATALOG.length}
            </span>
            <span className="text-[#5C7A5E] font-semibold">
              ✓ تم تعيين الأسعار إلى (0.00 ج) للمراجعة وتحديد أسعارك الخاصة
            </span>
          </div>

          <div className="border border-[#D8CBB0] rounded-xl overflow-hidden bg-white shadow-2xs">
            <table className="w-full text-xs text-right">
              <thead className="bg-[#EFE7D6] text-[#1F2A3C] font-bold">
                <tr>
                  <th className="p-2.5 text-center w-12">#</th>
                  <th className="p-2.5">اسم الصنف والمواصفات</th>
                  <th className="p-2.5 text-center">الماركة</th>
                  <th className="p-2.5 text-center">الفئة</th>
                  <th className="p-2.5 text-center">الوحدة</th>
                  <th className="p-2.5 text-center">سعر الشراء</th>
                  <th className="p-2.5 text-center">سعر البيع</th>
                  <th className="p-2.5 text-center">الطلب المقترح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFE7D6]">
                {filteredItems.length > 0 ? (
                  filteredItems.map((it, idx) => (
                    <tr key={it.id} className="hover:bg-[#FAF6EE] transition-colors">
                      <td className="p-2.5 text-center text-[#8E98A6] font-mono">{idx + 1}</td>
                      <td className="p-2.5">
                        <span className="font-bold text-[#1F2A3C] block">{it.name}</span>
                        {it.notes && (
                          <span className="text-[10px] text-[#8E98A6] block mt-0.5">{it.notes}</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 bg-[#FAF6EE] border border-[#D8CBB0] rounded-md font-medium text-[#3A4A63] text-[11px]">
                          {it.brand}
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 bg-[#A9762F]/10 text-[#A9762F] rounded-md font-semibold text-[11px]">
                          {it.category}
                        </span>
                      </td>
                      <td className="p-2.5 text-center font-bold text-[#3A4A63]">{it.unit}</td>
                      <td className="p-2.5 text-center font-mono text-[#8E98A6]">غير محدد (0 ج)</td>
                      <td className="p-2.5 text-center font-mono text-[#8E98A6]">غير محدد (0 ج)</td>
                      <td className="p-2.5 text-center font-mono text-[#5C7A5E]">
                        {it.minQty} - {it.maxQty} {it.unit}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-[#8E98A6]">
                      لا توجد أصناف مطابقة لمعايير البحث الحالية
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#F6F1E7] border-t border-[#D8CBB0] flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[#6B7280]">
            يمكنك فتح ملف الإكسيل CSV المنزّل وإضافة الأسعار بمرونة ثم استيراده مستقبلاً متى شئت.
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                downloadCatalogCsv();
                onToast('📥 تم تنزيل ملف الإكسيل الشامل');
              }}
              className="px-4 py-2 rounded-xl bg-[#5C7A5E] hover:bg-[#4D684F] text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              تنزيل ملف الإكسيل (CSV) الآن
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#EFE7D6] hover:bg-[#E2D6C0] text-[#1F2A3C] font-bold text-xs cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
