import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import { fmt, todayStr, uid } from '../lib/utils';
import { TreasuryKpis } from './treasury/TreasuryKpis';
import { TreasuryAdjustmentForm } from './treasury/TreasuryAdjustmentForm';
import { TreasuryLedgerTable, TreasuryEvent } from './treasury/TreasuryLedgerTable';

export const TreasuryPage: React.FC = () => {
  const { db, toast } = useApp();

  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Manual Transaction Form
  const [actionType, setActionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState<number | ''>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Compute all cash events
  const cashEvents: TreasuryEvent[] = [];

  // 1. Invoices (Cash in vs Non-cash electronic payments)
  (db.invoices || []).forEach(inv => {
    const paid = Number(inv.paidAmount ?? inv.total ?? 0) || 0;
    if (paid <= 0) return;

    const method = inv.paymentMethod || 'cash';

    if (method === 'cash') {
      cashEvents.push({
        id: `inv_${inv.id}`,
        type: 'sale_in',
        label: 'مبيعات نقدية (درج)',
        ref: `فاتورة #${inv.number}`,
        date: inv.date,
        time: (inv.createdAt || '').slice(11, 19),
        in: paid,
        out: 0,
        note: inv.customerName ? `${inv.customerName} (نقدي)` : 'عميل نقدي',
        paymentMethod: 'cash'
      });
    } else if (method === 'card') {
      cashEvents.push({
        id: `inv_${inv.id}`,
        type: 'sale_card',
        label: 'مبيعات بطاقة (فيزا / شبكة)',
        ref: `فاتورة #${inv.number}`,
        date: inv.date,
        time: (inv.createdAt || '').slice(11, 19),
        in: 0, // Does not affect physical cash drawer
        out: 0,
        note: `${inv.customerName || 'عميل'} (سداد إلكتروني - بطاقة)`,
        paymentMethod: 'card',
        isNonCash: true,
        nonCashAmount: paid
      });
    } else if (method === 'vodafone_cash') {
      cashEvents.push({
        id: `inv_${inv.id}`,
        type: 'sale_vodafone',
        label: 'مبيعات محفظة (فودافون كاش)',
        ref: `فاتورة #${inv.number}`,
        date: inv.date,
        time: (inv.createdAt || '').slice(11, 19),
        in: 0, // Does not affect physical cash drawer
        out: 0,
        note: `${inv.customerName || 'عميل'} (سداد إلكتروني - محفظة)`,
        paymentMethod: 'vodafone_cash',
        isNonCash: true,
        nonCashAmount: paid
      });
    } else if (method === 'credit') {
      // If a credit invoice had a cash down payment at the POS counter
      if (paid > 0) {
        cashEvents.push({
          id: `inv_${inv.id}`,
          type: 'sale_in',
          label: 'مقدم نقدي (فاتورة آجل)',
          ref: `فاتورة #${inv.number}`,
          date: inv.date,
          time: (inv.createdAt || '').slice(11, 19),
          in: paid,
          out: 0,
          note: `${inv.customerName || 'عميل'} (دفعة مقدمة نقداً)`,
          paymentMethod: 'credit_cash'
        });
      }
    }
  });

  // 2. Customer Debt Collections (Cash In)
  (db.customerPayments || []).forEach(cp => {
    const amt = Number(cp.amount) || 0;
    if (amt > 0) {
      cashEvents.push({
        id: `cp_${cp.id}`,
        type: 'customer_payment_in',
        label: 'تحصيل آجل من عميل (سند قبض)',
        ref: `تحصيل #${cp.id.slice(0, 6)}`,
        date: cp.effectiveCashDate || cp.postingDate || cp.date,
        time: (cp.createdAt || '').slice(11, 19),
        in: amt,
        out: 0,
        note: cp.customerName || ((db.customers || []).find(c => c.id === cp.customerId)?.name) || 'تحصيل مديونية عميل',
        paymentMethod: 'cash'
      });
    }
  });

  // 3. Supplier Debt Payments (Cash Out)
  (db.supplierPayments || []).forEach(sp => {
    const amt = Number(sp.amount) || 0;
    if (amt > 0) {
      cashEvents.push({
        id: `sp_${sp.id}`,
        type: 'supplier_payment_out',
        label: 'سداد آجل لمورد (سند صرف)',
        ref: `سداد #${sp.id.slice(0, 6)}`,
        date: sp.effectiveCashDate || sp.postingDate || sp.date,
        time: (sp.createdAt || '').slice(11, 19),
        in: 0,
        out: amt,
        note: sp.supplierName || ((db.suppliers || []).find(s => s.id === sp.supplierId)?.name) || 'سداد مستحقات مورد',
        paymentMethod: 'cash'
      });
    }
  });

  // 4. Sales Returns (Cash out / in)
  (db.salesReturns || []).forEach(ret => {
    if (ret.cashOut > 0) {
      cashEvents.push({
        id: `ret_out_${ret.id}`,
        type: 'return_out',
        label: 'مرتجع بيع نقدي',
        ref: `مرتجع #${ret.number}`,
        date: ret.date,
        time: (ret.createdAt || '').slice(11, 19),
        in: 0,
        out: ret.cashOut,
        note: ret.customerName || 'عميل نقدي'
      });
    }
    if (ret.cashIn > 0) {
      cashEvents.push({
        id: `ret_in_${ret.id}`,
        type: 'return_in',
        label: 'فرق تبديل صنف (وارد)',
        ref: `مرتجع #${ret.number}`,
        date: ret.date,
        time: (ret.createdAt || '').slice(11, 19),
        in: ret.cashIn,
        out: 0,
        note: ret.customerName || 'عميل نقدي'
      });
    }
  });

  // 5. Purchases (Cash out)
  (db.purchases || []).forEach(pur => {
    const paid = Number(pur.paidAmount ?? pur.total ?? 0) || 0;
    if (paid > 0) {
      cashEvents.push({
        id: `pur_${pur.id}`,
        type: 'purchase_out',
        label: 'سداد مشتريات وتوريدات',
        ref: `شراء #${pur.number}`,
        date: pur.date,
        time: (pur.createdAt || '').slice(11, 19),
        in: 0,
        out: paid,
        note: pur.supplierName || 'مورد'
      });
    }
  });

  // 5b. Purchase Returns (Cash in - only when refundMethod is cash)
  ((db as any).purchaseReturns || []).forEach((pr: any) => {
    if (pr.refundMethod === 'cash' && Number(pr.totalRefund) > 0) {
      cashEvents.push({
        id: `pr_in_${pr.id}`,
        type: 'purchase_return_in' as any,
        label: 'استرداد نقدي لمرتجع مشتريات',
        ref: `مرتجع شراء #${pr.number || pr.id.slice(0, 6)}`,
        date: pr.effectiveCashDate || pr.originalEventDate || pr.date,
        time: (pr.createdAt || '').slice(11, 19),
        in: Number(pr.totalRefund),
        out: 0,
        note: `${pr.supplierName || 'مورد'} (استرداد نقدي)`,
        paymentMethod: 'cash'
      });
    }
  });

  // 6. Expenses (Cash out)
  (db.expenses || []).forEach(exp => {
    const expAmt = Number(exp.amount) || 0;
    if (expAmt > 0) {
      cashEvents.push({
        id: `exp_${exp.id}`,
        type: 'expense_out',
        label: `مصروف: ${exp.category}`,
        ref: exp.category,
        date: exp.date,
        time: (exp.createdAt || '').slice(11, 19),
        in: 0,
        out: expAmt,
        note: exp.note || '-'
      });
    }
  });

  // 7. Manual Adjustments
  (db.treasuryAdjustments || []).forEach(adj => {
    const adjAmt = Number(adj.amount) || 0;
    if (adjAmt > 0) {
      cashEvents.push({
        id: `adj_${adj.id}`,
        type: adj.type === 'deposit' ? 'manual_in' : 'manual_out',
        label: adj.type === 'deposit' ? 'إيداع نقدي يدوي' : 'سحب نقدي يدوي / مسحوبات شخصية',
        ref: 'تسوية خزانة',
        date: adj.date,
        time: (adj.createdAt || '').slice(11, 19),
        in: adj.type === 'deposit' ? adjAmt : 0,
        out: adj.type === 'withdraw' ? adjAmt : 0,
        note: adj.reason || '-'
      });
    }
  });

  const sortedEvents = cashEvents.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));

  const filteredEvents = sortedEvents.filter(ev => {
    if (filterDate && ev.date !== filterDate) return false;
    if (filterType === 'in' && ev.in <= 0) return false;
    if (filterType === 'out' && ev.out <= 0) return false;
    if (filterType === 'non_cash' && !ev.isNonCash) return false;
    return true;
  });

  const totalIn = filteredEvents.reduce((s, ev) => s + ev.in, 0);
  const totalOut = filteredEvents.reduce((s, ev) => s + ev.out, 0);
  const totalNet = totalIn - totalOut;

  // Filtered Non-cash payments
  const totalNonCash = filteredEvents
    .filter(ev => ev.isNonCash)
    .reduce((s, ev) => s + (ev.nonCashAmount || 0), 0);

  // Filtered Gross Sales (Total value of all sales in the period)
  const filteredSalesInvoices = (db.invoices || []).filter(inv => {
    if (filterDate && inv.date !== filterDate) return false;
    return true;
  });
  const totalGrossSales = filteredSalesInvoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0);

  // Manual Deposit / Withdraw
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast('أدخل المبلغ بشكل صحيح');
      return;
    }

    setSaving(true);
    const actor = auditActor();
    const adj = {
      id: uid(),
      type: actionType,
      amount: Number(amount),
      reason: reason.trim() || (actionType === 'deposit' ? 'إيداع خزانة' : 'سحب خزانة'),
      date: todayStr(),
      createdBy: actor.uid,
      actorUid: actor.uid,
      createdAt: new Date().toISOString()
    };

    try {
      await fsdb.collection('treasuryAdjustments').doc(adj.id).set(adj);
      toast(`✅ تم تسجيل ${actionType === 'deposit' ? 'الإيداع' : 'السحب'} بقيمة ${fmt(adj.amount)} ج بنجاح`);
      setAmount('');
      setReason('');
    } catch (err: any) {
      toast(`خطأ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. KPIs */}
      <TreasuryKpis
        totalIn={totalIn}
        totalOut={totalOut}
        totalNet={totalNet}
        totalNonCash={totalNonCash}
        totalGrossSales={totalGrossSales}
      />

      {/* 2. Manual Deposit/Withdraw Action Form */}
      <TreasuryAdjustmentForm
        actionType={actionType}
        setActionType={setActionType}
        amount={amount}
        setAmount={setAmount}
        reason={reason}
        setReason={setReason}
        saving={saving}
        handleSaveAdjustment={handleSaveAdjustment}
      />

      {/* 3. Cash Flow Movements Ledger Table */}
      <TreasuryLedgerTable
        filteredEvents={filteredEvents}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        filterType={filterType}
        setFilterType={setFilterType}
      />
    </div>
  );
};
