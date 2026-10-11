import React from 'react';
import { Tag, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { fmt } from '../../lib/utils';

export interface PosQuickCategoryBarProps {
  catDiscountOpen: boolean;
  setCatDiscountOpen: (val: boolean) => void;
  saleCategoryDiscounts: Record<string, { type: 'percent' | 'amount'; value: number }>;
  categoriesList: string[];
  selectedCatForDiscount: string;
  setSelectedCatForDiscount: (cat: string) => void;
  catDiscountVal: number;
  setCatDiscountVal: (val: number) => void;
  catDiscountType: 'percent' | 'amount';
  setCatDiscountType: (type: 'percent' | 'amount') => void;
  handleApplyCategoryDiscount: (cat: string, val: number, type: 'percent' | 'amount') => void;
  posCategory: string;
  setPosCategory: (cat: string) => void;
  posInstitution: string;
  setPosInstitution: (inst: string) => void;
  posGrade: string;
  setPosGrade: (grade: string) => void;
  institutions: string[];
  quickFilteredProducts: any[];
  addSaleItemByProduct: (productId: string, qty: number) => boolean;
  copyTariffId: string;
  setCopyTariffId: (id: string) => void;
  copyPages: number;
  setCopyPages: (pages: number) => void;
  copyPrice: number;
  setCopyPrice: (price: number) => void;
  handleAddCopyService: () => void;
  printingTariffs: any[];
}

export const PosQuickCategoryBar: React.FC<PosQuickCategoryBarProps> = ({
  catDiscountOpen,
  setCatDiscountOpen,
  saleCategoryDiscounts,
  categoriesList,
  selectedCatForDiscount,
  setSelectedCatForDiscount,
  catDiscountVal,
  setCatDiscountVal,
  catDiscountType,
  setCatDiscountType,
  handleApplyCategoryDiscount,
  posCategory,
  setPosCategory,
  posInstitution,
  setPosInstitution,
  posGrade: _posGrade,
  setPosGrade,
  institutions,
  quickFilteredProducts,
  addSaleItemByProduct,
  copyTariffId,
  setCopyTariffId,
  copyPages,
  setCopyPages,
  copyPrice,
  setCopyPrice,
  handleAddCopyService,
  printingTariffs
}) => {
  return (
    <div className="space-y-4">
      {/* Category Discounts Manager Panel */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCatDiscountOpen(!catDiscountOpen)}
            className="flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:underline cursor-pointer"
          >
            <Tag className="w-4 h-4" />
            <span>🏷️ تطبيق خصم على فئة كاملة (مثل كتب خارجية، أدوات مكتبية...)</span>
            {catDiscountOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {Object.keys(saleCategoryDiscounts).length > 0 && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              {Object.keys(saleCategoryDiscounts).length} فئة عليها خصم
            </span>
          )}
        </div>

        {catDiscountOpen && (
          <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">اختر الفئة</label>
              <select
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                value={selectedCatForDiscount}
                onChange={e => setSelectedCatForDiscount(e.target.value)}
              >
                {categoriesList.map(c => (
                  <option key={c} value={c}>
                    {c}{' '}
                    {saleCategoryDiscounts[c]
                      ? `(خصم حالي: ${saleCategoryDiscounts[c].value}${saleCategoryDiscounts[c].type === 'percent' ? '%' : 'ج'})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 mb-1">قيمة الخصم</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="w-full px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-center text-slate-900 font-num"
                  value={catDiscountVal}
                  onChange={e => setCatDiscountVal(parseFloat(e.target.value) || 0)}
                />
                <select
                  className="px-1.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  value={catDiscountType}
                  onChange={e => setCatDiscountType(e.target.value as any)}
                >
                  <option value="percent">%</option>
                  <option value="amount">ج</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-5 flex items-end gap-1.5">
              <button
                onClick={() => handleApplyCategoryDiscount(selectedCatForDiscount, catDiscountVal, catDiscountType)}
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                تطبيق الخصم
              </button>
              {saleCategoryDiscounts[selectedCatForDiscount] && (
                <button
                  onClick={() => handleApplyCategoryDiscount(selectedCatForDiscount, 0, 'percent')}
                  className="py-1.5 px-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active category discount badges */}
        {Object.keys(saleCategoryDiscounts).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(saleCategoryDiscounts).map(([cat, rawRule]) => {
              const rule = rawRule as { type: 'percent' | 'amount'; value: number };
              return (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                >
                  {cat}: <b>-{rule.value}{rule.type === 'percent' ? '%' : ' ج'}</b>
                  <button
                    onClick={() => handleApplyCategoryDiscount(cat, 0, 'percent')}
                    className="hover:text-rose-600 cursor-pointer text-xs"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Categories Filter & Grid */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
        <h3 className="font-bold text-sm text-slate-900">📚 اختيار سريع من الأصناف</h3>

        {/* Category Chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => {
              setPosCategory('');
              setPosInstitution('');
              setPosGrade('');
            }}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              posCategory === '' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            الكل
          </button>
          {categoriesList.map(c => (
            <button
              key={c}
              onClick={() => {
                setPosCategory(c);
                setPosInstitution('');
                setPosGrade('');
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                posCategory === c ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Institution Chips */}
        {institutions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
            <button
              onClick={() => {
                setPosInstitution('');
                setPosGrade('');
              }}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                posInstitution === '' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
              }`}
            >
              كل المؤسسات
            </button>
            {institutions.map(inst => (
              <button
                key={inst}
                onClick={() => {
                  setPosInstitution(inst);
                  setPosGrade('');
                }}
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                  posInstitution === inst ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {inst}
              </button>
            ))}
          </div>
        )}

        {/* Product Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
          {quickFilteredProducts.slice(0, 24).map(p => {
            const out = p.qty <= 0;
            return (
              <button
                key={p.id}
                disabled={out}
                onClick={() => addSaleItemByProduct(p.id, 1)}
                className={`p-2.5 rounded-xl text-center border transition-all ${
                  out
                    ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-amber-500 hover:shadow-xs cursor-pointer active:scale-95'
                }`}
              >
                <b className="text-xs text-slate-900 block truncate font-bold">{p.name}</b>
                <span className="text-[10px] text-slate-500 block truncate">{p.institution || p.grade || '-'}</span>
                <span className="text-xs font-bold text-amber-700 block mt-1">{fmt(p.sellPrice)} ج</span>
                <span className="text-[10px] text-emerald-600 block font-medium">
                  متاح: <span className="font-num">{p.qty}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Copy & Printing Service Fast Adder */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
        <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center gap-1.5">
          <Printer className="w-4 h-4 text-amber-600" />
          خدمة تصوير / طباعة سريعة
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-5">
            <select
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-bold"
              value={copyTariffId}
              onChange={e => {
                setCopyTariffId(e.target.value);
                const t = (printingTariffs || []).find(x => x.id === e.target.value);
                if (t) setCopyPrice(t.price);
              }}
            >
              <option value="">خدمة عامة</option>
              {(printingTariffs || []).map(t => (
                <option key={t.id} value={t.id}>
                  {t.title} ({fmt(t.price)} ج/{t.unit})
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <input
              type="number"
              min="1"
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-slate-900 font-num"
              placeholder="العدد"
              value={copyPages}
              onChange={e => setCopyPages(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>
          <div className="sm:col-span-2">
            <input
              type="number"
              step="0.25"
              className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-center font-bold text-slate-900 font-num"
              placeholder="السعر"
              value={copyPrice}
              onChange={e => setCopyPrice(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="sm:col-span-2">
            <button
              onClick={handleAddCopyService}
              className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
            >
              إضافة
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
