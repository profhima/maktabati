import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, auditActor } from '../lib/firebase';
import { fmt, todayStr, uid } from '../lib/utils';
import { EXPENSE_CATEGORIES } from '../lib/constants';
import { Receipt, Plus, Trash2, Calendar, Search, AlertCircle, ShieldAlert } from 'lucide-react';

export const ExpensesPage: React.FC = () => {
  const { db, toast, isAdmin, hasPerm, currentProfile } = useApp();

  const [filterMonth, setFilterMonth] = useState(todayStr().slice(0, 7));
  const [filterCat, setFilterCat] = useState('');

  // New Expense Form
  const [amount, setAmount] = useState<number | ''>('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayStr());
  const [overrideReason, setOverrideReason] = useState('');
  const [saving, setSaving] = useState(false);

  // Check if chosen expenseDate is closed in dailyClosings
  const isTargetDateClosed = (db.dailyClosings || []).some(
    c => c.date === expenseDate || c.id === expenseDate
  );

  // Determine if active user has Manager/Admin permission to perform backdate exception
  const userRole = currentProfile?.role || '';
  const canOverride = isAdmin || userRole === 'admin' || userRole === 'manager' || hasPerm('editHistoricalSales');

  const expenses = (db.expenses || []).filter(e => {
    const okMonth = !filterMonth || (e.date || '').startsWith(filterMonth);
    const okCat = !filterCat || e.category === filterCat;
    return okMonth && okCat;
  }).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const totalFiltered = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) {
      toast('أدخل مبلغ المصروف');
      return;
    }

    const selectedDate = expenseDate || todayStr();

    // Closed-day protection (BR-04)
    if (isTargetDateClosed) {
      if (!canOverride) {
        toast(`⛔ عذراً: تاريخ يوم ${selectedDate} مغلق ومقفل محاسبياً. يقتصر التسجيل على الأيام المفتوحة.`);
        return;
      }
      if (!overrideReason.trim()) {
        toast('⚠️ استثناء إداري: يرجى كتابة سبب تسجيل المصروف بتاريخ يوم مغلق مسبقاً.');
        return;
      }
    }

    setSaving(true);
    const actor = auditActor();
    const exp: any = {
      id: uid(),
      amount: Number(amount),
      category,
      note: note.trim(),
      date: selectedDate,
      originalEventDate: selectedDate,
      actualCashDate: todayStr(),
      postingDate: isTargetDateClosed ? todayStr() : selectedDate,
      effectiveCashDate: todayStr(),
      createdBy: actor.uid,
      actorUid: actor.uid,
      createdAt: new Date().toISOString(),
      ...(isTargetDateClosed && {
        isManagerOverride: true,
        closedDate: selectedDate,
        overrideReason: overrideReason.trim(),
        overrideManagerUid: actor.uid
      })
    };

    try {
      await fsdb.collection('expenses').doc(exp.id).set(exp);
      toast(isTargetDateClosed 
        ? `✅ تم تسجيل المصروف كاستثناء إداري بتاريخ ${selectedDate} (${fmt(exp.amount)} ج)`
        : `تم تسجيل مصروف بقيمة ${fmt(exp.amount)} ج بنجاح`
      );
      setAmount('');
      setNote('');
      setOverrideReason('');
      setExpenseDate(todayStr());
    } catch (err: any) {
      toast(`خطأ: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!window.confirm('هل تريد حذف هذا المصروف؟')) return;
    try {
      await fsdb.collection('expenses').doc(id).delete();
      toast('تم حذف المصروف');
    } catch (err: any) {
      toast(`خطأ: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. Add Expense Form */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs">
        <h3 className="font-serif font-bold text-sm md:text-base text-[#1F2A3C] mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#A9762F]" />
          تسجيل مصروف نثري أو تشغيلي جديد
        </h3>

        <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-right">
          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">المبلغ (ج.م) *</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              required
              className="w-full px-3 py-2 text-sm bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl font-mono font-bold"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(parseFloat(e.target.value) || '')}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">بند المصروف</label>
            <select
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">التاريخ</label>
            <input
              type="date"
              className={`w-full px-3 py-2 text-xs border rounded-xl focus:outline-hidden ${
                isTargetDateClosed ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold' : 'bg-[#F6F1E7] border-[#D8CBB0]'
              }`}
              value={expenseDate}
              onChange={e => setExpenseDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#3A4A63] mb-1">ملاحظات / البيان</label>
            <input
              type="text"
              className="w-full px-3 py-2 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl focus:outline-hidden"
              placeholder="تفاصيل إضافية..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          {/* Closed-Day Warning & Manager Reason Input */}
          {isTargetDateClosed && (
            <div className="sm:col-span-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                {canOverride ? <ShieldAlert className="w-4 h-4 text-amber-700" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                <span>
                  {canOverride
                    ? `⚠️ تنبيه استثناء إداري: تاريخ يوم ${expenseDate} مغلق ومقفل محاسبياً. بصفتك مديراً يمكنك تسجيل المصروف مع إدخال سبب الاستثناء.`
                    : `⛔ تنبيه: تاريخ يوم ${expenseDate} مغلق ومقفل محاسبياً. لا يمكن تسجيل مصروف بتاريخ مغلق إلا بواسطة المدير.`}
                </span>
              </div>
              {canOverride && (
                <div>
                  <label className="block text-xs font-bold text-amber-800 mb-1">سبب الاستثناء الإداري (إجباري) *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white border border-amber-400 rounded-lg focus:outline-none"
                    placeholder="مثال: فاتورة كهرباء متأخرة تخص وردية الأسبوع الماضي تم سدادها نقداً..."
                    value={overrideReason}
                    onChange={e => setOverrideReason(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div className="sm:col-span-4">
            <button
              disabled={saving || (isTargetDateClosed && !canOverride)}
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-[#A8503A] hover:bg-[#8e4130] text-white font-bold text-xs md:text-sm shadow-xs transition-colors disabled:opacity-50"
            >
              {saving ? 'جاري التسجيل...' : isTargetDateClosed ? '🔒 تسجيل المصروف كاستثناء إداري' : '💸 تسجيل المصروف وخصمه من الخزينة'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Expenses List */}
      <div className="p-4 rounded-2xl bg-[#FFFDF8] border border-[#D8CBB0] shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[#EFE7D6]">
          <h3 className="font-serif font-bold text-base text-[#1F2A3C] flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#A8503A]" />
            سجل المصروفات ({expenses.length})
          </h3>

          <div className="flex gap-2">
            <input
              type="month"
              className="px-3 py-1.5 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
            />
            <select
              className="px-3 py-1.5 text-xs bg-[#F6F1E7] border border-[#D8CBB0] rounded-xl"
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
            >
              <option value="">كل البنود</option>
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Total badge */}
        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-[#D8CBB0] flex justify-between items-center text-xs">
          <span className="text-[#8E98A6]">إجمالي المصروفات للشهر المحدد:</span>
          <b className="text-base text-[#A8503A] font-mono">{fmt(totalFiltered)} ج</b>
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto border border-[#EFE7D6] rounded-xl">
          <table className="w-full text-xs text-right">
            <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
              <tr>
                <th className="p-2.5">التاريخ</th>
                <th className="p-2.5">البند</th>
                <th className="p-2.5 text-center">المبلغ</th>
                <th className="p-2.5">البيان</th>
                <th className="p-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFE7D6]">
              {expenses.length > 0 ? (
                expenses.map(e => (
                  <tr key={e.id} className="hover:bg-[#FAF6EE]">
                    <td className="p-2.5 font-mono text-[#8E98A6]">{e.date}</td>
                    <td className="p-2.5 font-bold text-[#1F2A3C]">{e.category}</td>
                    <td className="p-2.5 text-center font-mono font-bold text-[#A8503A]">{fmt(e.amount)} ج</td>
                    <td className="p-2.5 text-[#8E98A6]">{e.note || '-'}</td>
                    <td className="p-2.5 text-left">
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="p-1 text-[#A8503A] hover:bg-[#A8503A]/10 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-[#8E98A6]">
                    لا توجد مصروفات مسجلة في هذا الشهر
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
