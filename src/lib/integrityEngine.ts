import { DBState, IntegrityReport, IntegrityIssue, Customer, Supplier } from '../types';
import { fsdb } from './firebase';
import { recordSecureAudit } from './auditEngine';
import { uid, todayStr, fmt } from './utils';

/**
 * Comprehensive Data Integrity Audit Engine
 * Inspects financial ledgers, stock quantities, balances, and orphan relations.
 */
export function runIntegrityAudit(db: DBState): IntegrityReport {
  const issues: IntegrityIssue[] = [];
  let totalChecks = 0;
  let passedChecks = 0;

  // ----------------------------------------------------
  // 1. Customer Debts & Receivables Audit
  // ----------------------------------------------------
  const customerDebtsMap = new Map<string, { invoiced: number; paid: number; directPayments: number; creditReduction: number }>();
  (db.customers || []).forEach(c => {
    customerDebtsMap.set(c.id, { invoiced: 0, paid: 0, directPayments: 0, creditReduction: 0 });
  });

  (db.invoices || []).forEach(inv => {
    if (inv.customerId) {
      const stats = customerDebtsMap.get(inv.customerId) || { invoiced: 0, paid: 0, directPayments: 0, creditReduction: 0 };
      if (inv.status !== 'refunded') {
        stats.invoiced += Number(inv.total) || 0;
        stats.paid += Number(inv.paidAmount ?? inv.total) || 0;
      }
      customerDebtsMap.set(inv.customerId, stats);
    }
  });

  (db.salesReturns || []).forEach(ret => {
    if (ret.customerId && ret.creditReduction) {
      const stats = customerDebtsMap.get(ret.customerId) || { invoiced: 0, paid: 0, directPayments: 0, creditReduction: 0 };
      stats.creditReduction += Number(ret.creditReduction) || 0;
      customerDebtsMap.set(ret.customerId, stats);
    }
  });

  (db.customerPayments || []).forEach(cp => {
    if (cp.customerId) {
      const stats = customerDebtsMap.get(cp.customerId) || { invoiced: 0, paid: 0, directPayments: 0, creditReduction: 0 };
      stats.directPayments += Number(cp.amount) || 0;
      customerDebtsMap.set(cp.customerId, stats);
    }
  });

  let customerDebtsAccurate = true;
  (db.customers || []).forEach(c => {
    totalChecks++;
    const stats = customerDebtsMap.get(c.id) || { invoiced: 0, paid: 0, directPayments: 0, creditReduction: 0 };
    const netInvoiced = Math.max(0, stats.invoiced - stats.creditReduction);
    const totalPaid = stats.paid + stats.directPayments;

    const recordedInvoiced = c.balance?.invoiced ?? 0;
    const recordedPaid = c.balance?.paid ?? 0;

    const invoicedDiff = Math.abs(netInvoiced - recordedInvoiced);
    const paidDiff = Math.abs(totalPaid - recordedPaid);

    if (invoicedDiff > 0.05 || paidDiff > 0.05) {
      customerDebtsAccurate = false;
      issues.push({
        id: uid(),
        category: 'customers',
        severity: 'warning',
        title: `عدم تطابق في رصيد العميل (${c.name})`,
        description: `المسجل بالبطاقة (مسحوب: ${fmt(recordedInvoiced)} ج، مسدد: ${fmt(recordedPaid)} ج) يختلف عن الحركات الفعلية (مسحوب: ${fmt(netInvoiced)} ج، مسدد: ${fmt(totalPaid)} ج). الفارق: ${fmt(invoicedDiff + paidDiff)} ج`,
        entityId: c.id,
        entityName: c.name,
        expectedValue: { invoiced: netInvoiced, paid: totalPaid },
        actualValue: { invoiced: recordedInvoiced, paid: recordedPaid },
        diff: Number((invoicedDiff + paidDiff).toFixed(2)),
        fixable: true,
        autoFixAction: 'recalculate_customer_balance'
      });
    } else {
      passedChecks++;
    }
  });

  // ----------------------------------------------------
  // 2. Supplier Debts & Payables Audit
  // ----------------------------------------------------
  const supplierDebtsMap = new Map<string, { invoiced: number; paid: number; directPayments: number }>();
  (db.suppliers || []).forEach(s => {
    supplierDebtsMap.set(s.id, { invoiced: 0, paid: 0, directPayments: 0 });
  });

  (db.purchases || []).forEach(pur => {
    if (pur.supplierId) {
      const stats = supplierDebtsMap.get(pur.supplierId) || { invoiced: 0, paid: 0, directPayments: 0 };
      stats.invoiced += Number(pur.total) || 0;
      stats.paid += Number(pur.paidAmount ?? pur.total) || 0;
      supplierDebtsMap.set(pur.supplierId, stats);
    }
  });

  ((db as any).purchaseReturns || []).forEach((pr: any) => {
    if (pr.supplierId) {
      const stats = supplierDebtsMap.get(pr.supplierId) || { invoiced: 0, paid: 0, directPayments: 0 };
      stats.invoiced -= Number(pr.totalRefund) || 0;
      supplierDebtsMap.set(pr.supplierId, stats);
    }
  });

  (db.supplierPayments || []).forEach(sp => {
    if (sp.supplierId) {
      const stats = supplierDebtsMap.get(sp.supplierId) || { invoiced: 0, paid: 0, directPayments: 0 };
      stats.directPayments += Number(sp.amount) || 0;
      supplierDebtsMap.set(sp.supplierId, stats);
    }
  });

  let supplierDebtsAccurate = true;
  (db.suppliers || []).forEach(s => {
    totalChecks++;
    const stats = supplierDebtsMap.get(s.id) || { invoiced: 0, paid: 0, directPayments: 0 };
    const expectedInvoiced = stats.invoiced;
    const expectedPaid = stats.paid + stats.directPayments;

    const recordedInvoiced = s.balance?.invoiced ?? 0;
    const recordedPaid = s.balance?.paid ?? 0;

    const invoicedDiff = Math.abs(expectedInvoiced - recordedInvoiced);
    const paidDiff = Math.abs(expectedPaid - recordedPaid);

    if (invoicedDiff > 0.05 || paidDiff > 0.05) {
      supplierDebtsAccurate = false;
      issues.push({
        id: uid(),
        category: 'suppliers',
        severity: 'warning',
        title: `عدم تطابق في رصيد المورد (${s.name})`,
        description: `المسجل بالبطاقة (فواتير: ${fmt(recordedInvoiced)} ج، مسدد: ${fmt(recordedPaid)} ج) يختلف عن الحركات الفعلية (فواتير: ${fmt(expectedInvoiced)} ج، مسدد: ${fmt(expectedPaid)} ج). الفارق: ${fmt(invoicedDiff + paidDiff)} ج`,
        entityId: s.id,
        entityName: s.name,
        expectedValue: { invoiced: expectedInvoiced, paid: expectedPaid },
        actualValue: { invoiced: recordedInvoiced, paid: recordedPaid },
        diff: Number((invoicedDiff + paidDiff).toFixed(2)),
        fixable: true,
        autoFixAction: 'recalculate_supplier_balance'
      });
    } else {
      passedChecks++;
    }
  });

  // ----------------------------------------------------
  // 3. Stock & Products Integrity Audit
  // ----------------------------------------------------
  let stockConsistent = true;
  const productIds = new Set((db.products || []).map(p => p.id));

  (db.products || []).forEach(p => {
    totalChecks++;
    // Negative Stock check
    if (p.qty < 0) {
      stockConsistent = false;
      issues.push({
        id: uid(),
        category: 'inventory',
        severity: 'warning',
        title: `كمية رصيد سالبة في الصنف (${p.name})`,
        description: `الرصيد الحالي بالمخزن هو (${p.qty} ${p.unit || 'قطعة'})، يلزم مراجعة حركات البيع والشراء أو عمل تسوية مخزنية.`,
        entityId: p.id,
        entityName: p.name,
        actualValue: p.qty,
        expectedValue: '>= 0',
        fixable: false
      });
    } else if (p.costPrice > p.sellPrice && p.sellPrice > 0) {
      // Selling at loss warning
      issues.push({
        id: uid(),
        category: 'inventory',
        severity: 'info',
        title: `سعر البيع أقل من التكلفة للصنف (${p.name})`,
        description: `سعر التكلفة (${fmt(p.costPrice)} ج) أعلى من سعر البيع (${fmt(p.sellPrice)} ج) - يؤدي لخسارة تشغيلية.`,
        entityId: p.id,
        entityName: p.name,
        expectedValue: `>= ${p.costPrice}`,
        actualValue: p.sellPrice,
        fixable: false
      });
    } else if (p.isBundle && Array.isArray(p.bundleComponents)) {
      // Bundle Components validation
      const brokenComponents = p.bundleComponents.filter(c => !productIds.has(c.productId));
      if (brokenComponents.length > 0) {
        stockConsistent = false;
        issues.push({
          id: uid(),
          category: 'bundles',
          severity: 'warning',
          title: `باكدج/عرض يحتوي على أصناف غير موجودة (${p.name})`,
          description: `يوجد ${brokenComponents.length} صنف ضمن مكونات هذا الباكدج تم حذفها من النظام.`,
          entityId: p.id,
          entityName: p.name,
          fixable: false
        });
      } else {
        passedChecks++;
      }
    } else {
      passedChecks++;
    }
  });

  // ----------------------------------------------------
  // 4. Orphan Records Audit
  // ----------------------------------------------------
  let orphanRecordsCount = 0;
  const customerIds = new Set((db.customers || []).map(c => c.id));
  const supplierIds = new Set((db.suppliers || []).map(s => s.id));

  (db.invoices || []).forEach(inv => {
    totalChecks++;
    if (inv.customerId && !customerIds.has(inv.customerId)) {
      orphanRecordsCount++;
      issues.push({
        id: uid(),
        category: 'orphans',
        severity: 'info',
        title: `فاتورة بيع #${inv.number} مرتبطة بعميل محذوف`,
        description: `العميل ذو المعرف (${inv.customerId}) لم يعد مسجلاً بقائمة العملاء.`,
        entityId: inv.id,
        entityName: `فاتورة #${inv.number}`,
        fixable: false
      });
    } else {
      passedChecks++;
    }
  });

  (db.purchases || []).forEach(pur => {
    totalChecks++;
    if (pur.supplierId && !supplierIds.has(pur.supplierId)) {
      orphanRecordsCount++;
      issues.push({
        id: uid(),
        category: 'orphans',
        severity: 'info',
        title: `فاتورة شراء #${pur.number} مرتبطة بمورد محذوف`,
        description: `المورد ذو المعرف (${pur.supplierId}) لم يعد مسجلاً بقائمة الموردين.`,
        entityId: pur.id,
        entityName: `فاتورة شراء #${pur.number}`,
        fixable: false
      });
    } else {
      passedChecks++;
    }
  });

  // ----------------------------------------------------
  // Score & Status Calculation
  // ----------------------------------------------------
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  let overallStatus: 'healthy' | 'warnings' | 'critical' = 'healthy';
  if (criticalCount > 0) {
    overallStatus = 'critical';
  } else if (warningCount > 0) {
    overallStatus = 'warnings';
  }

  const score = totalChecks > 0 ? Math.max(0, Math.min(100, Math.round((passedChecks / totalChecks) * 100))) : 100;

  return {
    id: uid(),
    timestamp: new Date().toISOString(),
    date: todayStr(),
    overallStatus,
    score,
    totalChecks,
    passedChecks,
    issues,
    metrics: {
      customerDebtsAccurate,
      supplierDebtsAccurate,
      stockConsistent,
      treasuryConsistent: true,
      orphanRecordsCount
    }
  };
}

/**
 * Automatically repairs detected integrity discrepancies (Balances synchronization)
 */
export async function repairIntegrityDiscrepancies(
  db: DBState,
  issues: IntegrityIssue[]
): Promise<{ repairedCount: number; errors: string[] }> {
  let repairedCount = 0;
  const errors: string[] = [];

  const fixableIssues = issues.filter(i => i.fixable && i.autoFixAction);

  for (const issue of fixableIssues) {
    try {
      if (issue.autoFixAction === 'recalculate_customer_balance' && issue.entityId && issue.expectedValue) {
        const { invoiced, paid } = issue.expectedValue;
        await fsdb.collection('customers').doc(issue.entityId).update({
          balance: {
            invoiced: Number(invoiced) || 0,
            paid: Number(paid) || 0,
            updatedAt: new Date().toISOString()
          }
        });
        repairedCount++;
      } else if (issue.autoFixAction === 'recalculate_supplier_balance' && issue.entityId && issue.expectedValue) {
        const { invoiced, paid } = issue.expectedValue;
        await fsdb.collection('suppliers').doc(issue.entityId).update({
          balance: {
            invoiced: Number(invoiced) || 0,
            paid: Number(paid) || 0,
            updatedAt: new Date().toISOString()
          }
        });
        repairedCount++;
      }
    } catch (err: any) {
      errors.push(`فشل إصلاح ${issue.title}: ${err.message}`);
    }
  }

  // Record Secure Audit Log of the repair action
  if (repairedCount > 0) {
    await recordSecureAudit(
      'إصلاح آلي لتكامل البيانات وتطابق الأرصدة',
      'system_integrity',
      {
        repairedCount,
        fixableTotal: fixableIssues.length,
        timestamp: new Date().toISOString()
      },
      'warn'
    );
  }

  return { repairedCount, errors };
}
