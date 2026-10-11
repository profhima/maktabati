import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Search, X, Package, User, Truck, Receipt, ShoppingCart } from 'lucide-react';
import { fmt } from '../lib/utils';

export const GlobalSearchModal: React.FC = () => {
  const {
    globalSearchOpen,
    closeGlobalSearch,
    db,
    goTo,
    showPrintModal,
    openInvoiceModal
  } = useApp();

  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (globalSearchOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [globalSearchOpen]);

  if (!globalSearchOpen) return null;

  const q = query.trim().toLowerCase();

  const productMatches = q
    ? (db.products || [])
        .filter(p =>
          `${p.name} ${p.barcode || ''} ${p.category || ''} ${p.institution || ''}`
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 6)
    : [];

  const customerMatches = q
    ? (db.customers || [])
        .filter(c => `${c.name} ${c.phone || ''} ${c.address || ''}`.toLowerCase().includes(q))
        .slice(0, 6)
    : [];

  const supplierMatches = q
    ? (db.suppliers || [])
        .filter(s => `${s.name} ${s.phone || ''}`.toLowerCase().includes(q))
        .slice(0, 6)
    : [];

  const invoiceMatches = q
    ? (db.invoices || [])
        .filter(i =>
          `#${i.number} ${i.number} ${i.customerName || ''} ${i.customerPhone || ''} ${i.date || ''}`
            .toLowerCase()
            .includes(q)
        )
        .slice(0, 6)
    : [];

  const purchaseMatches = q
    ? (db.purchases || [])
        .filter(p =>
          `#${p.number} ${p.number} ${p.supplierName || ''} ${p.date || ''}`.toLowerCase().includes(q)
        )
        .slice(0, 6)
    : [];

  const hasResults =
    productMatches.length > 0 ||
    customerMatches.length > 0 ||
    supplierMatches.length > 0 ||
    invoiceMatches.length > 0 ||
    purchaseMatches.length > 0;

  const handleProductClick = (p: any) => {
    closeGlobalSearch();
    goTo('inventory');
  };

  const handleInvoiceClick = (inv: any) => {
    closeGlobalSearch();
    openInvoiceModal(inv);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F2A3C]/70 backdrop-blur-xs flex items-start justify-center p-4 pt-12 animate-in fade-in duration-200"
      onClick={closeGlobalSearch}
    >
      <div
        className="bg-[#FFFDF8] border border-[#D8CBB0] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 border-b border-[#D8CBB0] flex items-center gap-3 bg-[#FAF6EE]">
          <Search className="w-5 h-5 text-[#A9762F] flex-none" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none text-base md:text-lg text-[#1F2A3C] placeholder-[#8E98A6] focus:outline-hidden"
            placeholder="اكتب اسم صنف، عميل، مورد، رقم فاتورة، أو تليفون..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && closeGlobalSearch()}
          />
          <button
            onClick={closeGlobalSearch}
            className="p-1 rounded-lg hover:bg-black/5 text-[#8E98A6] hover:text-[#1F2A3C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {!q && (
            <div className="text-center py-10 text-[#8E98A6] text-sm">
              اكتب للبحث الفوري عبر كافة أقسام النظام (الأصناف، العملاء، الموردين، الفواتير).
            </div>
          )}

          {q && !hasResults && (
            <div className="text-center py-10 text-[#8E98A6] text-sm">
              لا توجد نتائج مطابقة لـ &quot;{query}&quot;
            </div>
          )}

          {/* Products Section */}
          {productMatches.length > 0 && (
            <div>
              <div className="text-xs font-bold text-[#A9762F] flex items-center gap-1.5 mb-2">
                <Package className="w-3.5 h-3.5" />
                الأصناف ({productMatches.length})
              </div>
              <div className="space-y-1.5">
                {productMatches.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleProductClick(p)}
                    className="p-2.5 rounded-xl hover:bg-[#EFE7D6] cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-[#D8CBB0]"
                  >
                    <div>
                      <b className="text-sm text-[#1F2A3C] block">{p.name}</b>
                      <span className="text-xs text-[#8E98A6]">
                        {p.category} {p.institution ? `• ${p.institution}` : ''} {p.grade ? `• ${p.grade}` : ''}
                      </span>
                    </div>
                    <div className="text-left">
                      <b className="text-sm text-[#A9762F] block">{fmt(p.sellPrice)}</b>
                      <span className="text-xs text-[#5C7A5E]">متاح: {p.qty}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customers Section */}
          {customerMatches.length > 0 && (
            <div>
              <div className="text-xs font-bold text-[#A9762F] flex items-center gap-1.5 mb-2">
                <User className="w-3.5 h-3.5" />
                العملاء ({customerMatches.length})
              </div>
              <div className="space-y-1.5">
                {customerMatches.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      closeGlobalSearch();
                      goTo('customers');
                    }}
                    className="p-2.5 rounded-xl hover:bg-[#EFE7D6] cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-[#D8CBB0]"
                  >
                    <div>
                      <b className="text-sm text-[#1F2A3C] block">{c.name}</b>
                      <span className="text-xs text-[#8E98A6]">{c.phone || 'بدون هاتف'}</span>
                    </div>
                    <span className="text-xs font-bold text-[#5C7A5E]">
                      نقاط: {c.loyaltyPoints || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Suppliers Section */}
          {supplierMatches.length > 0 && (
            <div>
              <div className="text-xs font-bold text-[#A9762F] flex items-center gap-1.5 mb-2">
                <Truck className="w-3.5 h-3.5" />
                الموردين ({supplierMatches.length})
              </div>
              <div className="space-y-1.5">
                {supplierMatches.map(s => (
                  <div
                    key={s.id}
                    onClick={() => {
                      closeGlobalSearch();
                      goTo('suppliers');
                    }}
                    className="p-2.5 rounded-xl hover:bg-[#EFE7D6] cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-[#D8CBB0]"
                  >
                    <div>
                      <b className="text-sm text-[#1F2A3C] block">{s.name}</b>
                      <span className="text-xs text-[#8E98A6]">{s.phone || 'بدون هاتف'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invoices Section */}
          {invoiceMatches.length > 0 && (
            <div>
              <div className="text-xs font-bold text-[#A9762F] flex items-center gap-1.5 mb-2">
                <Receipt className="w-3.5 h-3.5" />
                فواتير البيع ({invoiceMatches.length})
              </div>
              <div className="space-y-1.5">
                {invoiceMatches.map(inv => (
                  <div
                    key={inv.id}
                    onClick={() => handleInvoiceClick(inv)}
                    className="p-2.5 rounded-xl hover:bg-[#EFE7D6] cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-[#D8CBB0]"
                  >
                    <div>
                      <b className="text-sm text-[#1F2A3C] block">فاتورة #{inv.number}</b>
                      <span className="text-xs text-[#8E98A6]">
                        {inv.customerName || 'عميل نقدي'} • {inv.date}
                      </span>
                    </div>
                    <b className="text-sm text-[#A9762F]">{fmt(inv.total)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Purchases Section */}
          {purchaseMatches.length > 0 && (
            <div>
              <div className="text-xs font-bold text-[#A9762F] flex items-center gap-1.5 mb-2">
                <ShoppingCart className="w-3.5 h-3.5" />
                فواتير الشراء ({purchaseMatches.length})
              </div>
              <div className="space-y-1.5">
                {purchaseMatches.map(pur => (
                  <div
                    key={pur.id}
                    onClick={() => {
                      closeGlobalSearch();
                      goTo('suppliers');
                    }}
                    className="p-2.5 rounded-xl hover:bg-[#EFE7D6] cursor-pointer flex items-center justify-between transition-colors border border-transparent hover:border-[#D8CBB0]"
                  >
                    <div>
                      <b className="text-sm text-[#1F2A3C] block">فاتورة شراء #{pur.number}</b>
                      <span className="text-xs text-[#8E98A6]">
                        المورد: {pur.supplierName || '-'} • {pur.date}
                      </span>
                    </div>
                    <b className="text-sm text-[#A9762F]">{fmt(pur.total)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
