import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import { fmt, uid, todayStr } from '../lib/utils';
import { SupplierPayment } from '../types';
import { Truck, Plus, Phone, Search } from 'lucide-react';
import { isNetworkOrTransientError, OfflineSyncManager } from '../lib/offlineSync';
import { resolveClosedDayDates } from '../lib/businessCalendar';

export const SuppliersPage: React.FC = () => {
  const { db, toast } = useApp();

  const [searchQ, setSearchQ] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCompany, setNewCompany] = useState('');

  const [activeSupplier, setActiveSupplier] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const isSubmittingPaymentRef = useRef(false);

  // Modal lifecycle handlers for stable Payment Intent identity (BR-07)
  const handleOpenSupplierModal = (s: any) => {
    setActiveSupplier(s);
    setPaymentAmount('');
    let intentId = '';
    try {
      intentId = sessionStorage.getItem('maktabati_supp_intent_' + s.id) || '';
    } catch {}
    if (!intentId) {
      intentId = uid();
      try {
        sessionStorage.setItem('maktabati_supp_intent_' + s.id, intentId);
      } catch {}
    }
    setPaymentIntentId(intentId);
    isSubmittingPaymentRef.current = false;
  };

  const handleCloseSupplierModal = () => {
    if (activeSupplier) {
      try {
        sessionStorage.removeItem('maktabati_supp_intent_' + activeSupplier.id);
      } catch {}
    }
    setActiveSupplier(null);
    setPaymentAmount('');
    setPaymentIntentId(null);
    isSubmittingPaymentRef.current = false;
  };

  const suppliers = (db.suppliers || []).filter(s => {
    const hay = `${s.name} ${s.phone || ''} ${s.company || ''}`.toLowerCase();
    return hay.includes(searchQ.trim().toLowerCase());
  });

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast('أدخل اسم المورد');
      return;
    }

    const actor = auditActor();
    const supplier = {
      id: uid(),
      name: newName.trim(),
      phone: newPhone.trim(),
      company: newCompany.trim(),
      balance: { invoiced: 0, paid: 0, updatedAt: new Date().toISOString() },
      createdBy: actor.uid,
      actorUid: actor.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await fsdb.collection('suppliers').doc(supplier.id).set(supplier);
      toast(`تمت إضافة المورد "${supplier.name}" بنجاح`);
      setNewName('');
      setNewPhone('');
      setNewCompany('');
    } catch (err: any) {
      toast(`خطأ: ${err.message}`);
    }
  };

  const handlePaySupplier = async () => {
    // Synchronous guard against rapid double-clicks
    if (isSubmittingPaymentRef.current || savingPayment) {
      return;
    }

    if (!activeSupplier || !paymentAmount || paymentAmount <= 0) {
      toast('أدخل مبلغ السداد بشكل صحيح');
      return;
    }

    isSubmittingPaymentRef.current = true;
    setSavingPayment(true);

    const paymentId = paymentIntentId || uid();
    if (!paymentIntentId) {
      setPaymentIntentId(paymentId);
    }

    const actor = auditActor();
    const opId = 'op_supp_pay_' + paymentId;
    const supplierRef = fsdb.collection('suppliers').doc(activeSupplier.id);
    const paymentRef = fsdb.collection('supplierPayments').doc(paymentId);
    const opRef = fsdb.collection('operationKeys').doc(opId);

    // Resolve Closed-Day & Business Calendar Date Model
    const dates = resolveClosedDayDates(
      todayStr(),
      (db.dailyClosings || []).map(c => c.date),
      (db as any).businessCalendarVersions || []
    );

    const paymentRecord: SupplierPayment = {
      id: paymentId,
      supplierId: activeSupplier.id,
      supplierName: activeSupplier.name,
      amount: Number(paymentAmount),
      date: todayStr(),
      operationId: opId,
      originalEventDate: dates.originalEventDate,
      statementDate: dates.statementDate,
      actualCashDate: dates.actualCashDate,
      postingDate: dates.postingDate,
      effectiveCashDate: dates.effectiveCashDate,
      isLatePosting: dates.isLatePosting,
      closedDate: dates.closedDate,
      actorUid: actor.uid,
      createdBy: actor.uid,
      createdAt: new Date().toISOString()
    };

    // Offline upfront check
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      OfflineSyncManager.enqueueSupplierPayment(paymentRecord);
      toast(`💾 تم حفظ السداد أوفلاين للمورد ${activeSupplier.name} بقيمة ${fmt(Number(paymentAmount))} ج (سيتم المزامنة تلقائياً)`);
      handleCloseSupplierModal();
      isSubmittingPaymentRef.current = false;
      setSavingPayment(false);
      return;
    }

    try {
      await fsdb.runTransaction(async tx => {
        const [opSnap, supplierSnap] = await Promise.all([
          tx.get(opRef),
          tx.get(supplierRef)
        ]);

        if (opSnap.exists) {
          // Idempotency: operation already committed, abort duplicate execution safely
          return;
        }

        if (!supplierSnap.exists) throw new Error('المورد غير مسجل');
        const bal = supplierSnap.data().balance || { invoiced: 0, paid: 0 };
        const newPaid = (Number(bal.paid) || 0) + Number(paymentAmount);

        tx.update(supplierRef, {
          balance: {
            invoiced: bal.invoiced || 0,
            paid: newPaid,
            updatedAt: new Date().toISOString()
          }
        });

        tx.set(paymentRef, paymentRecord);
        tx.set(opRef, {
          id: opId,
          type: 'supplier_payment',
          targetId: paymentId,
          supplierId: activeSupplier.id,
          amount: Number(paymentAmount),
          date: todayStr(),
          originalEventDate: dates.originalEventDate,
          postingDate: dates.postingDate,
          effectiveCashDate: dates.effectiveCashDate,
          actorUid: actor.uid,
          createdBy: actor.uid,
          createdAt: new Date().toISOString()
        });
      });

      toast(`✅ تم تسجيل سداد ${fmt(Number(paymentAmount))} ج للمورد ${activeSupplier.name}`);
      handleCloseSupplierModal();
    } catch (err: any) {
      if (isNetworkOrTransientError(err)) {
        OfflineSyncManager.enqueueSupplierPayment(paymentRecord);
        toast(`💾 انقطع الاتصال - تم حفظ السداد أوفلاين بقيمة ${fmt(Number(paymentAmount))} ج`);
        handleCloseSupplierModal();
      } else {
        toast(`خطأ: ${err.message}`);
      }
    } finally {
      isSubmittingPaymentRef.current = false;
      setSavingPayment(false);
    }
  };

  const supplierPurchases = activeSupplier
    ? (db.purchases || []).filter(p => p.supplierId === activeSupplier.id)
    : [];

  const supplierReturns = activeSupplier
    ? ((db as any).purchaseReturns || []).filter((pr: any) => pr.supplierId === activeSupplier.id)
    : [];

  const supplierDirectPayments = activeSupplier
    ? (db.supplierPayments || []).filter(sp => sp.supplierId === activeSupplier.id)
    : [];

  const supplierLedgerEntries = activeSupplier
    ? [
        ...supplierPurchases.map(p => ({
          id: p.id,
          date: p.date,
          label: `فاتورة توريد #${p.number}`,
          type: 'purchase' as const,
          invoicedDelta: Number(p.total) || 0,
          paidDelta: Number(p.paidAmount ?? p.total) || 0,
          note: '-'
        })),
        ...supplierReturns.map((pr: any) => ({
          id: pr.id,
          date: pr.originalEventDate || pr.statementDate || pr.postingDate || pr.date,
          label: `مرتجع مشتريات #${pr.number || pr.id.slice(0, 6)}`,
          type: 'return' as const,
          invoicedDelta: -(Number(pr.totalRefund) || 0),
          paidDelta: 0,
          note: pr.refundMethod === 'cash' ? 'استرداد نقدي للخزينة' : 'خصم من رصيد المورد الآجل'
        })),
        ...supplierDirectPayments.map(sp => ({
          id: sp.id,
          date: sp.date,
          label: 'سداد دفعة نقدية',
          type: 'payment' as const,
          invoicedDelta: 0,
          paidDelta: Number(sp.amount) || 0,
          note: sp.note || '-'
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  return (
    <div className="space-y-4">
      {/* 1. Add Supplier Form */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
        <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#A9762F]" />
          إضافة مورد جديد
        </h3>

        <form onSubmit={handleAddSupplier} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">اسم المورد / المسؤول *</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
              placeholder="اسم المورد..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">اسم دار النشر / الشركة</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
              placeholder="مثال: دار المعارف"
              value={newCompany}
              onChange={e => setNewCompany(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">رقم الهاتف</label>
            <input
              type="tel"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden font-mono"
              placeholder="011..."
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
            />
          </div>

          <div className="sm:col-span-3">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs md:text-sm shadow-xs transition-colors"
            >
              ➕ حفظ المورد
            </button>
          </div>
        </form>
      </div>

      {/* 2. Suppliers List */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#EFE7D6]">
          <h3 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
            <Truck className="w-5 h-5 text-[#A9762F]" />
            سجل الموردين ودور النشر ({suppliers.length})
          </h3>

          <div className="w-full sm:w-72 relative">
            <input
              type="text"
              className="w-full px-3 py-2 pr-8 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              placeholder="بحث بالاسم أو الشركة..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <Search className="w-3.5 h-3.5 text-[#8E98A6] absolute top-2.5 right-2.5" />
          </div>
        </div>

        {/* Suppliers Table */}
        <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
              <tr>
                <th className="p-2.5">المورد</th>
                <th className="p-2.5">الشركة</th>
                <th className="p-2.5">الهاتف</th>
                <th className="p-2.5 text-center">إجمالي التوريدات (صافي)</th>
                <th className="p-2.5 text-center">المسدد له</th>
                <th className="p-2.5 text-center">الموقف المالي / المستحق</th>
                <th className="p-2.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7D6]">
              {suppliers.length > 0 ? (
                suppliers.map(s => {
                  const bal = s.balance || { invoiced: 0, paid: 0 };
                  const netDue = (bal.invoiced || 0) - (bal.paid || 0);
                  return (
                    <tr key={s.id} className="hover:bg-[#FAF6EE]">
                      <td className="p-2.5 font-bold">{s.name}</td>
                      <td className="p-2.5 text-[#8E98A6]">{s.company || '-'}</td>
                      <td className="p-2.5 font-mono text-[#8E98A6]">{s.phone || '-'}</td>
                      <td className="p-2.5 text-center font-mono">{fmt(bal.invoiced || 0)}</td>
                      <td className="p-2.5 text-center font-mono text-[#5C7A5E]">{fmt(bal.paid || 0)}</td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        {netDue > 0 ? (
                          <span className="text-[#A8503A]">{fmt(netDue)} ج (مستحق)</span>
                        ) : netDue < 0 ? (
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                            {fmt(Math.abs(netDue))} ج (دائن لصالحنا)
                          </span>
                        ) : (
                          <span className="text-[#5C7A5E]">0 ج (متزن)</span>
                        )}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleOpenSupplierModal(s)}
                          className="px-3 py-1 bg-[#EFE7D6] hover:bg-[#A9762F] hover:text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          كشف الحساب والسداد
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#8E98A6]">
                    لا يوجد موردون مسجلون
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Supplier Ledger Modal */}
      {activeSupplier && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border border-[#D8CBB0] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-[#EFE7D6]">
              <div>
                <h3 className="font-serif font-bold text-base text-[#1F2A3C]">
                  🚚 كشف حساب مورد: {activeSupplier.name}
                </h3>
                <span className="text-xs text-[#8E98A6]">{activeSupplier.company || 'بدون شركة'}</span>
              </div>
              <button
                onClick={handleCloseSupplierModal}
                className="w-7 h-7 rounded-full bg-[#EFE7D6] hover:bg-[#D8CBB0] font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Balances */}
            {(() => {
              const curBal = activeSupplier.balance || { invoiced: 0, paid: 0 };
              const curNet = (curBal.invoiced || 0) - (curBal.paid || 0);
              return (
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
                    <span className="text-[#8E98A6] block">إجمالي التوريدات (صافي)</span>
                    <b className="text-sm font-mono">{fmt(curBal.invoiced || 0)} ج</b>
                  </div>
                  <div className="p-2 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
                    <span className="text-[#8E98A6] block">المسدد له</span>
                    <b className="text-sm font-mono text-[#5C7A5E]">{fmt(curBal.paid || 0)} ج</b>
                  </div>
                  <div className="p-2 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
                    <span className="text-[#8E98A6] block">الموقف المالي النهائي</span>
                    <b className={`text-sm font-mono ${curNet > 0 ? 'text-[#A8503A]' : curNet < 0 ? 'text-blue-700' : 'text-[#5C7A5E]'}`}>
                      {curNet > 0
                        ? `${fmt(curNet)} ج (مستحق للمورد)`
                        : curNet < 0
                        ? `${fmt(Math.abs(curNet))} ج (رصيد دائن لصالحنا)`
                        : '0 ج (الحساب متزن)'}
                    </b>
                  </div>
                </div>
              );
            })()}

            {/* Payment Dispatch Form */}
            <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0] space-y-2">
              <b className="text-xs text-[#1F2A3C] block">صرف دفعة نقدية للمورد:</b>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="flex-1 px-3 py-2 text-xs bg-white border border-[#D8CBB0] rounded-xl font-mono font-bold"
                  placeholder="المبلغ المسدد..."
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(parseFloat(e.target.value) || '')}
                />
                <button
                  disabled={savingPayment}
                  onClick={handlePaySupplier}
                  className="px-4 py-2 bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {savingPayment ? 'جاري...' : 'تسجيل الصرف'}
                </button>
              </div>
            </div>

            {/* Comprehensive Ledger Movements List */}
            <div>
              <b className="text-xs text-[#1F2A3C] block mb-2">سجل حركات كشف الحساب (توريدات، مرتجعات، وسدادات):</b>
              <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl max-h-56">
                <table className="w-full text-xs text-right">
                  <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C] sticky top-0">
                    <tr>
                      <th className="p-2">الحركة</th>
                      <th className="p-2">التاريخ</th>
                      <th className="p-2 text-center">أثر التوريد (المشتريات)</th>
                      <th className="p-2 text-center">المسدد (المدفوع)</th>
                      <th className="p-2">البيان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE7D6]">
                    {supplierLedgerEntries.length > 0 ? (
                      supplierLedgerEntries.map(entry => (
                        <tr key={entry.id} className="hover:bg-[#FAF6EE]">
                          <td className="p-2 font-bold flex items-center gap-1.5">
                            {entry.type === 'purchase' && <span className="text-[#A9762F]">📥 توريد</span>}
                            {entry.type === 'return' && <span className="text-purple-700">🔄 مرتجع</span>}
                            {entry.type === 'payment' && <span className="text-[#5C7A5E]">💸 سداد</span>}
                            <span>{entry.label}</span>
                          </td>
                          <td className="p-2 text-[#8E98A6]">{entry.date}</td>
                          <td className="p-2 text-center font-mono font-bold">
                            {entry.invoicedDelta > 0 ? (
                              <span className="text-[#1F2A3C]">+{fmt(entry.invoicedDelta)}</span>
                            ) : entry.invoicedDelta < 0 ? (
                              <span className="text-purple-700 font-bold">{fmt(entry.invoicedDelta)}</span>
                            ) : (
                              <span className="text-[#8E98A6]">-</span>
                            )}
                          </td>
                          <td className="p-2 text-center font-mono font-bold text-[#5C7A5E]">
                            {entry.paidDelta > 0 ? `+${fmt(entry.paidDelta)}` : '-'}
                          </td>
                          <td className="p-2 text-[#8E98A6] text-[11px]">{entry.note}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-[#8E98A6]">
                          لا توجد حركات مسجلة لهذا المورد
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
