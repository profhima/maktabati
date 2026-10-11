import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb } from '../lib/firebase';
import { FinancialEngineShadow } from '../lib/financialEngine';
import { FlaskConical, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { fmt } from '../lib/utils';

export const FinancialShadowModal: React.FC = () => {
  const { shadowTestOpen, closeShadowTest, db } = useApp();
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<number | string | null>(null);
  const [dataSource, setDataSource] = useState('');

  useEffect(() => {
    if (shadowTestOpen) {
      runTest();
    }
  }, [shadowTestOpen]);

  if (!shadowTestOpen) return null;

  const runTest = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      let invoice: any = null;
      let source = '';

      // Try fetching from Firestore directly
      try {
        const snap = await fsdb.collection('invoices').get();
        const all: any[] = [];
        snap.forEach(doc => {
          const d = doc.data() || {};
          const num = Number(d.number);
          if (Number.isFinite(num)) all.push({ ...d, id: doc.id, _num: num });
        });
        all.sort((a, b) => b._num - a._num);
        if (all.length > 0) {
          invoice = all[0];
          source = 'Firestore مباشرة';
        }
      } catch (_e) {}

      // Fallback to local memory
      if (!invoice) {
        const local = (db.invoices || [])
          .map(x => ({ ...x, _num: Number(x.number) }))
          .filter(x => Number.isFinite(x._num))
          .sort((a, b) => b._num - a._num);
        if (local.length > 0) {
          invoice = local[0];
          source = 'الذاكرة المحلية';
        }
      }

      if (!invoice) {
        setTestResult({ error: 'لم يتم العثور على أي فاتورة صالحة للاختبار.' });
        return;
      }

      setInvoiceNumber(invoice.number);
      setDataSource(source);

      const shadow = FinancialEngineShadow.calculateSale({
        items: invoice.items,
        discountType: invoice.discountType,
        discountValue: invoice.discountValue,
        discount: invoice.discount,
        usedPoints: invoice.usedPoints
      });

      const current = {
        netSales: Number(invoice.total) || 0,
        costOfGoodsSold: (Array.isArray(invoice.items) ? invoice.items : []).reduce(
          (s: number, it: any) => s + (Number(it.cost) || 0) * (Number(it.qty) || 0),
          0
        ),
        grossProfit: Number(invoice.profit) || 0
      };

      const comparison = FinancialEngineShadow.compareSale(current, shadow);

      setTestResult({
        current,
        shadow,
        comparison
      });
    } catch (err: any) {
      setTestResult({ error: `حدث خطأ: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const rows = testResult && !testResult.error ? [
    { label: 'صافي المبيعات', cur: testResult.current.netSales, shadow: testResult.shadow.netSales },
    { label: 'تكلفة البضاعة (COGS)', cur: testResult.current.costOfGoodsSold, shadow: testResult.shadow.costOfGoodsSold },
    { label: 'صافي الربح', cur: testResult.current.grossProfit, shadow: testResult.shadow.grossProfit }
  ] : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F2A3C]/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={closeShadowTest}
    >
      <div
        className="bg-[#FFFDF8] border border-[#D8CBB0] rounded-2xl w-full max-w-lg p-5 shadow-2xl overflow-hidden text-right"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-[#D8CBB0]">
          <h3 className="font-serif font-bold text-base md:text-lg text-[#1F2A3C] flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-[#A9762F]" />
            اختبار محرك الظل المالي (Financial Engine Shadow Mode)
          </h3>
          <button
            onClick={closeShadowTest}
            className="p-1 rounded-lg hover:bg-black/5 text-[#8E98A6] hover:text-[#1F2A3C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-[#FAF6EE] rounded-xl border border-[#D8CBB0] my-3 text-xs text-[#8E98A6]">
          فحص غير تدميري (قراءة فقط) — يطابق حسابات آخر فاتورة مسجلة مع محرك الحسابات المعياري للتحقق من دقة النتائج.
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-[#8E98A6] flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-[#A9762F] border-t-transparent rounded-full animate-spin" />
            جاري قراءة الفاتورة ومطابقة النتائج...
          </div>
        ) : testResult?.error ? (
          <div className="p-4 rounded-xl bg-[#A8503A]/10 text-[#A8503A] text-sm text-center">
            {testResult.error}
          </div>
        ) : testResult ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#8E98A6]">
              <span>الفاتورة رقم: <b>#{invoiceNumber}</b></span>
              <span>المصدر: <b>{dataSource}</b></span>
            </div>

            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-sm font-bold ${
                testResult.comparison.match
                  ? 'bg-[#5C7A5E]/10 border-[#5C7A5E]/30 text-[#5C7A5E]'
                  : 'bg-[#A8503A]/10 border-[#A8503A]/30 text-[#A8503A]'
              }`}
            >
              {testResult.comparison.match ? (
                <>
                  <CheckCircle2 className="w-5 h-5 flex-none" />
                  الحسابات متطابقة تماماً (MATCH 100%)
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 flex-none" />
                  يوجد اختلاف في النتائج بين النظامين
                </>
              )}
            </div>

            <div className="border border-[#D8CBB0] rounded-xl overflow-hidden">
              <table className="w-full text-xs text-right">
                <thead className="bg-[#EFE7D6] font-bold text-[#1F2A3C]">
                  <tr>
                    <th className="p-2">البند</th>
                    <th className="p-2">الحالي</th>
                    <th className="p-2">محرك الظل</th>
                    <th className="p-2">الفرق</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CBB0]/50 font-mono">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-white">
                      <td className="p-2 font-sans font-medium text-[#1F2A3C]">{r.label}</td>
                      <td className="p-2">{fmt(r.cur)}</td>
                      <td className="p-2 text-[#A9762F] font-bold">{fmt(r.shadow)}</td>
                      <td className="p-2">{fmt(r.shadow - r.cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 bg-[#FAF6EE] rounded-lg text-[11px] text-[#8E98A6] flex flex-wrap gap-x-4 gap-y-1">
              <span>الإجمالي قبل الخصم: <b>{fmt(testResult.shadow.originalSubtotal)}</b></span>
              <span>خصومات الفئات: <b>{fmt(testResult.shadow.categoryDiscounts)}</b></span>
              <span>الخصم العام: <b>{fmt(testResult.shadow.generalDiscount)}</b></span>
              <span>نقاط مستخدمة: <b>{fmt(testResult.shadow.usedPoints)}</b></span>
            </div>
          </div>
        ) : null}

        <div className="mt-4 pt-3 border-t border-[#D8CBB0] flex justify-end">
          <button
            onClick={closeShadowTest}
            className="px-4 py-2 rounded-xl bg-[#EFE7D6] hover:bg-[#e4d9bd] text-[#1F2A3C] font-semibold text-xs transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
