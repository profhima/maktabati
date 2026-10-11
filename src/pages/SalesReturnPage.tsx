import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import { fmt, todayStr, uid, stockMovementId, productFullName } from '../lib/utils';
import { expandReturnsToPhysicalItems, expandItemsToPhysicalDeductions } from '../lib/bundles';
import { RotateCcw, Search, ArrowRightLeft, DollarSign, AlertCircle, CheckCircle2 } from 'lucide-react';

export const SalesReturnPage: React.FC = () => {
  const {
    db,
    returnInvoice,
    setReturnInvoice,
    returnSelections,
    setReturnSelections,
    exchangeItems,
    setExchangeItems,
    returnMode,
    setReturnMode,
    clearReturnState,
    goTo,
    toast
  } = useApp();

  const [searchNumber, setSearchNumber] = useState('');
  const [searchCustomer, setSearchCustomer] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Replacement item picker
  const [exSearch, setExSearch] = useState('');
  const [selectedExProduct, setSelectedExProduct] = useState<any | null>(null);
  const [exQty, setExQty] = useState(1);
  const [saving, setSaving] = useState(false);

  const handleSearchInvoices = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const num = searchNumber.trim();
    const name = searchCustomer.trim().toLowerCase();
    const phone = searchPhone.trim();

    if (!num && !name && !phone) {
      toast('أدخل رقم الفاتورة أو اسم العميل أو الهاتف');
      return;
    }

    const matches = (db.invoices || []).filter(inv => {
      const okNum = !num || String(inv.number) === num;
      const okName = !name || (inv.customerName || '').toLowerCase().includes(name);
      const okPhone = !phone || (inv.customerPhone || '').includes(phone);
      return okNum && okName && okPhone;
    }).sort((a, b) => b.number - a.number);

    setSearchResults(matches);
    if (!matches.length) {
      toast('لم يتم العثور على فواتير مطابقة');
    } else if (matches.length === 1) {
      selectInvoice(matches[0]);
    }
  };

  const selectInvoice = (inv: any) => {
    setReturnInvoice(inv);
    setReturnSelections({});
    setExchangeItems([]);
    setReturnMode('cash');
    setSearchResults([]);
  };

  const getReturnRecordsForInvoice = (invoiceId: string) => {
    return (db.salesReturns || []).filter(r => r.invoiceId === invoiceId);
  };

  const getReturnedQty = (invoiceId: string, productId: string) => {
    return getReturnRecordsForInvoice(invoiceId).reduce(
      (sum, r) =>
        sum +
        (r.items || [])
          .filter((it: any) => String(it.productId) === String(productId))
          .reduce((s: number, it: any) => s + (Number(it.qty) || 0), 0),
      0
    );
  };

  const getReturnableItems = (inv: any) => {
    const records = getReturnRecordsForInvoice(inv.id);
    const byProduct = new Map<string, any>();

    const addLayer = (it: any, source: 'original' | 'replacement') => {
      if (!it || !it.productId) return;
      const key = String(it.productId);
      const q = Math.max(0, Number(it.qty) || 0);
      if (!q) return;
      const existing = byProduct.get(key);
      if (existing) {
        existing.qty += q;
        if (existing.source === 'replacement' && source === 'original') {
          Object.assign(existing, {
            name: it.name || existing.name,
            price: Number(it.price) || 0,
            cost: Number(it.cost) || 0,
            term: it.term || existing.term,
            source: 'original'
          });
        }
      } else {
        byProduct.set(key, {
          productId: it.productId,
          name: String(it.name || ''),
          qty: q,
          price: Number(it.price) || 0,
          cost: Number(it.cost) || 0,
          term: String(it.term || ''),
          source
        });
      }
    };

    (inv.items || []).forEach((it: any) => addLayer(it, 'original'));
    records.forEach(r => (r.replacementItems || []).forEach((it: any) => addLayer(it, 'replacement')));

    return Array.from(byProduct.values())
      .map(it => {
        const returned = getReturnedQty(inv.id, it.productId);
        const returnable = Math.max(0, it.qty - returned);
        return {
          ...it,
          returnKey: `p:${it.productId}`,
          returned,
          returnable
        };
      })
      .filter(it => it.returnable > 0);
  };

  const returnableRows = returnInvoice ? getReturnableItems(returnInvoice) : [];

  const selectedItems = returnableRows
    .filter(it => (returnSelections[it.returnKey] || 0) > 0)
    .map(it => ({ ...it, qty: returnSelections[it.returnKey] }));

  // Financial calculations for return
  const grossReturn = selectedItems.reduce((s, it) => s + it.qty * it.price, 0);
  const invoiceGross =
    (returnInvoice?.items || []).reduce((s: number, it: any) => s + it.qty * it.price, 0) || 1;
  const allocatedDiscount = Math.min(
    returnInvoice?.discount || 0,
    ((returnInvoice?.discount || 0) * grossReturn) / invoiceGross
  );
  const allocatedPoints = Math.min(
    Math.max(0, grossReturn - allocatedDiscount),
    ((returnInvoice?.usedPoints || 0) * grossReturn) / invoiceGross
  );
  const netReturn = Math.max(0, grossReturn - allocatedDiscount - allocatedPoints);

  const replacementTotal = exchangeItems.reduce((s, it) => s + it.qty * it.price, 0);
  const exchangeDifference = replacementTotal - netReturn;

  const priorReturns = returnInvoice ? getReturnRecordsForInvoice(returnInvoice.id) : [];
  const priorCashOut = priorReturns.reduce((s, r) => s + (r.cashOut || 0), 0);
  const paidAtSale = returnInvoice?.paidAmount ?? returnInvoice?.total ?? 0;
  const cashRefund = Math.min(netReturn, Math.max(0, paidAtSale - priorCashOut));
  const creditReduction = Math.max(0, netReturn - cashRefund);

  const cashOut = returnMode === 'exchange' && exchangeDifference < 0 ? Math.abs(exchangeDifference) : returnMode === 'cash' ? cashRefund : 0;
  const cashIn = returnMode === 'exchange' && exchangeDifference > 0 ? exchangeDifference : 0;

  // Add Replacement Item
  const handleAddReplacement = () => {
    if (!selectedExProduct) {
      toast('اختر صنفاً بديلاً من نتائج البحث أولاً');
      return;
    }
    const p = selectedExProduct;
    if (exQty > p.qty) {
      toast(`المتاح بالمخزون من "${p.name}" هو ${p.qty} فقط`);
      return;
    }

    setExchangeItems(prev => {
      const idx = prev.findIndex(x => x.productId === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + exQty };
        return next;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: productFullName(p),
          qty: exQty,
          price: p.sellPrice,
          cost: p.costPrice,
          term: p.term || '',
          source: 'replacement'
        }
      ];
    });

    setSelectedExProduct(null);
    setExSearch('');
    setExQty(1);
    toast(`تمت إضافة البديل "${p.name}" × ${exQty}`);
  };

  const handleSaveReturn = async () => {
    if (!returnInvoice) return;
    if (!selectedItems.length) {
      toast('حدد كمية مرتجعة واحدة على الأقل');
      return;
    }
    if (returnMode === 'exchange' && !exchangeItems.length) {
      toast('أضف صنفاً بديلاً واحداً على الأقل للتبديل');
      return;
    }

    setSaving(true);
    const operationId = uid();
    const returnId = uid();
    const actor = auditActor();

    try {
      const counterRef = fsdb.collection('meta').doc('counters');
      const opRef = fsdb.collection('operationKeys').doc(operationId);
      const returnRef = fsdb.collection('salesReturns').doc(returnId);
      const invoiceRef = fsdb.collection('invoices').doc(returnInvoice.id);
      const customerRef = returnInvoice.customerId ? fsdb.collection('customers').doc(returnInvoice.customerId) : null;

      // Expand returns to physical products
      const physicalReturnItems = expandReturnsToPhysicalItems(selectedItems, db.products);
      // Expand replacements to physical product deductions
      const physicalExchangeItems = returnMode === 'exchange'
        ? expandItemsToPhysicalDeductions(exchangeItems, db.products)
        : [];

      const stockDelta: Record<string, number> = {};
      physicalReturnItems.forEach(it => {
        stockDelta[it.productId] = (stockDelta[it.productId] || 0) + Number(it.qty);
      });
      physicalExchangeItems.forEach(it => {
        stockDelta[it.productId] = (stockDelta[it.productId] || 0) - Number(it.qty);
      });

      const productIds = Object.keys(stockDelta);
      const productRefs = productIds.map(id => fsdb.collection('products').doc(id));

      await fsdb.runTransaction(async tx => {
        const reads = await Promise.all([
          tx.get(opRef),
          tx.get(counterRef),
          tx.get(returnRef),
          tx.get(invoiceRef),
          ...(customerRef ? [tx.get(customerRef)] : []),
          ...productRefs.map(ref => tx.get(ref))
        ]);

        const opSnap = reads[0];
        const counterSnap = reads[1];
        if (opSnap.exists) throw new Error('معرف العملية مكرر');

        const counterData = counterSnap.exists ? counterSnap.data() || {} : {};
        const number = (Number(counterData.salesReturn) || 0) + 1;

        const customerSnap = customerRef ? reads[4] : null;
        const productOffset = customerRef ? 5 : 4;
        const productSnaps = reads.slice(productOffset);

        const stockMap: Record<string, any> = {};
        productRefs.forEach((ref, idx) => {
          stockMap[ref.id] = productSnaps[idx];
        });

        // Stock integrity check for exchange items
        for (const [pid, delta] of Object.entries(stockDelta)) {
          const snap = stockMap[pid];
          if (!snap || !snap.exists) throw new Error('صنف غير مسجل بقاعدة البيانات');
          const currentQty = Number(snap.data().qty) || 0;
          if (currentQty + delta < 0) {
            throw new Error(`المخزون غير كافٍ للصنف البديل: ${snap.data().name}`);
          }
        }

        // Customer Balance update
        if (customerRef && customerSnap?.exists) {
          const curBal = customerSnap.data().balance || { invoiced: 0, paid: 0 };
          const newInvoiced = (Number(curBal.invoiced) || 0) - creditReduction;
          tx.update(customerRef, {
            balance: { invoiced: newInvoiced, paid: curBal.paid, updatedAt: new Date().toISOString() }
          });
        }

        // Update Products & Stock Movements
        const movementRunning: Record<string, number> = {};
        productIds.forEach(id => {
          movementRunning[id] = Number(stockMap[id].data().qty) || 0;
        });

        physicalReturnItems.forEach((it, idx) => {
          const snap = stockMap[it.productId];
          const before = movementRunning[it.productId] || 0;
          const after = before + it.qty;
          movementRunning[it.productId] = after;

          tx.update(fsdb.collection('products').doc(it.productId), {
            qty: after,
            lastOperationId: operationId,
            lastOperationType: 'salesReturn',
            lastOperationActorUid: actor.uid
          });

          const mid = stockMovementId(operationId, it.productId, `return_${idx}`);
          const note = it.isBundleComponent && it.bundleName
            ? `مرتجع بيع — إعادة مكون باقة (${it.bundleName}) للمخزون`
            : 'مرتجع بيع — إعادة للمخزون';

          tx.set(fsdb.collection('stockMovements').doc(mid), {
            id: mid,
            date: todayStr(),
            createdAt: new Date().toISOString(),
            type: 'return',
            productId: it.productId,
            productName: it.name,
            barcode: snap?.data()?.barcode || '',
            qtyBefore: before,
            delta: it.qty,
            qtyAfter: after,
            referenceId: returnId,
            referenceNumber: number,
            note,
            operationId,
            actorUid: actor.uid,
            createdBy: actor.uid
          });
        });

        if (returnMode === 'exchange') {
          physicalExchangeItems.forEach((it, idx) => {
            const snap = stockMap[it.productId];
            const before = movementRunning[it.productId] || 0;
            const after = before - it.qty;
            movementRunning[it.productId] = after;

            tx.update(fsdb.collection('products').doc(it.productId), {
              qty: after,
              lastOperationId: operationId,
              lastOperationType: 'salesReturn',
              lastOperationActorUid: actor.uid
            });

            const mid = stockMovementId(operationId, it.productId, `exchange_out_${idx}`);
            const note = it.isBundleComponent && it.bundleName
              ? `تبديل بيع — خروج مكون باقة (${it.bundleName})`
              : 'تبديل بيع — خروج الصنف البديل';

            tx.set(fsdb.collection('stockMovements').doc(mid), {
              id: mid,
              date: todayStr(),
              createdAt: new Date().toISOString(),
              type: 'exchange_out',
              productId: it.productId,
              productName: it.name,
              barcode: snap?.data()?.barcode || '',
              qtyBefore: before,
              delta: -it.qty,
              qtyAfter: after,
              referenceId: returnId,
              referenceNumber: number,
              note,
              operationId,
              actorUid: actor.uid,
              createdBy: actor.uid
            });
          });
        }

        const costReturned = selectedItems.reduce((s, it) => s + it.qty * it.cost, 0);
        const costReplacement = exchangeItems.reduce((s, it) => s + it.qty * it.cost, 0);
        const profitImpact = (netReturn - costReturned) - (replacementTotal - costReplacement);

        const record = {
          id: returnId,
          number,
          date: todayStr(),
          invoiceId: returnInvoice.id,
          invoiceNumber: returnInvoice.number,
          customerId: returnInvoice.customerId || null,
          customerName: returnInvoice.customerName || 'عميل نقدي',
          customerPhone: returnInvoice.customerPhone || '',
          mode: returnMode,
          items: selectedItems,
          returnGross: grossReturn,
          allocatedDiscount,
          allocatedPoints,
          netReturn,
          cashOut,
          cashIn,
          creditReduction,
          replacementItems: exchangeItems,
          replacementTotal,
          exchangeDifference,
          profitImpact,
          createdAt: new Date().toISOString(),
          operationId,
          actorUid: actor.uid,
          createdBy: actor.uid
        };

        tx.set(counterRef, { salesReturn: number }, { merge: true });
        tx.set(returnRef, record);
        tx.set(opRef, {
          id: operationId,
          type: 'salesReturn',
          targetId: returnId,
          number,
          createdAt: new Date().toISOString(),
          actorUid: actor.uid,
          createdBy: actor.uid
        });
      });

      toast(`✅ تم تسجيل ${returnMode === 'exchange' ? 'عملية التبديل' : 'مرتجع البيع'} #${returnId.slice(0, 6)} بنجاح`);
      clearReturnState();
      goTo('dashboard');
    } catch (err: any) {
      toast(`⚠️ خطأ أثناء حفظ المرتجع: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const matchingExProducts = exSearch.trim()
    ? (db.products || [])
        .filter(p =>
          `${productFullName(p)} ${p.barcode || ''}`.toLowerCase().includes(exSearch.trim().toLowerCase())
        )
        .slice(0, 8)
    : [];

  return (
    <div className="space-y-4">
      {/* 1. Search Invoice Bar */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
        <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] mb-3 flex items-center gap-2">
          <Search className="w-4 h-4 text-[#A9762F]" />
          1️⃣ البحث عن فاتورة البيع الأصلية
        </h3>

        <form onSubmit={handleSearchInvoices} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">رقم الفاتورة</label>
            <input
              type="number"
              className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#A9762F]/40"
              placeholder="مثال: 105"
              value={searchNumber}
              onChange={e => setSearchNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">اسم العميل</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#A9762F]/40"
              placeholder="ابحث باسم العميل..."
              value={searchCustomer}
              onChange={e => setSearchCustomer(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">رقم الهاتف</label>
            <input
              type="tel"
              className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#A9762F]/40"
              placeholder="رقم هاتف العميل..."
              value={searchPhone}
              onChange={e => setSearchPhone(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3 flex gap-2">
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs md:text-sm transition-colors"
            >
              🔍 بحث عن الفاتورة
            </button>
            <button
              type="button"
              onClick={clearReturnState}
              className="px-4 py-2 rounded-xl bg-[#EFE7D6] hover:bg-[#e4d9bd] text-[#1F2A3C] font-semibold text-xs transition-colors"
            >
              مسح وتفريغ
            </button>
          </div>
        </form>

        {/* Results dropdown */}
        {searchResults.length > 0 && (
          <div className="mt-3 divide-y divide-[#EFE7D6] border border-[#D8CBB0] rounded-xl overflow-hidden bg-[#FAF6EE]">
            {searchResults.map(inv => (
              <div
                key={inv.id}
                onClick={() => selectInvoice(inv)}
                className="p-3 hover:bg-[#EFE7D6] cursor-pointer flex items-center justify-between text-xs"
              >
                <div>
                  <b className="text-sm">فاتورة #{inv.number}</b>
                  <span className="text-[#8E98A6] mr-2">{inv.customerName || 'عميل نقدي'}</span>
                </div>
                <div className="text-left font-mono">
                  <b>{fmt(inv.total)} ج</b>
                  <span className="text-[11px] text-[#8E98A6] block">{inv.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Selected Invoice Banner */}
        {returnInvoice && (
          <div className="mt-4 p-3.5 rounded-xl bg-[#FAF6EE] border border-[#A9762F]/30 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div><span className="text-[#8E98A6] block">الفاتورة:</span><b>#{returnInvoice.number}</b></div>
            <div><span className="text-[#8E98A6] block">التاريخ:</span><b>{returnInvoice.date}</b></div>
            <div><span className="text-[#8E98A6] block">العميل:</span><b>{returnInvoice.customerName || 'عميل نقدي'}</b></div>
            <div><span className="text-[#8E98A6] block">الإجمالي:</span><b>{fmt(returnInvoice.total)} ج</b></div>
          </div>
        )}
      </div>

      {/* 2. Return Items and Operation Mode */}
      {returnInvoice && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Items to return table (7 Cols) */}
          <div className="lg:col-span-7 p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
            <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] mb-3">
              2️⃣ حدد الأصناف والكميات المراد إرجاعها
            </h3>

            {returnableRows.length > 0 ? (
              <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl">
                <table className="w-full text-xs text-right">
                  <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
                    <tr>
                      <th className="p-2.5">الصنف</th>
                      <th className="p-2.5 text-center">سعر البيع</th>
                      <th className="p-2.5 text-center">المباع</th>
                      <th className="p-2.5 text-center">مرتجع سابق</th>
                      <th className="p-2.5 text-center">المرتجع الآن</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE7D6]">
                    {returnableRows.map(it => (
                      <tr key={it.returnKey} className="hover:bg-[#FAF6EE]">
                        <td className="p-2.5">
                          <b>{it.name}</b>
                          {it.source === 'replacement' && (
                            <span className="text-[10px] text-[#A9762F] block">🔄 صنف بديل سابق</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono">{fmt(it.price)}</td>
                        <td className="p-2.5 text-center font-bold">{it.qty}</td>
                        <td className="p-2.5 text-center text-[#8E98A6]">{it.returned}</td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max={it.returnable}
                            className="w-16 px-2 py-1 text-xs border border-[#D8CBB0] rounded-lg text-center font-bold bg-white"
                            value={returnSelections[it.returnKey] || 0}
                            onChange={e => {
                              const val = Math.min(it.returnable, Math.max(0, parseInt(e.target.value) || 0));
                              setReturnSelections(prev => ({
                                ...prev,
                                [it.returnKey]: val
                              }));
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-[#8E98A6] text-xs">
                لا توجد كميات قابلة للإرجاع من هذه الفاتورة
              </div>
            )}
          </div>

          {/* Operation Mode (Cash vs Exchange) (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
              <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] mb-3">
                3️⃣ نوع العملية
              </h3>

              {/* Mode Selector */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setReturnMode('cash')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    returnMode === 'cash'
                      ? 'bg-[#FBF3E1] border-2 border-[#A9762F] font-bold text-[#A9762F] shadow-xs'
                      : 'bg-[#FFFDF8] border-[#D8CBB0] text-[#1F2A3C]'
                  }`}
                >
                  <DollarSign className="w-5 h-5 mx-auto mb-1 text-[#A9762F]" />
                  مرتجع نقدي
                  <span className="block text-[10px] text-[#8E98A6] font-normal">رد القيمة للعميل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setReturnMode('exchange')}
                  className={`p-3 rounded-xl border text-center transition-all ${
                    returnMode === 'exchange'
                      ? 'bg-[#FBF3E1] border-2 border-[#A9762F] font-bold text-[#A9762F] shadow-xs'
                      : 'bg-[#FFFDF8] border-[#D8CBB0] text-[#1F2A3C]'
                  }`}
                >
                  <ArrowRightLeft className="w-5 h-5 mx-auto mb-1 text-[#A9762F]" />
                  تبديل صنف
                  <span className="block text-[10px] text-[#8E98A6] font-normal">استبدال بمنتج آخر</span>
                </button>
              </div>

              {/* Exchange Add Panel */}
              {returnMode === 'exchange' && (
                <div className="space-y-2 p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0] mb-4">
                  <label className="block text-xs font-bold text-[#3A4A63]">اختر الصنف البديل</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-xs bg-[#FFFDF8] border border-[#D8CBB0] rounded-lg"
                      placeholder="ابحث عن الصنف البديل..."
                      value={exSearch}
                      onChange={e => setExSearch(e.target.value)}
                    />
                    {exSearch.trim() && matchingExProducts.length > 0 && (
                      <div className="absolute top-full right-0 left-0 z-30 mt-1 bg-[#FFFDF8] border border-[#D8CBB0] rounded-xl shadow-xl max-h-40 overflow-y-auto divide-y divide-[#EFE7D6]">
                        {matchingExProducts.map(p => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedExProduct(p);
                              setExSearch(productFullName(p));
                            }}
                            className="p-2 hover:bg-[#EFE7D6] cursor-pointer flex justify-between text-xs"
                          >
                            <span>{p.name}</span>
                            <b>{fmt(p.sellPrice)} ج (متاح: {p.qty})</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      className="w-20 px-2 py-1.5 text-xs bg-[#FFFDF8] border border-[#D8CBB0] rounded-lg text-center font-bold"
                      value={exQty}
                      onChange={e => setExQty(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                    <button
                      type="button"
                      onClick={handleAddReplacement}
                      className="flex-1 py-1.5 rounded-lg bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs"
                    >
                      ➕ إضافة البديل
                    </button>
                  </div>

                  {exchangeItems.length > 0 && (
                    <div className="mt-2 divide-y divide-[#D8CBB0] text-xs">
                      {exchangeItems.map((it, idx) => (
                        <div key={idx} className="py-1.5 flex justify-between items-center">
                          <span>{it.name} × {it.qty}</span>
                          <span className="font-bold font-mono">{fmt(it.qty * it.price)} ج</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Financial Calculations Box */}
              <div className="p-3 rounded-xl bg-[#FAF6EE] border border-[#D8CBB0] space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8E98A6]">قيمة الأصناف المرتجعة:</span>
                  <span className="font-mono">{fmt(grossReturn)}</span>
                </div>
                {allocatedDiscount > 0 && (
                  <div className="flex justify-between text-[#A8503A]">
                    <span>خصم موزع على المرتجع:</span>
                    <span className="font-mono">-{fmt(allocatedDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-[#A9762F] pt-1.5 border-t border-[#D8CBB0]">
                  <span>صافي قيمة المرتجع:</span>
                  <span className="font-mono">{fmt(netReturn)} ج</span>
                </div>

                {returnMode === 'cash' ? (
                  <>
                    <div className="flex justify-between text-[#5C7A5E] font-bold">
                      <span>يُرد نقدًا للعميل:</span>
                      <span className="font-mono">{fmt(cashRefund)} ج</span>
                    </div>
                    {creditReduction > 0 && (
                      <div className="flex justify-between text-[#A8503A]">
                        <span>تخفيض مديونية العميل:</span>
                        <span className="font-mono">-{fmt(creditReduction)} ج</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>إجمالي البدائل:</span>
                      <span className="font-mono">{fmt(replacementTotal)} ج</span>
                    </div>
                    <div className="flex justify-between font-bold pt-1 border-t border-[#D8CBB0]">
                      <span>{exchangeDifference > 0 ? 'مطلوب من العميل:' : 'يرد للعميل نقدًا:'}</span>
                      <span className="font-mono">{fmt(Math.abs(exchangeDifference))} ج</span>
                    </div>
                  </>
                )}
              </div>

              {/* Submit Return Button */}
              <button
                disabled={saving || !selectedItems.length}
                onClick={handleSaveReturn}
                className="w-full mt-4 py-3 rounded-xl bg-[#A8503A] hover:bg-[#8e4130] text-white font-bold text-sm shadow-md transition-all disabled:opacity-50"
              >
                {saving ? 'جاري التنفيذ...' : '✓ تأكيد العملية وتحديث المخزون والمالية'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
