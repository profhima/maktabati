import React, { useState, useRef } from 'react';
import { CustomerPayment } from '../types';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor, recordAudit } from '../lib/firebase';
import { fmt, uid, todayStr } from '../lib/utils';
import { verifyAdminOrManagerPin } from '../lib/permissions';
import { Users, Plus, Phone, Award, DollarSign, History, Search, Printer, FileText, Eye, Download, ShieldAlert, Lock, RotateCcw } from 'lucide-react';
import { generateA4SaleInvoiceHtml, generateThermalReceiptHtml } from '../lib/invoiceTemplates';
import { exportElementToPdf } from '../lib/pdfExporter';
import { SHOP_NAME } from '../lib/constants';
import { isNetworkOrTransientError, OfflineSyncManager } from '../lib/offlineSync';
import { resolveClosedDayDates } from '../lib/businessCalendar';

export const CustomersPage: React.FC = () => {
  const { db, currentProfile, showPrintModal, openInvoiceModal, toast } = useApp();

  const [searchQ, setSearchQ] = useState('');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDiscount, setNewDiscount] = useState(0);

  // Selected customer for history / payment
  const [activeCustomer, setActiveCustomer] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const isSubmittingPaymentRef = useRef(false);

  // Modal lifecycle handlers for stable Payment Intent identity
  const handleOpenCustomerModal = (customer: any) => {
    setActiveCustomer(customer);
    setPaymentAmount('');
    let intentId = '';
    try {
      intentId = sessionStorage.getItem('maktabati_cust_intent_' + customer.id) || '';
    } catch {}
    if (!intentId) {
      intentId = uid();
      try {
        sessionStorage.setItem('maktabati_cust_intent_' + customer.id, intentId);
      } catch {}
    }
    setPaymentIntentId(intentId);
    isSubmittingPaymentRef.current = false;
  };

  const handleCloseCustomerModal = () => {
    if (activeCustomer) {
      try {
        sessionStorage.removeItem('maktabati_cust_intent_' + activeCustomer.id);
      } catch {}
    }
    setActiveCustomer(null);
    setPaymentAmount('');
    setPaymentIntentId(null);
    isSubmittingPaymentRef.current = false;
  };

  // Admin PIN modal for sensitive debt reset
  const [adminPinModalOpen, setAdminPinModalOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pendingResetAction, setPendingResetAction] = useState<any | null>(null);

  const customers = (db.customers || []).filter(c => {
    const hay = `${c.name} ${c.phone || ''}`.toLowerCase();
    return hay.includes(searchQ.trim().toLowerCase());
  });

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast('أدخل اسم العميل');
      return;
    }

    const actor = auditActor();
    const customer = {
      id: uid(),
      name: newName.trim(),
      phone: newPhone.trim(),
      discountRate: Number(newDiscount) || 0,
      points: 0,
      balance: { invoiced: 0, paid: 0, updatedAt: new Date().toISOString() },
      createdBy: actor.uid,
      actorUid: actor.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await fsdb.collection('customers').doc(customer.id).set(customer);
      toast(`تمت إضافة العميل "${customer.name}" بنجاح`);
      setNewName('');
      setNewPhone('');
      setNewDiscount(0);
    } catch (err: any) {
      toast(`خطأ: ${err.message}`);
    }
  };

  const handleCollectPayment = async () => {
    // Synchronous guard against rapid double-clicks
    if (isSubmittingPaymentRef.current || savingPayment) {
      return;
    }

    if (!activeCustomer || !paymentAmount || paymentAmount <= 0) {
      toast('أدخل مبلغ التحصيل بشكل صحيح');
      return;
    }

    isSubmittingPaymentRef.current = true;
    setSavingPayment(true);

    // Reuse existing paymentIntentId across retries or initialize once if missing
    const paymentId = paymentIntentId || uid();
    if (!paymentIntentId) {
      setPaymentIntentId(paymentId);
    }

    const actor = auditActor();
    const opId = 'op_cust_pay_' + paymentId;
    const customerRef = fsdb.collection('customers').doc(activeCustomer.id);
    const paymentRef = fsdb.collection('customerPayments').doc(paymentId);
    const opRef = fsdb.collection('operationKeys').doc(opId);

    // Resolve Closed-Day & Business Calendar Date Model
    const dates = resolveClosedDayDates(
      todayStr(),
      (db.dailyClosings || []).map(c => c.date),
      (db as any).businessCalendarVersions || []
    );

    const paymentRecord: CustomerPayment = {
      id: paymentId,
      customerId: activeCustomer.id,
      customerName: activeCustomer.name,
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
      OfflineSyncManager.enqueueCustomerPayment(paymentRecord);
      toast(`💾 تم حفظ التحصيل أوفلاين بقيمة ${fmt(Number(paymentAmount))} ج (سيتم المزامنة تلقائياً)`);
      handleCloseCustomerModal();
      isSubmittingPaymentRef.current = false;
      setSavingPayment(false);
      return;
    }

    try {
      await fsdb.runTransaction(async tx => {
        const [opSnap, customerSnap] = await Promise.all([
          tx.get(opRef),
          tx.get(customerRef)
        ]);

        if (opSnap.exists) {
          // Idempotency: operation already committed, abort duplicate execution safely
          return;
        }

        if (!customerSnap.exists) throw new Error('العميل غير مسجل');
        const bal = customerSnap.data().balance || { invoiced: 0, paid: 0 };
        const newPaid = (Number(bal.paid) || 0) + Number(paymentAmount);

        tx.update(customerRef, {
          balance: {
            invoiced: bal.invoiced || 0,
            paid: newPaid,
            updatedAt: new Date().toISOString()
          }
        });

        tx.set(paymentRef, paymentRecord);
        tx.set(opRef, {
          id: opId,
          type: 'customer_payment',
          targetId: paymentId,
          customerId: activeCustomer.id,
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

      toast(`✅ تم تسجيل تحصيل ${fmt(Number(paymentAmount))} ج من ${activeCustomer.name}`);
      handleCloseCustomerModal();
    } catch (err: any) {
      if (isNetworkOrTransientError(err)) {
        OfflineSyncManager.enqueueCustomerPayment(paymentRecord);
        toast(`💾 انقطع الاتصال - تم حفظ التحصيل أوفلاين بقيمة ${fmt(Number(paymentAmount))} ج`);
        handleCloseCustomerModal();
      } else {
        toast(`خطأ أثناء التحصيل: ${err.message}`);
      }
    } finally {
      isSubmittingPaymentRef.current = false;
      setSavingPayment(false);
    }
  };

  // Zero-out / Write-off debt with Admin PIN Authorization
  const handleRequestDebtReset = () => {
    if (!activeCustomer) return;
    const debt = Math.max(0, (activeCustomer.balance?.invoiced || 0) - (activeCustomer.balance?.paid || 0));
    if (debt <= 0) {
      toast('رصيد العميل مسدد بالكامل بالفعل');
      return;
    }

    // Check if current user is admin
    if (currentProfile?.role === 'admin') {
      executeDebtReset({ name: currentProfile.name, role: 'admin', uid: currentProfile.uid });
    } else {
      setPendingResetAction(activeCustomer);
      setAdminPinModalOpen(true);
    }
  };

  const executeDebtReset = async (approver: { name: string; role: string; uid: string }) => {
    if (!activeCustomer) return;
    const debt = Math.max(0, (activeCustomer.balance?.invoiced || 0) - (activeCustomer.balance?.paid || 0));

    setSavingPayment(true);
    const actor = auditActor();
    const customerRef = fsdb.collection('customers').doc(activeCustomer.id);

    try {
      await fsdb.runTransaction(async tx => {
        const snap = await tx.get(customerRef);
        if (!snap.exists) throw new Error('العميل غير مسجل');
        const bal = snap.data().balance || { invoiced: 0, paid: 0 };

        tx.update(customerRef, {
          balance: {
            invoiced: bal.invoiced || 0,
            paid: bal.invoiced || 0, // Balance cleared
            updatedAt: new Date().toISOString()
          }
        });
      });

      await recordAudit('تصفير مديونية عميل / تسوية خاصة', 'customers', {
        customerId: activeCustomer.id,
        customerName: activeCustomer.name,
        clearedDebt: debt,
        approvedBy: approver.name,
        approverUid: approver.uid,
        requestedBy: actor.name
      });

      toast(`✅ تم تصفير مديونية (${activeCustomer.name}) بقيمة ${fmt(debt)} ج بموافقة (${approver.name})`);
      handleCloseCustomerModal();
      setPendingResetAction(null);
      setAdminPinModalOpen(false);
      setAdminPinInput('');
    } catch (err: any) {
      toast(`خطأ أثناء تصفير المديونية: ${err.message}`);
    } finally {
      setSavingPayment(false);
    }
  };

  // Customer Invoices History
  const customerInvoices = activeCustomer
    ? (db.invoices || []).filter(inv => inv.customerId === activeCustomer.id).sort((a, b) => b.number - a.number)
    : [];

  return (
    <div className="space-y-4">
      {/* 1. Add Customer Form */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
        <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#A9762F]" />
          إضافة عميل جديد
        </h3>

        <form onSubmit={handleAddCustomer} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-right">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">اسم العميل *</label>
            <input
              type="text"
              required
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
              placeholder="اسم العميل الكامل..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">رقم الهاتف</label>
            <input
              type="tel"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden font-mono"
              placeholder="010..."
              value={newPhone}
              onChange={e => setNewPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">نسبة خصم تلقائية (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden font-mono"
              value={newDiscount}
              onChange={e => setNewDiscount(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="sm:col-span-4">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs md:text-sm shadow-xs transition-colors"
            >
              ➕ حفظ العميل
            </button>
          </div>
        </form>
      </div>

      {/* 2. Customer List & Search */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#EFE7D6]">
          <h3 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#A9762F]" />
            سجل العملاء ({customers.length})
          </h3>

          <div className="w-full sm:w-72 relative">
            <input
              type="text"
              className="w-full px-3 py-2 pr-8 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              placeholder="بحث بالاسم أو الهاتف..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
            />
            <Search className="w-3.5 h-3.5 text-[#8E98A6] absolute top-2.5 right-2.5" />
          </div>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
              <tr>
                <th className="p-2.5">العميل</th>
                <th className="p-2.5">الهاتف</th>
                <th className="p-2.5 text-center">نقاط الولاء</th>
                <th className="p-2.5 text-center">إجمالي المسحوبات</th>
                <th className="p-2.5 text-center">المدفوع</th>
                <th className="p-2.5 text-center">المديونية الحالية</th>
                <th className="p-2.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7D6]">
              {customers.length > 0 ? (
                customers.map(c => {
                  const bal = c.balance || { invoiced: 0, paid: 0 };
                  const debt = Math.max(0, (bal.invoiced || 0) - (bal.paid || 0));
                  return (
                    <tr key={c.id} className="hover:bg-[#FAF6EE]">
                      <td className="p-2.5">
                        <b>{c.name}</b>
                        {c.discountRate > 0 && (
                          <span className="text-[10px] text-[#5C7A5E] block">خصم دائم {c.discountRate}%</span>
                        )}
                      </td>
                      <td className="p-2.5 font-mono text-[#8E98A6]">{c.phone || '-'}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-[#A9762F]">
                        {c.loyaltyPoints ?? c.points ?? 0} ⭐
                      </td>
                      <td className="p-2.5 text-center font-mono">{fmt(bal.invoiced || 0)}</td>
                      <td className="p-2.5 text-center font-mono">{fmt(bal.paid || 0)}</td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        <span className={debt > 0 ? 'text-[#A8503A]' : 'text-[#5C7A5E]'}>
                          {fmt(debt)} ج
                        </span>
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleOpenCustomerModal(c)}
                          className="px-3 py-1 bg-[#EFE7D6] hover:bg-[#A9762F] hover:text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          كشف الحساب والتحصيل
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#8E98A6]">
                    لا يوجد عملاء مسجلون
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Customer Ledger Modal */}
      {activeCustomer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-[#FFFDF8] border border-[#D8CBB0] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-[#EFE7D6]">
              <div>
                <h3 className="font-serif font-bold text-base text-[#1F2A3C]">
                  👤 كشف حساب: {activeCustomer.name}
                </h3>
                <span className="text-xs text-[#8E98A6]">{activeCustomer.phone || 'بدون هاتف'}</span>
              </div>
              <button
                onClick={handleCloseCustomerModal}
                className="w-7 h-7 rounded-full bg-[#EFE7D6] hover:bg-[#D8CBB0] font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
                <span className="text-[#8E98A6] block">إجمالي المسحوبات</span>
                <b className="text-sm font-mono">{fmt(activeCustomer.balance?.invoiced || 0)} ج</b>
              </div>
              <div className="p-2 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
                <span className="text-[#8E98A6] block">المسدد</span>
                <b className="text-sm font-mono text-[#5C7A5E]">{fmt(activeCustomer.balance?.paid || 0)} ج</b>
              </div>
              <div className="p-2 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
                <span className="text-[#8E98A6] block">المتبقي المطلوب</span>
                <b className="text-sm font-mono text-[#A8503A]">
                  {fmt(Math.max(0, (activeCustomer.balance?.invoiced || 0) - (activeCustomer.balance?.paid || 0)))} ج
                </b>
              </div>
            </div>

            {/* Payment Collection Form */}
            <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0] space-y-2">
              <div className="flex justify-between items-center">
                <b className="text-xs text-[#1F2A3C] block">تحصيل دفعة نقدية وسداد مديونية:</b>
                {Math.max(0, (activeCustomer.balance?.invoiced || 0) - (activeCustomer.balance?.paid || 0)) > 0 && (
                  <button
                    type="button"
                    onClick={handleRequestDebtReset}
                    className="text-[11px] font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <ShieldAlert className="w-3 h-3 text-rose-600" />
                    تصفير المديونية (موافقة إدارية)
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="flex-1 px-3 py-2 text-xs bg-white border border-[#D8CBB0] rounded-xl font-mono font-bold"
                  placeholder="المبلغ المحصل..."
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(parseFloat(e.target.value) || '')}
                />
                <button
                  disabled={savingPayment}
                  onClick={handleCollectPayment}
                  className="px-4 py-2 bg-[#5C7A5E] hover:bg-[#4c684e] text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  {savingPayment ? 'جاري...' : 'سداد المبلغ'}
                </button>
              </div>
            </div>

            {/* Invoices List */}
            <div>
              <b className="text-xs text-[#1F2A3C] block mb-2">فواتير العميل السابقة:</b>
              <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl max-h-48">
                <table className="w-full text-xs text-right">
                  <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
                    <tr>
                      <th className="p-2">رقم الفاتورة</th>
                      <th className="p-2">التاريخ</th>
                      <th className="p-2 text-center">الإجمالي</th>
                      <th className="p-2 text-center">المدفوع</th>
                      <th className="p-2 text-center">المتبقي</th>
                      <th className="p-2 text-center">طباعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFE7D6]">
                    {customerInvoices.length > 0 ? (
                      customerInvoices.map(inv => (
                        <tr key={inv.id}>
                          <td className="p-2 font-bold">#{inv.number}</td>
                          <td className="p-2 text-[#8E98A6]">{inv.date}</td>
                          <td className="p-2 text-center font-mono font-bold text-[#A9762F]">{fmt(inv.total)}</td>
                          <td className="p-2 text-center font-mono">{fmt(inv.paidAmount ?? inv.total)}</td>
                          <td className="p-2 text-center font-mono text-[#A8503A]">
                            {fmt(Math.max(0, inv.total - (inv.paidAmount ?? inv.total)))}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => openInvoiceModal(inv)}
                                className="p-1 rounded hover:bg-[#FAF6EE] text-[#1F2A3C] cursor-pointer"
                                title="عرض تفاصيل الفاتورة"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#A9762F]" />
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    toast('⏳ جاري إنشاء وتحميل ملف PDF...');
                                    const bodyHtml = generateA4SaleInvoiceHtml({
                                      invoice: inv,
                                      cashierName: currentProfile?.name || 'المدير المسؤول'
                                    });
                                    await exportElementToPdf({
                                      html: bodyHtml,
                                      filename: `فاتورة_رقم_${inv.number}.pdf`,
                                      isThermal: false
                                    });
                                    toast(`✅ تم تنزيل ملف (فاتورة_رقم_${inv.number}.pdf)`);
                                  } catch (_e) {
                                    toast('❌ تعذر إنشاء ملف PDF');
                                  }
                                }}
                                className="p-1 rounded hover:bg-[#5C7A5E]/15 text-[#5C7A5E] cursor-pointer"
                                title="تنزيل ملف PDF مباشر على جهازك"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  const bodyHtml = generateA4SaleInvoiceHtml({
                                    invoice: inv,
                                    cashierName: currentProfile?.name || 'المدير المسؤول'
                                  });
                                  showPrintModal({
                                    bodyHtml,
                                    phone: inv.customerPhone,
                                    filename: `فاتورة_رقم_${inv.number}.pdf`,
                                    waMessage: `فاتورة رقم ${inv.number} من ${SHOP_NAME}`
                                  });
                                }}
                                className="p-1 rounded hover:bg-[#A9762F]/15 text-[#A9762F] cursor-pointer"
                                title="معاينة وطباعة ورقية A4"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  const bodyHtml = generateThermalReceiptHtml({
                                    invoice: inv,
                                    cashierName: currentProfile?.name || 'كاشير'
                                  });
                                  showPrintModal({
                                    bodyHtml,
                                    phone: inv.customerPhone,
                                    filename: `إيصال_رقم_${inv.number}.pdf`,
                                    waMessage: `إيصال رقم ${inv.number}`
                                  });
                                }}
                                className="p-1 rounded hover:bg-[#5C7A5E]/15 text-[#5C7A5E] cursor-pointer"
                                title="طباعة إيصال حراري"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-[#8E98A6]">
                          لا توجد فواتير مسجلة لهذا العميل
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

      {/* 4. Admin PIN Authorization Modal for Debt Zeroing */}
      {adminPinModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-right animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-50 border border-rose-200">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">موافقة إدارية: تصفير مديونية</h3>
                <p className="text-xs text-slate-500">يتطلب هذا الإجراء الحساس إذن وتصريح الإدارة</p>
              </div>
            </div>

            {pendingResetAction && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5 mb-4">
                <div className="flex justify-between">
                  <span className="text-slate-500">العميل:</span>
                  <b className="font-bold text-slate-800">{pendingResetAction.name}</b>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">المديونية المراد إسقاطها:</span>
                  <b className="font-bold text-rose-600 font-mono">
                    {fmt(Math.max(0, (pendingResetAction.balance?.invoiced || 0) - (pendingResetAction.balance?.paid || 0)))} ج
                  </b>
                </div>
              </div>
            )}

            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-amber-600" />
                رمز PIN الخاص بالمدير المسؤول:
              </label>
              <input
                type="password"
                maxLength={6}
                autoFocus
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center font-bold text-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-slate-900"
                placeholder="••••"
                value={adminPinInput}
                onChange={e => setAdminPinInput(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter') {
                    const check = await verifyAdminOrManagerPin(adminPinInput, db.userProfiles || []);
                    if (check.valid && check.approver) {
                      executeDebtReset(check.approver);
                    } else {
                      toast(check.error ? `❌ ${check.error}` : '❌ رمز المرور غير صحيح');
                    }
                  }
                }}
              />
              <span className="block text-[10px] text-center text-slate-400 mt-1">
                (أدخل رمز PIN الخاص بمدير النظام أو المالك)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdminPinModalOpen(false);
                  setAdminPinInput('');
                  setPendingResetAction(null);
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer border border-slate-200"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const check = await verifyAdminOrManagerPin(adminPinInput, db.userProfiles || []);
                  if (check.valid && check.approver) {
                    executeDebtReset(check.approver);
                  } else {
                    toast(check.error ? `❌ ${check.error}` : '❌ رمز المرور غير صحيح');
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                تأكيد الإسقاط
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
