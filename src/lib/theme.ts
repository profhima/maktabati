/**
 * Maktabati Design System & Theme Constants
 * Unified tokens for colors, typography contrast (WCAG AA compliant), spacing, and component surfaces.
 */

export const THEME = {
  // Brand & Accent Colors
  colors: {
    brand: {
      primary: 'amber-600',
      primaryHover: 'amber-700',
      primaryLight: 'amber-50',
      primaryBorder: 'amber-200',
      primaryText: 'amber-800',
    },
    success: {
      base: 'emerald-600',
      hover: 'emerald-700',
      light: 'emerald-50',
      border: 'emerald-200',
      text: 'emerald-800',
    },
    danger: {
      base: 'rose-600',
      hover: 'rose-700',
      light: 'rose-50',
      border: 'rose-200',
      text: 'rose-800',
    },
    info: {
      base: 'blue-600',
      hover: 'blue-700',
      light: 'blue-50',
      border: 'blue-200',
      text: 'blue-800',
    },
    // High-Contrast Slate Neutrals (WCAG AA Compliant >= 4.5:1 against light background)
    text: {
      primary: 'text-slate-900',      // #0F172A (Highest contrast)
      secondary: 'text-slate-700',    // #334155 (Sub-headings, bold values)
      muted: 'text-slate-600',        // #475569 (Secondary labels, replaces washed-out #8E98A6)
      subtle: 'text-slate-500',       // #64748B (Footnotes, timestamps)
    },
    surface: {
      base: 'bg-[#F8FAFC]',           // Eye-safe ultra-light slate background
      card: 'bg-white',
      muted: 'bg-slate-50',
      highlight: 'bg-amber-50/70',
      border: 'border-slate-200',
      borderSubtle: 'border-slate-100',
    }
  },

  // Standardized spacing & padding classes
  spacing: {
    pageGap: 'space-y-5',
    cardPadding: 'p-4 sm:p-5',
    densePadding: 'p-3 sm:p-4',
    sectionGap: 'gap-4',
  },

  // Standard component styling presets
  classes: {
    card: 'bg-white border border-slate-200 rounded-2xl shadow-xs',
    cardHover: 'bg-white border border-slate-200 hover:border-amber-400 rounded-2xl shadow-xs transition-all',
    headerBadge: 'px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5',
    primaryButton: 'px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2',
    secondaryButton: 'px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm rounded-xl border border-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-2',
    dangerButton: 'px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs sm:text-sm rounded-xl border border-rose-200 transition-colors cursor-pointer flex items-center justify-center gap-2',
    tableHead: 'bg-slate-100 font-bold text-slate-700 text-xs border-b border-slate-200',
    tableRow: 'hover:bg-slate-50/80 transition-colors text-xs text-slate-800',
  }
} as const;
