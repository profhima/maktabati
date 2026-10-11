import React from 'react';
import { Search, FolderTree, Table as TableIcon, Sparkles, BookOpen, Download } from 'lucide-react';
import { fmt } from '../../lib/utils';
import { CATEGORIES, GRADES } from '../../lib/constants';

export interface InventoryKpiFiltersBarProps {
  filteredCount: number;
  lowCount: number;
  zeroCount: number;
  totalCostValue: number;
  totalUnitsCount: number;
  canSeeCost: boolean;
  filterQ: string;
  setFilterQ: (q: string) => void;
  filterCategory: string;
  setFilterCategory: (cat: string) => void;
  filterGrade: string;
  setFilterGrade: (grade: string) => void;
  filterStatus: 'all' | 'low' | 'zero';
  setFilterStatus: (status: 'all' | 'low' | 'zero') => void;
  viewMode: 'tree' | 'table' | 'reorder';
  setViewMode: (mode: 'tree' | 'table' | 'reorder') => void;
  reorderCount: number;
  onOpenEgyptianCatalog?: () => void;
}

export const InventoryKpiFiltersBar: React.FC<InventoryKpiFiltersBarProps> = ({
  filteredCount,
  lowCount,
  zeroCount,
  totalCostValue,
  totalUnitsCount,
  canSeeCost,
  filterQ,
  setFilterQ,
  filterCategory,
  setFilterCategory,
  filterGrade,
  setFilterGrade,
  filterStatus,
  setFilterStatus,
  viewMode,
  setViewMode,
  reorderCount,
  onOpenEgyptianCatalog
}) => {
  return (
    <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
          <span className="text-xs text-[#8E98A6] block">الأصناف المعروضة</span>
          <b className="text-xl text-[#1F2A3C] font-mono">{filteredCount}</b>
        </div>
        <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
          <span className="text-xs text-[#8E98A6] block">مخزون منخفض</span>
          <b className="text-xl text-[#A9762F] font-mono">{lowCount}</b>
        </div>
        <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
          <span className="text-xs text-[#8E98A6] block">أصناف نافدة</span>
          <b className="text-xl text-[#A8503A] font-mono">{zeroCount}</b>
        </div>
        <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
          <span className="text-xs text-[#8E98A6] block">
            {canSeeCost ? 'قيمة المخزون بالتكلفة' : 'إجمالي عدد الوحدات'}
          </span>
          <b className="text-xl text-[#5C7A5E] font-mono">
            {canSeeCost ? `${fmt(totalCostValue)} ج` : `${totalUnitsCount} قطعة`}
          </b>
        </div>
      </div>

      {/* Egyptian Catalog Callout Strip */}
      {onOpenEgyptianCatalog && (
        <div className="p-3 bg-gradient-to-r from-amber-100/90 via-[#FAF6EE] to-amber-50 border-2 border-amber-400/60 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-2.5 text-[#1F2A3C]">
            <div className="p-2 bg-amber-600 text-white rounded-lg shadow-2xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm block text-amber-950">
                📖 دليل سلع ومنتجات المكتبات المصرية الشامل (Excel / CSV / JSON)
              </span>
              <span className="text-[11px] text-amber-800">
                مجمع من كبرى مكتبات وموردي الفجالة • مجهز بأسعار (0 ج) للمراجعة وتنزيل الإكسيل مباشرة
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenEgyptianCatalog}
            className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>استعراض وتنزيل ملف الإكسيل</span>
          </button>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-2 border-t border-[#EFE7D6]">
        <div className="sm:col-span-4">
          <div className="relative">
            <input
              type="text"
              className="w-full px-3 py-2 pr-8 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              placeholder="بحث سريع بالاسم أو الباركود..."
              value={filterQ}
              onChange={e => setFilterQ(e.target.value)}
            />
            <Search className="w-3.5 h-3.5 text-[#8E98A6] absolute top-2.5 right-2.5" />
          </div>
        </div>

        <div className="sm:col-span-2">
          <select
            className="w-full px-2 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="">كل الفئات</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <select
            className="w-full px-2 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
            value={filterGrade}
            onChange={e => setFilterGrade(e.target.value)}
          >
            <option value="">كل المراحل</option>
            {GRADES.map(g => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <select
            className="w-full px-2 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as any)}
          >
            <option value="all">الكل</option>
            <option value="low">⚠️ منخفض</option>
            <option value="zero">⛔ نافد</option>
          </select>
        </div>

        <div className="sm:col-span-3 flex gap-1">
          <button
            onClick={() => setViewMode('tree')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              viewMode === 'tree' ? 'bg-[#A9762F] text-white shadow-xs' : 'bg-[#EFE7D6] text-[#1F2A3C]'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            شجرة
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              viewMode === 'table' ? 'bg-[#A9762F] text-white shadow-xs' : 'bg-[#EFE7D6] text-[#1F2A3C]'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            جدول
          </button>
          <button
            onClick={() => setViewMode('reorder')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
              viewMode === 'reorder' ? 'bg-[#5C7A5E] text-white shadow-xs' : 'bg-[#5C7A5E]/15 text-[#5C7A5E]'
            }`}
            title="نظام إعادة الطلب الذكي وتوليد أوامر الشراء"
          >
            <Sparkles className="w-3.5 h-3.5" />
            إعادة الطلب ({reorderCount})
          </button>
        </div>
      </div>
    </div>
  );
};
