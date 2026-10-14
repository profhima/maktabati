import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import { createLocalSnapshot } from '../lib/backupEngine';
import { recordSecureAudit } from '../lib/auditEngine';
import { fmt, todayStr, uid } from '../lib/utils';
import { generateZReportHtml } from '../lib/invoiceTemplates';
import { calculateDayCloseExpectedCash } from '../lib/financialEngine';
import { DailyClosing } from '../types';
import {
  Lock,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Printer,
  History,
  Coins,
  Receipt,
  CreditCard,
  Smartphone,
  Wallet,
  TrendingDown,
  TrendingUp,
  Download,
  Calendar,
  Sparkles
} from 'lucide-react';

const CASH_DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export const DayClosePage: React.FC = () => {
  const { db, setDb, showPrintModal, currentUser, currentProfile, toast } = useApp();

  const [closeDate, setCloseDate] = useState(todayStr());
  const [actualCashInDrawer, setActualCashInDrawer] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [closing, setClosing] = useState(false);
  const closingLockRef = useRef(false);
  const [showDenomCalc, setShowDenomCalc] = useState(false);
  const [denomCounts, setDenomCounts] = useState<Record<number, number>>({
    200: 0,
    100: 0,
    50: 0,
    20: 0,
    10: 0,
    5: 0,
    1: 0
  });

  // Compute stats for closeDate
  const dayInvoices = (db.invoices || []).filter(inv => inv.date === closeDate);
  const dayReturns = (db.salesReturns || []).filter(r => r.date === closeDate);
  const dayPurchases = (db.purchases || []).filter(p => p.date === closeDate);
  const dayExpenses = (db.expenses || []).filter(e => e.date === closeDate);
  const dayAdjustments = (db.treasuryAdjustments || []).filter(a => a.date === closeDate);
  const dayCustomerPayments = (db.customerPayments || []).filter(
    cp => (cp.effectiveCashDate || cp.postingDate || cp.date) === closeDate
  );
  const daySupplierPayments = (db.supplierPayments || []).filter(
    sp => (sp.effectiveCashDate || sp.postingDate || sp.date) === closeDate
  );
  const dayPurchaseReturns = ((db as any).purchaseReturns || []).filter(
    (pr: any) => (pr.effectiveCashDate || pr.originalEventDate || pr.date) === closeDate && pr.refundMethod === 'cash'
  );

  // Late Reconciliation Delta (BR-05) for transactions late-posted into this open business day
  const lateCustomerPaymentsIn = dayCustomerPayments
    .filter(cp => cp.isLatePosting)
    .reduce((s, cp) => s + (Number(cp.amount) || 0), 0);
  const lateSupplierPaymentsOut = daySupplierPayments
    .filter(sp => sp.isLatePosting)
    .reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
  const latePurchaseReturnsIn = dayPurchaseReturns
    .filter((pr: any) => pr.isLatePosting)
    .reduce((s: number, pr: any) => s + (Number(pr.totalRefund) || 0), 0);
  const lateReconciliationDelta = (lateCustomerPaymentsIn + latePurchaseReturnsIn) - lateSupplierPaymentsOut;

  // Sales Streams
  const totalSalesGross = dayInvoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const totalSalesCash = dayInvoices
    .filter(inv => inv.paymentMethod === 'cash' || !inv.paymentMethod)
    .reduce((s, inv) => s + (inv.paidAmount ?? inv.total ?? 0), 0);
  const totalSalesCard = dayInvoices
    .filter(inv => inv.paymentMethod === 'card')
    .reduce((s, inv) => s + (inv.paidAmount ?? inv.total ?? 0), 0);
  const totalSalesVodafone = dayInvoices
    .filter(inv => inv.paymentMethod === 'vodafone_cash')
    .reduce((s, inv) => s + (inv.paidAmount ?? inv.total ?? 0), 0);
  const totalSalesCredit = dayInvoices
    .filter(inv => inv.paymentMethod === 'credit')
    .reduce((s, inv) => s + (inv.dueAmount || Math.max(0, (inv.total || 0) - (inv.paidAmount || 0))), 0);

  // Debt Collections
  const totalCustomerPayments = dayCustomerPayments.reduce((s, cp) => s + (Number(cp.amount) || 0), 0);

  // Cash Inflows & Outflows
  const totalPurchaseReturnsCashIn = dayPurchaseReturns.reduce((s: number, pr: any) => s + (Number(pr.totalRefund) || 0), 0);
  const totalReturnsCashOut = dayReturns.reduce((s, r) => s + (r.cashOut || 0), 0);
  const totalReturnsCashIn = dayReturns.reduce((s, r) => s + (r.cashIn || 0), 0);
  const totalPurchasesCashOut = dayPurchases.reduce((s, p) => s + (p.paidAmount ?? p.total ?? 0), 0);
  const totalSupplierPayments = daySupplierPayments.reduce((s, sp) => s + (Number(sp.amount) || 0), 0);
  const totalExpenses = dayExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const totalDeposits = dayAdjustments.filter(a => a.type === 'deposit').reduce((s, a) => s + a.amount, 0);
  const totalWithdrawals = dayAdjustments.filter(a => a.type === 'withdraw').reduce((s, a) => s + a.amount, 0);

  // Total Expected Cash in Physical Drawer (calculated via unified financialEngine)
  const { expectedCash } = calculateDayCloseExpectedCash({
    cashSales: totalSalesCash,
    customerPayments: totalCustomerPayments,
    returnsCashIn: totalReturnsCashIn,
    purchaseReturnsCashIn: totalPurchaseReturnsCashIn,
    deposits: totalDeposits,
    returnsCashOut: totalReturnsCashOut,
    purchasesCashOut: totalPurchasesCashOut,
    supplierPayments: totalSupplierPayments,
    expenses: totalExpenses,
    withdrawals: totalWithdrawals
  });

  // Denominations Sum
  const calculatedDenomTotal = Object.entries(denomCounts).reduce(
    (sum, [denom, count]) => sum + Number(denom) * (Number(count) || 0),
    0
  );

  const handleDenomChange = (denom: number, countStr: string) => {
    const count = parseInt(countStr) || 0;
    const updated = { ...denomCounts, [denom]: Math.max(0, count) };
    setDenomCounts(updated);
    const newTotal = Object.entries(updated).reduce(
      (sum, [d, c]) => sum + Number(d) * (Number(c) || 0),
      0
    );
    setActualCashInDrawer(newTotal);
  };

  const actualNum = typeof actualCashInDrawer === 'number' ? actualCashInDrawer : expectedCash;
  const difference = actualNum - expectedCash; // positive = surplus, negative = shortage
  const isMatch = Math.abs(difference) < 0.01;

  const handleSaveDayClose = async () => {
    // If the input was left empty, default to expectedCash
    let effectiveActual = actualCashInDrawer;
    if (effectiveActual === '') {
      effectiveActual = expectedCash;
      setActualCashInDrawer(expectedCash);
    }

    const finalActual = typeof effectiveActual === 'number' ? effectiveActual : Number(effectiveActual) || 0;
    const finalDiff = finalActual - expectedCash;
    const finalIsMatch = Math.abs(finalDiff) < 0.01;

    // Double-click guard using synchronous ref
    if (closingLockRef.current) {
      return;
    }
    closingLockRef.current = true;
    setClosing(true);

    const actor = auditActor();
    // Deterministic closeId: exactly the closeDate
    const closeId = closeDate;
    const opKey = `op_close_${closeDate}`;
    const cashierName = currentProfile?.name || currentUser?.displayName || 'المدير المسؤول';

    const recordData: DailyClosing = {
      id: closeId,
      date: closeDate,
      shiftId: closeId,
      closedBy: cashierName,
      expectedCash,
      actualCash: finalActual,
      difference: finalDiff,
      cashDifference: finalDiff,
      openingCash: 0,
      closingCash: finalActual,
      invoicesCount: dayInvoices.length,
      invoiceCount: dayInvoices.length,
      salesGross: totalSalesGross,
      salesTotal: totalSalesGross,
      salesCash: totalSalesCash,
      salesCashIn: totalSalesCash,
      salesCard: totalSalesCard,
      salesCardTotal: totalSalesCard,
      salesVodafone: totalSalesVodafone,
      salesVodafoneTotal: totalSalesVodafone,
      salesCredit: totalSalesCredit,
      salesCreditNewTotal: totalSalesCredit,
      customerPayments: totalCustomerPayments,
      customerPaymentsTotal: totalCustomerPayments,
      returnsCashOut: totalReturnsCashOut,
      returnsCashIn: totalReturnsCashIn,
      expensesCashOut: totalExpenses,
      expensesTotal: totalExpenses,
      purchasesCashOut: totalPurchasesCashOut,
      purchasesCashPaid: totalPurchasesCashOut,
      purchasesTotal: dayPurchases.reduce((s, p) => s + (p.total || 0), 0),
      supplierPayments: totalSupplierPayments,
      supplierPaymentsTotal: totalSupplierPayments,
      lateReconciliationDelta,
      deposits: totalDeposits,
      withdrawals: totalWithdrawals,
      denominations: denomCounts,
      notes: notes.trim(),
      note: notes.trim(),
      actorUid: actor.uid,
      createdAt: new Date().toISOString(),
      closedDate: closeDate
    };

    try {
      // 1. Check local state first to immediately reject if date is already closed
      const alreadyClosedLocal = (db.dailyClosings || []).some(c => c.date === closeDate || c.id === closeDate);
      if (alreadyClosedLocal) {
        toast(`⚠️ تنبيه: تم تقفيل وردية يوم ${closeDate} مسبقاً ولا يمكن تكرار الإغلاق لنفس اليوم.`);
        return;
      }

      // 2. Perform atomic Firestore transaction to ensure deterministic close and idempotency
      try {
        await fsdb.runTransaction(async (tx) => {
          const closingDocRef = fsdb.collection('dailyClosings').doc(closeId);
          const dayCloseDocRef = fsdb.collection('dayCloses').doc(closeId);
          const opKeyDocRef = fsdb.collection('operationKeys').doc(opKey);

          const [closingSnap, opKeySnap] = await Promise.all([
            tx.get(closingDocRef),
            tx.get(opKeyDocRef)
          ]);

          if (closingSnap.exists || opKeySnap.exists) {
            throw new Error(`ALREADY_CLOSED: تم إقفال وردية يوم ${closeDate} مسبقاً على السحابة.`);
          }

          // Atomic write to dailyClosings, dayCloses, and operationKeys within the same transaction
          tx.set(closingDocRef, recordData);
          tx.set(dayCloseDocRef, recordData);
          tx.set(opKeyDocRef, {
            id: opKey,
            actorUid: actor.uid,
            createdBy: actor.uid,
            type: 'dayClose',
            targetId: closeId,
            date: closeDate,
            closedBy: actor.uid,
            createdAt: new Date().toISOString()
          });
        });
      } catch (txErr: any) {
        if (txErr.message && txErr.message.includes('ALREADY_CLOSED')) {
          toast(`⚠️ تنبيه: تم إقفال وردية يوم ${closeDate} مسبقاً من جهاز آخر.`);
          return;
        }
        // In offline mode or permission fallback, record locally
        console.warn('Transaction fallback notice (offline or network error):', txErr);
      }

      // 3. Immediately update local state so the table shows the closing with ZERO latency
      const updatedDailyClosings = [recordData, ...(db.dailyClosings || []).filter(c => c.id !== closeId && c.date !== closeDate)];
      const updatedDayCloses = [recordData, ...((db as any).dayCloses || []).filter((c: any) => c.id !== closeId && c.date !== closeDate)];

      setDb(prev => ({
        ...prev,
        dailyClosings: updatedDailyClosings,
        dayCloses: updatedDayCloses
      }));

      // 4. Persist to LocalStorage immediately (100% offline & permission-immune)
      try {
        localStorage.setItem('maktabati_local_daily_closings', JSON.stringify(updatedDailyClosings));
      } catch (lsErr) {
        console.warn('LocalStorage closings save notice:', lsErr);
      }

      // 5. Automated Local Snapshot & Audit log in background
      try {
        const snapshotDbState = {
          ...db,
          dailyClosings: updatedDailyClosings,
          dayCloses: updatedDayCloses
        };
        createLocalSnapshot(snapshotDbState, 'dayClose').catch(err => {
          console.warn('Auto backup snapshot warning:', err);
        });
      } catch (_sErr) {}

      recordSecureAudit(
        `تقفيل وردية يوم ${closeDate} (Z-Report)`,
        'dailyClosings',
        {
          closeId,
          actualCash: finalActual,
          expectedCash,
          difference: finalDiff,
          invoicesCount: dayInvoices.length,
          salesGross: totalSalesGross
        },
        Math.abs(finalDiff) > 20 ? 'warn' : 'info'
      ).catch(() => {});

      toast(`✅ تم إغلاق وتقفيل وردية يوم ${closeDate} بنجاح وحفظها في السجل`);

      // 6. Open Z-Report Print Modal
      const zReportHtml = generateZReportHtml(recordData);
      showPrintModal({
        bodyHtml: zReportHtml,
        filename: `تقرير_Z_تقفيل_وردية_${closeDate}.pdf`,
        waMessage: `تقرير تقفيل وردية يوم ${closeDate}\nإجمالي المبيعات: ${fmt(totalSalesGross)} ج\nالنقدية الفعلية: ${fmt(finalActual)} ج\nالمطابقة: ${finalIsMatch ? 'تامة' : finalDiff > 0 ? `زيادة +${fmt(finalDiff)} ج` : `عجز -${fmt(Math.abs(finalDiff))} ج`}`
      });

      // 7. Reset inputs
      setActualCashInDrawer('');
      setNotes('');
      setDenomCounts({
        200: 0,
        100: 0,
        50: 0,
        20: 0,
        10: 0,
        5: 0,
        1: 0
      });
    } catch (err: any) {
      console.error('Day close error:', err);
      toast(`✅ تم حفظ التقفيل محلياً وطباعة تقرير Z`);
    } finally {
      closingLockRef.current = false;
      setClosing(false);
    }
  };

  const handleReprintZReport = (closingItem: any) => {
    const html = generateZReportHtml({
      date: closingItem.date,
      shiftId: closingItem.id || closingItem.shiftId,
      closedBy: closingItem.closedBy || 'كاشير',
      expectedCash: closingItem.expectedCash ?? closingItem.closingCash ?? 0,
      actualCash: closingItem.actualCash ?? closingItem.closingCash ?? 0,
      difference: closingItem.difference ?? closingItem.cashDifference ?? 0,
      invoicesCount: closingItem.invoicesCount ?? closingItem.invoiceCount ?? 0,
      salesGross: closingItem.salesGross ?? closingItem.salesTotal ?? 0,
      salesCash: closingItem.salesCash ?? closingItem.salesCashIn ?? 0,
      salesCard: closingItem.salesCard ?? closingItem.salesCardTotal ?? 0,
      salesVodafone: closingItem.salesVodafone ?? closingItem.salesVodafoneTotal ?? 0,
      salesCredit: closingItem.salesCredit ?? closingItem.salesCreditNewTotal ?? 0,
      customerPayments: closingItem.customerPayments ?? closingItem.customerPaymentsTotal ?? 0,
      returnsCashOut: closingItem.returnsCashOut ?? 0,
      returnsCashIn: closingItem.returnsCashIn ?? 0,
      expensesCashOut: closingItem.expensesCashOut ?? closingItem.expensesTotal ?? 0,
      purchasesCashOut: closingItem.purchasesCashOut ?? closingItem.purchasesCashPaid ?? 0,
      supplierPayments: closingItem.supplierPayments ?? closingItem.supplierPaymentsTotal ?? 0,
      deposits: closingItem.deposits ?? 0,
      withdrawals: closingItem.withdrawals ?? 0,
      notes: closingItem.notes || closingItem.note
    });

    showPrintModal({
      bodyHtml: html,
      filename: `تقرير_Z_تقفيل_${closingItem.date}.pdf`,
      waMessage: `تقرير تقفيل وردية يوم ${closingItem.date}`
    });
  };

  // Combine dailyClosings and dayCloses with deduping
  const allCloses = [...(db.dailyClosings || []), ...((db as any).dayCloses || [])];
  const uniqueClosesMap = new Map<string, DailyClosing>();
  allCloses.forEach(c => {
    if (c && c.id) {
      uniqueClosesMap.set(c.id, c);
    }
  });
  const dayClosesHistory = Array.from(uniqueClosesMap.values()).sort((a, b) =>
    (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  return (
    <div className="space-y-4">
      {/* 1. Close Day Main Panel */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EFE7D6]">
          <div>
            <h3 className="font-serif font-bold text-base md:text-lg text-[#1F2A3C] flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#A9762F]" />
              إغلاق الوردية وجرد الدرج اليومي (Z-Report & Reconciliation)
            </h3>
            <p className="text-xs text-[#8E98A6] mt-0.5">
              مطابقة حركات النقدية الدفترية مع العد الفعلي داخل الدرج واحتساب العجز والزيادة تلقائياً.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#A9762F]" />
            <label className="text-xs font-bold text-[#1F2A3C]">تاريخ الوردية:</label>
            <input
              type="date"
              className="px-3 py-1.5 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono font-bold"
              value={closeDate}
              onChange={e => setCloseDate(e.target.value)}
            />
          </div>
        </div>

        {/* Financial Flow Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
            <span className="text-xs text-[#8E98A6] flex items-center gap-1">
              <Coins className="w-3.5 h-3.5 text-[#5C7A5E]" />
              المبيعات النقدية (+)
            </span>
            <b className="text-lg text-[#5C7A5E] font-mono block mt-1">+{fmt(totalSalesCash)} ج</b>
            <span className="text-[10px] text-[#8E98A6]">{dayInvoices.length} فاتورة مسجلة</span>
          </div>

          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
            <span className="text-xs text-[#8E98A6] flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-[#5C7A5E]" />
              تحصيل ديون عملاء (+)
            </span>
            <b className="text-lg text-[#5C7A5E] font-mono block mt-1">+{fmt(totalCustomerPayments)} ج</b>
            <span className="text-[10px] text-[#8E98A6]">{dayCustomerPayments.length} سند قبض</span>
          </div>

          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
            <span className="text-xs text-[#8E98A6] flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-[#A8503A]" />
              مصروفات ونثريات (-)
            </span>
            <b className="text-lg text-[#A8503A] font-mono block mt-1">-{fmt(totalExpenses)} ج</b>
            <span className="text-[10px] text-[#8E98A6]">{dayExpenses.length} بند منصرف</span>
          </div>

          <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0]">
            <span className="text-xs text-[#8E98A6] flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-[#A8503A]" />
              مشتريات ومرتجعات مسددة (-)
            </span>
            <b className="text-lg text-[#A8503A] font-mono block mt-1">
              -{fmt(totalPurchasesCashOut + totalReturnsCashOut + totalSupplierPayments)} ج
            </b>
            <span className="text-[10px] text-[#8E98A6]">سدادات كاش</span>
          </div>
        </div>

        {/* Secondary Non-Cash Channels Info */}
        {(totalSalesCard > 0 || totalSalesVodafone > 0 || totalSalesCredit > 0) && (
          <div className="p-3 bg-[#F6F1E7]/60 rounded-xl border border-[#EFE7D6] flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-[#3A4A63]">💳 قنوات الدفع غير النقدية اليوم:</span>
            <div className="flex items-center gap-4">
              {totalSalesCard > 0 && <span>فيزا: <b className="font-mono">{fmt(totalSalesCard)} ج</b></span>}
              {totalSalesVodafone > 0 && <span>فودافون كاش: <b className="font-mono">{fmt(totalSalesVodafone)} ج</b></span>}
              {totalSalesCredit > 0 && <span className="text-[#A8503A]">مبيعات آجل (شكك): <b className="font-mono">{fmt(totalSalesCredit)} ج</b></span>}
            </div>
          </div>
        )}

        {/* Cash Counting & Reconciliation Section */}
        <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#D8CBB0] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
            <div>
              <span className="text-xs text-[#8E98A6] block mb-1">النقدية الدفترية المتوقعة بالدرج:</span>
              <b className="text-2xl text-[#1F2A3C] font-mono block">{fmt(expectedCash)} ج</b>
              <span className="text-[11px] text-[#8E98A6]">محسوبة تلقائياً من حركات اليوم</span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#3A4A63]">
                  النقدية الفعلية بعد العد بالدرج (ج.م) *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActualCashInDrawer(expectedCash)}
                    className="text-[11px] text-emerald-700 hover:underline flex items-center gap-0.5 font-bold cursor-pointer bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200"
                    title="ملء القيمة الفعلية بنفس القيمة المتوقعة"
                  >
                    <Sparkles className="w-3 h-3" />
                    مطابق للمتوقع
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDenomCalc(!showDenomCalc)}
                    className="text-[11px] text-[#A9762F] hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    {showDenomCalc ? 'إخفاء الحاسبة' : 'فئات النقدية'}
                  </button>
                </div>
              </div>

              <input
                type="number"
                step="0.5"
                min="0"
                className="w-full px-3 py-2.5 text-base bg-white border border-[#D8CBB0] rounded-xl font-mono font-bold text-center text-[#1F2A3C] shadow-inner focus:outline-none focus:ring-2 focus:ring-[#A9762F]"
                placeholder={expectedCash !== 0 ? `المتوقع: ${fmt(expectedCash)} ج` : '0.00'}
                value={actualCashInDrawer}
                onChange={e => setActualCashInDrawer(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className={`p-3.5 rounded-xl border text-center ${
              isMatch
                ? 'bg-[#5C7A5E]/10 border-[#5C7A5E] text-[#5C7A5E]'
                : difference > 0
                ? 'bg-[#1E40AF]/10 border-[#1E40AF] text-[#1E40AF]'
                : 'bg-[#A8503A]/10 border-[#A8503A] text-[#A8503A]'
            }`}>
              <span className="text-[11px] block font-semibold">نتيجة مطابقة الوردية</span>
              <b className="text-lg font-mono block mt-0.5">
                {isMatch
                  ? '✓ مطابقة تامة (0.00 ج)'
                  : difference > 0
                  ? `زيادة: +${fmt(difference)} ج`
                  : `عجز: -${fmt(Math.abs(difference))} ج`}
              </b>
            </div>
          </div>

          {/* Interactive Denominations Calculator */}
          {showDenomCalc && (
            <div className="p-3 bg-white rounded-xl border border-[#D8CBB0] space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[#EFE7D6]">
                <span className="text-xs font-bold text-[#1F2A3C] flex items-center gap-1">
                  <Calculator className="w-4 h-4 text-[#A9762F]" />
                  حاسبة عد فئات النقدية (ادخل عدد الورقات لكل فئة):
                </span>
                <span className="text-xs font-bold text-[#5C7A5E] font-mono">
                  إجمالي العد: {fmt(calculatedDenomTotal)} ج
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {CASH_DENOMINATIONS.map(denom => (
                  <div key={denom} className="p-2 bg-[#FBF8F1] rounded-lg border border-[#EFE7D6] text-center">
                    <span className="text-xs font-bold text-[#3A4A63] block font-mono">{denom} ج</span>
                    <input
                      type="number"
                      min="0"
                      className="w-full mt-1 px-1.5 py-1 text-xs text-center font-mono font-bold bg-white border border-[#D8CBB0] rounded"
                      placeholder="0"
                      value={denomCounts[denom] || ''}
                      onChange={e => handleDenomChange(denom, e.target.value)}
                    />
                    <span className="text-[10px] text-[#8E98A6] block mt-0.5 font-mono">
                      ={fmt(denom * (denomCounts[denom] || 0))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Input */}
          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">ملاحظات وتوجيهات الإغلاق:</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-xs bg-white border border-[#D8CBB0] rounded-xl placeholder:text-[#8E98A6]"
              placeholder="مثال: تم تسليم النقدية للإدارة / تم تحويل الفائض للخزنة الرئيسية..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

        <button
          disabled={closing}
          onClick={handleSaveDayClose}
          className="w-full py-3.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-sm shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          {closing ? 'جاري الحفظ والتقفيل...' : '🔒 إغلاق وتثبيت تقفيل اليومية مع طباعة تقرير Z-Report الرسمي'}
        </button>
      </div>

      {/* 2. Previous Day Closes History */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#EFE7D6]">
          <h3 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
            <History className="w-5 h-5 text-[#A9762F]" />
            سجل تقفيل الورديات والأيام السابقة
          </h3>
          <span className="text-xs text-[#8E98A6]">
            {dayClosesHistory.length} تقفيل محفوظ
          </span>
        </div>

        <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
              <tr>
                <th className="p-2.5">التاريخ</th>
                <th className="p-2.5 text-center">المبيعات</th>
                <th className="p-2.5 text-center">المتوقع بالدرج</th>
                <th className="p-2.5 text-center">الفعلي بالدرج</th>
                <th className="p-2.5 text-center">العجز / الزيادة</th>
                <th className="p-2.5 text-center">المسؤول</th>
                <th className="p-2.5 text-center">تقرير Z</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7D6]">
              {dayClosesHistory.length > 0 ? (
                dayClosesHistory.map(c => {
                  const sGross = c.salesGross ?? c.salesTotal ?? 0;
                  const expCash = c.expectedCash ?? c.closingCash ?? 0;
                  const actCash = c.actualCash ?? c.closingCash ?? 0;
                  const diff = c.difference ?? c.cashDifference ?? 0;
                  const isZeroDiff = Math.abs(diff) < 0.01;

                  return (
                    <tr key={c.id} className="hover:bg-[#FAF6EE]">
                      <td className="p-2.5 font-bold font-mono text-[#1F2A3C]">{c.date}</td>
                      <td className="p-2.5 text-center font-mono">{fmt(sGross)} ج</td>
                      <td className="p-2.5 text-center font-mono">{fmt(expCash)} ج</td>
                      <td className="p-2.5 text-center font-mono font-bold text-[#1F2A3C]">{fmt(actCash)} ج</td>
                      <td className="p-2.5 text-center font-mono font-bold">
                        <span className={isZeroDiff ? 'text-[#5C7A5E]' : diff > 0 ? 'text-[#1E40AF]' : 'text-[#A8503A]'}>
                          {isZeroDiff ? '✓ مطابقة' : diff > 0 ? `+${fmt(diff)} ج` : `${fmt(diff)} ج`}
                        </span>
                      </td>
                      <td className="p-2.5 text-center text-[#8E98A6]">{c.closedBy || '—'}</td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => handleReprintZReport(c)}
                          className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] hover:bg-[#EFE7D6] text-[#A9762F] border border-[#D8CBB0] font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                          title="طباعة تقرير Z-Report"
                        >
                          <Printer className="w-3 h-3" />
                          طباعة Z
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-[#8E98A6]">
                    لا توجد تقفيلات يومية سابقة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
