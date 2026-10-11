import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { fsdb, exportFullBackup, restoreFullBackup, purgeAllData } from '../lib/firebase';
import {
  createLocalSnapshot,
  getLocalSnapshotsIndex,
  restoreFromLocalSnapshot,
  deleteLocalSnapshot,
  validateBackupSchema,
  getBackupHealthStatus
} from '../lib/backupEngine';
import {
  runIntegrityAudit,
  repairIntegrityDiscrepancies
} from '../lib/integrityEngine';
import {
  verifyAuditChain,
  recordSecureAudit
} from '../lib/auditEngine';
import { fmt, todayStr, uid } from '../lib/utils';
import { IntegrityReport, BackupSnapshotMeta, AuditLog } from '../types';
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Database,
  Lock,
  History,
  Calendar,
  FileText,
  Search,
  Filter,
  Check,
  X,
  Layers,
  ArrowUpDown,
  Zap,
  Activity
} from 'lucide-react';

export const MaintenancePage: React.FC = () => {
  const { db, currentUser, toast } = useApp();

  const [activeTab, setActiveTab] = useState<'integrity' | 'backups' | 'audit' | 'danger'>('integrity');

  // Integrity State
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);

  // Backup State
  const [snapshots, setSnapshots] = useState<BackupSnapshotMeta[]>(() => getLocalSnapshotsIndex());
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ json: any; counts: Record<string, number> } | null>(null);

  // Audit Logs State
  const [auditLogsList, setAuditLogsList] = useState<AuditLog[]>([]);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState<string>('all');
  const [chainStatus, setChainStatus] = useState<{ valid: boolean; totalVerified: number; tamperedCount: number }>({
    valid: true,
    totalVerified: 0,
    tamperedCount: 0
  });

  // Run integrity audit on initial mount or when db changes
  const runAudit = () => {
    setIsAuditing(true);
    try {
      const rep = runIntegrityAudit(db);
      setIntegrityReport(rep);
    } catch (err: any) {
      toast(`خطأ أثناء فحص البيانات: ${err.message}`);
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, [db.invoices?.length, db.purchases?.length, db.customers?.length, db.suppliers?.length, db.products?.length]);

  // Load audit logs from Firestore
  const loadAuditLogs = async () => {
    setLoadingAuditLogs(true);
    try {
      const snap = await fsdb
        .collection('auditLogs')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .get();
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog));
      setAuditLogsList(logs);

      // Verify tamper-evident cryptographic hash chain
      const verification = await verifyAuditChain(logs);
      setChainStatus(verification);
    } catch (err: any) {
      console.warn('Load audit logs note:', err);
    } finally {
      setLoadingAuditLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab]);

  // Refresh snapshots list
  const refreshSnapshots = () => {
    setSnapshots(getLocalSnapshotsIndex());
  };

  // 1. Export JSON Full Backup
  const handleExportBackup = async () => {
    setBackingUp(true);
    try {
      const data = await exportFullBackup();
      const serialized = JSON.stringify(data, null, 2);
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-maktabati-erp-${todayStr()}-${Date.now().toString().slice(-4)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // Also create local snapshot
      await createLocalSnapshot(db, 'manual');
      refreshSnapshots();

      toast('✅ تم تصدير النسخة الاحتياطية وتوثيق Snapshot محلي بنجاح');
    } catch (err: any) {
      toast(`خطأ في النسخ الاحتياطي: ${err.message}`);
    } finally {
      setBackingUp(false);
    }
  };

  // 2. Take Instant Local Snapshot
  const handleTakeSnapshot = async () => {
    setBackingUp(true);
    try {
      const meta = await createLocalSnapshot(db, 'manual');
      refreshSnapshots();
      toast(`✅ تم حفظ اللقطة المحلية بنجاح (${meta.recordsCount} سجل، الحجم: ${(meta.sizeBytes! / 1024).toFixed(1)} KB)`);
    } catch (err: any) {
      toast(`خطأ أثناء أخذ اللقطة: ${err.message}`);
    } finally {
      setBackingUp(false);
    }
  };

  // 3. Restore from Local Snapshot
  const handleRestoreSnapshot = async (snapId: string, snapDate: string) => {
    if (!window.confirm(`⚠️ تأكيد: هل تريد استرجاع قاعدة البيانات إلى لقطة يوم (${snapDate})؟\nسيتم استبدال البيانات الحالية بمحتوى هذه النسخة.`)) {
      return;
    }

    setRestoring(true);
    try {
      await restoreFromLocalSnapshot(snapId);
      toast('✅ تم استرجاع النسخة الاحتياطية بنجاح وتحديث النظام');
      runAudit();
    } catch (err: any) {
      toast(`فشل الاسترجاع: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  // 4. File Upload & Validation
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        const validation = validateBackupSchema(json);
        if (!validation.valid) {
          toast(`❌ ${validation.message}`);
          return;
        }
        setUploadPreview({ json, counts: validation.recordCounts || {} });
      } catch (err: any) {
        toast(`خطأ في قراءة ملف JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmUploadRestore = async () => {
    if (!uploadPreview) return;
    if (!window.confirm('⚠️ تحذير: استعادة النسخة الاحتياطية ستستبدل البيانات الحالية. هل ترغب في المتابعة؟')) {
      return;
    }

    setRestoring(true);
    try {
      // Auto snapshot before restore to prevent accidental loss
      await createLocalSnapshot(db, 'pre_update');
      await restoreFullBackup(uploadPreview.json);

      await recordSecureAudit(
        'استعادة قاعدة البيانات من ملف خارجي',
        'system_backup',
        { recordCounts: uploadPreview.counts },
        'critical'
      );

      setUploadPreview(null);
      refreshSnapshots();
      toast('✅ تم استرجاع النسخة الاحتياطية بالكامل بنجاح وتحديث كافة الجداول');
      runAudit();
    } catch (err: any) {
      toast(`فشل الاسترجاع: ${err.message}`);
    } finally {
      setRestoring(false);
    }
  };

  // 5. Automatic Discrepancy Repair
  const handleAutoRepair = async () => {
    if (!integrityReport || integrityReport.issues.length === 0) return;

    const fixable = integrityReport.issues.filter(i => i.fixable);
    if (fixable.length === 0) {
      toast('لا توجد فروقات قابلة للتسوية الآلية');
      return;
    }

    if (!window.confirm(`هل ترغب في تسوية ومطابقة ${fixable.length} حساب/رصيد تلقائياً وفق الفواتير وسندات السداد الفعلية؟`)) {
      return;
    }

    setIsRepairing(true);
    try {
      const result = await repairIntegrityDiscrepancies(db, integrityReport.issues);
      if (result.errors.length > 0) {
        toast(`تمت معالجة ${result.repairedCount} عنصر مع وجود بعض الملاحظات`);
      } else {
        toast(`✅ تمت مطابقة وتسوية ${result.repairedCount} رصيد بدقة تامة`);
      }
      runAudit();
    } catch (err: any) {
      toast(`خطأ أثناء الإصلاح: ${err.message}`);
    } finally {
      setIsRepairing(false);
    }
  };

  // 6. Purge Database
  const handlePurgeDatabase = async () => {
    const code = window.prompt('⚠️ تحذير شديد: سيتم مسح كافة البيانات! اكتب كلمة "تأكيد" للمسح:');
    if (code !== 'تأكيد') return;

    try {
      // Backup snapshot before purge
      await createLocalSnapshot(db, 'pre_update');
      const res = await purgeAllData();
      if (res.skippedCollections.length > 0) {
        toast(`تم حذف ${res.purgedCount} وثيقة (${res.purgedCollections.length} مجموعة). تم تخطي المجموعات الثابتة بقواعد الأمان (${res.skippedCollections.length} مجموعة).`);
      } else {
        toast(`تم تصفية البيانات بنجاح (${res.purgedCount} وثيقة)، وتم الاحتفاظ بنسخة طوارئ سابقة في اللقطات`);
      }
      runAudit();
    } catch (err: any) {
      toast(`خطأ أثناء تصفية البيانات: ${err.message}`);
    }
  };

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogsList.filter(log => {
      if (auditFilterAction !== 'all') {
        if (auditFilterAction === 'critical' && log.severity !== 'critical') return false;
        if (auditFilterAction === 'warn' && log.severity !== 'warn') return false;
        if (auditFilterAction === 'backup' && log.entity !== 'system_backup') return false;
      }
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const actMatch = (log.action || '').toLowerCase().includes(q);
        const nameMatch = (log.actorName || '').toLowerCase().includes(q);
        const entMatch = (log.entity || '').toLowerCase().includes(q);
        if (!actMatch && !nameMatch && !entMatch) return false;
      }
      return true;
    });
  }, [auditLogsList, auditSearch, auditFilterAction]);

  const backupHealth = useMemo(() => getBackupHealthStatus(), [snapshots]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Overview Metrics */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                حماية واقتصاد المشروع وسلامة البيانات
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                  محمي وآمن 100%
                </span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                فحص آلي لتطابق الدفاتر المالية، نسخ احتياطي متقدم متعدد المستويات، وسجل تدقيق مشفر غير قابل للتلاعب.
              </p>
            </div>
          </div>

          {/* Health Score Pill */}
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-right">
              <div className="text-[11px] text-slate-500 font-semibold">درجة اتساق وسلامة النظام</div>
              <div className="text-xl font-black font-mono text-emerald-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
                {integrityReport ? `${integrityReport.score}%` : '100%'}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={() => setActiveTab('integrity')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'integrity'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            فحص وتكامل البيانات
            {integrityReport && integrityReport.issues.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono">
                {integrityReport.issues.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('backups')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'backups'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Database className="w-4 h-4" />
            النسخ الاحتياطي واللقطات ({snapshots.length})
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <Lock className="w-4 h-4" />
            سجل التدقيق المشفر (Audit Chain)
          </button>

          <button
            onClick={() => setActiveTab('danger')}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer ml-auto ${
              activeTab === 'danger'
                ? 'bg-rose-700 text-white shadow-2xs'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            إجراءات متقدمة (منطقة الحذر)
          </button>
        </div>
      </div>

      {/* TAB 1: INTEGRITY AUDIT */}
      {activeTab === 'integrity' && (
        <div className="space-y-4">
          {/* Integrity Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 block">مديونيات وحسابات العملاء</span>
              <div className="flex items-center justify-between">
                <b className="text-sm text-slate-900">
                  {integrityReport?.metrics.customerDebtsAccurate ? 'مطابقة ومضبوطة 100%' : 'يوجد فروقات حسابية'}
                </b>
                {integrityReport?.metrics.customerDebtsAccurate ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 block">مستحقات وفواتير الموردين</span>
              <div className="flex items-center justify-between">
                <b className="text-sm text-slate-900">
                  {integrityReport?.metrics.supplierDebtsAccurate ? 'مطابقة ومضبوطة 100%' : 'يوجد فروقات حسابية'}
                </b>
                {integrityReport?.metrics.supplierDebtsAccurate ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 block">اتساق كميات المخزون والباكدجات</span>
              <div className="flex items-center justify-between">
                <b className="text-sm text-slate-900">
                  {integrityReport?.metrics.stockConsistent ? 'سليم ومتطابق' : 'تنبيهات في المخزن'}
                </b>
                {integrityReport?.metrics.stockConsistent ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                )}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 block">سجلات معلقة أو يتيمة</span>
              <div className="flex items-center justify-between">
                <b className="text-sm text-slate-900">
                  {integrityReport?.metrics.orphanRecordsCount === 0 ? '0 سجلات معلقة' : `${integrityReport?.metrics.orphanRecordsCount} تنبيه`}
                </b>
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                disabled={isAuditing}
                onClick={runAudit}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-4 h-4 ${isAuditing ? 'animate-spin' : ''}`} />
                {isAuditing ? 'جاري التدقيق والفحص...' : 'إعادة الفحص المالي الشامل'}
              </button>

              {integrityReport && integrityReport.issues.some(i => i.fixable) && (
                <button
                  disabled={isRepairing}
                  onClick={handleAutoRepair}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <Zap className="w-4 h-4" />
                  {isRepairing ? 'جاري المطابقة...' : 'إصلاح ومزامنة كافة الأرصدة تلقائياً'}
                </button>
              )}
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              إجمالي الفحوصات: {integrityReport?.totalChecks || 0} فحص • تم اجتياز: {integrityReport?.passedChecks || 0}
            </div>
          </div>

          {/* Issues List */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-700" />
              نتائج الفحص والملاحظات المكتشفة ({integrityReport?.issues.length || 0})
            </h3>

            {(!integrityReport || integrityReport.issues.length === 0) ? (
              <div className="p-8 text-center bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-emerald-900 text-base">النظام المالي والمخزني في حالة تكامل ممتازة (100%)</h4>
                <p className="text-xs text-emerald-700 max-w-lg mx-auto">
                  كافة دفاتر المبيعات، المشتريات، حسابات العملاء والموردين، وكميات المخزون متطابقة تماماً مع الحركات والعمليات المسجلة.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {integrityReport.issues.map(issue => (
                  <div
                    key={issue.id}
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      issue.severity === 'critical'
                        ? 'bg-rose-50/60 border-rose-200'
                        : issue.severity === 'warning'
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            issue.severity === 'critical'
                              ? 'bg-rose-200 text-rose-800'
                              : issue.severity === 'warning'
                              ? 'bg-amber-200 text-amber-900'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {issue.category === 'customers'
                            ? 'عملاء'
                            : issue.category === 'suppliers'
                            ? 'موردين'
                            : issue.category === 'inventory'
                            ? 'مخزون'
                            : 'نظام'}
                        </span>
                        <b className="text-xs sm:text-sm text-slate-900">{issue.title}</b>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{issue.description}</p>
                    </div>

                    {issue.fixable && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg shrink-0">
                        قابلة للمطابقة الآلية
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BACKUPS & SNAPSHOTS */}
      {activeTab === 'backups' && (
        <div className="space-y-4">
          {/* Backup Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Direct JSON Export */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center mb-2 font-bold">
                  <Download className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">تصدير ملف نسخة احتياطية (JSON)</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  تنزيل ملف خارجي مستقل يحتوي على كافة الفواتير، الأصناف، العملاء، وسجلات الخزينة لحفظها خارج المتصفح.
                </p>
              </div>

              <button
                disabled={backingUp}
                onClick={handleExportBackup}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                {backingUp ? 'جاري التصدير...' : 'تصدير وتحميل النسخة الآن'}
              </button>
            </div>

            {/* Instant Local Snapshot */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center mb-2 font-bold">
                  <Zap className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">أخذ لقطة محلية فورية (Snapshot)</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  حفظ نسخة مؤرخة فورية في التخزين المحلي الآمن لتمكين الرجوع إليها في أي وقت بضغطة زر واحدة.
                </p>
              </div>

              <button
                disabled={backingUp}
                onClick={handleTakeSnapshot}
                className="w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Zap className="w-4 h-4" />
                {backingUp ? 'جاري الحفظ...' : 'حفظ لقطة فورية الآن'}
              </button>
            </div>

            {/* Restore from External File */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center mb-2 font-bold">
                  <Upload className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-sm text-slate-900">استرجاع من ملف خارجي (مع فحص الأمان)</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  رفع ملف JSON تم تصديره مسبقاً، ويقوم النظام بفحص هيكله وسلامته قبل التطبيق.
                </p>
              </div>

              <label className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs text-center">
                <Upload className="w-4 h-4" />
                اختيار ملف النسخة الاحتياطية
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileSelected}
                />
              </label>
            </div>
          </div>

          {/* Upload Restore Preview Modal/Banner */}
          {uploadPreview && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 shadow-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-700" />
                  <b className="text-sm font-bold text-slate-900">معاينة وتأكيد استرجاع النسخة الاحتياطية</b>
                </div>
                <button
                  onClick={() => setUploadPreview(null)}
                  className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-white border border-amber-200">
                  <span className="text-slate-500 block">الأصناف</span>
                  <b className="text-slate-900 font-mono">{uploadPreview.counts.products || 0}</b>
                </div>
                <div className="p-2 rounded-lg bg-white border border-amber-200">
                  <span className="text-slate-500 block">فواتير البيع</span>
                  <b className="text-slate-900 font-mono">{uploadPreview.counts.invoices || 0}</b>
                </div>
                <div className="p-2 rounded-lg bg-white border border-amber-200">
                  <span className="text-slate-500 block">فواتير الشراء</span>
                  <b className="text-slate-900 font-mono">{uploadPreview.counts.purchases || 0}</b>
                </div>
                <div className="p-2 rounded-lg bg-white border border-amber-200">
                  <span className="text-slate-500 block">العملاء</span>
                  <b className="text-slate-900 font-mono">{uploadPreview.counts.customers || 0}</b>
                </div>
                <div className="p-2 rounded-lg bg-white border border-amber-200">
                  <span className="text-slate-500 block">الموردين</span>
                  <b className="text-slate-900 font-mono">{uploadPreview.counts.suppliers || 0}</b>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setUploadPreview(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  disabled={restoring}
                  onClick={handleConfirmUploadRestore}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  {restoring ? 'جاري الاسترجاع...' : 'تأكيد واسترجاع البيانات الآن'}
                </button>
              </div>
            </div>
          )}

          {/* Historical Snapshots Table */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-amber-700" />
                  سجل اللقطات الاحتياطية المحفوظة محلياً ({snapshots.length})
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  يحتفظ النظام تلقائياً بآخر 30 لقطة مؤرخة (عند تقفيل كل وردية أو يدوياً) لضمان أعلى درجات الأمان.
                </p>
              </div>

              <div className="text-xs font-semibold text-slate-500">
                {backupHealth.message}
              </div>
            </div>

            {snapshots.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-xs">
                لم يتم تسجيل لقطات محلية بعد. اضغط على زر "حفظ لقطة فورية" لحفظ أول نسخة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">تاريخ ووقت اللقطة</th>
                      <th className="p-2.5">نوع الإنشاء</th>
                      <th className="p-2.5 text-center">إجمالي السجلات</th>
                      <th className="p-2.5 text-center">الحجم</th>
                      <th className="p-2.5 text-center">بصمة التحقق</th>
                      <th className="p-2.5 text-left">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {snapshots.map(snap => (
                      <tr key={snap.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5">
                          <b className="text-slate-900 block">{snap.date}</b>
                          <span className="text-[11px] text-slate-500">
                            {new Date(snap.timestamp).toLocaleTimeString('ar-EG')}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            snap.trigger === 'dayClose'
                              ? 'bg-emerald-100 text-emerald-800'
                              : snap.trigger === 'pre_update'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-800'
                          }`}>
                            {snap.trigger === 'dayClose'
                              ? 'تقفيل يومية (Z-Report)'
                              : snap.trigger === 'pre_update'
                              ? 'تلقائي قبل الاسترجاع'
                              : 'يدوي'}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-900">
                          {snap.recordsCount} سجل
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">
                          {snap.sizeBytes ? `${(snap.sizeBytes / 1024).toFixed(1)} KB` : '-'}
                        </td>
                        <td className="p-2.5 text-center font-mono text-[10px] text-slate-500">
                          {snap.checksum || '-'}
                        </td>
                        <td className="p-2.5 text-left">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              disabled={restoring}
                              onClick={() => handleRestoreSnapshot(snap.id, snap.date)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-[11px] transition-colors cursor-pointer"
                              title="استرجاع النظام إلى هذه النقطة"
                            >
                              استرجاع
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('هل تريد حذف هذه اللقطة من السجل المحلي؟')) {
                                  deleteLocalSnapshot(snap.id);
                                  refreshSnapshots();
                                }
                              }}
                              className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                              title="حذف اللقطة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: IMMUTABLE AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Cryptographic Chain Status Banner */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            chainStatus.valid
              ? 'bg-emerald-50/70 border-emerald-200'
              : 'bg-rose-50 border-rose-300'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                chainStatus.valid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}>
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  سلسلة التدقيق المشفرة (Cryptographic Audit Trail)
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    chainStatus.valid ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                  }`}>
                    {chainStatus.valid ? 'مؤمنة وسليمة 100%' : 'تنبيه: تم رصد عدم تطابق في الـ Hash'}
                  </span>
                </h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  جميع العمليات الحساسة (تعديل أسعار، خصومات، مرتجعات، تصفية) مرتبطة بحاصل تجزئة مشفر (Hash Chain) يمنع التعديل أو الحذف.
                </p>
              </div>
            </div>

            <button
              onClick={loadAuditLogs}
              disabled={loadingAuditLogs}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-bold flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAuditLogs ? 'animate-spin' : ''}`} />
              إعادة التحقق من السلسلة
            </button>
          </div>

          {/* Search & Filters */}
          <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="بحث في سجل العمليات، المشغل، أو نوع الإجراء..."
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                className="w-full pr-9 pl-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-amber-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-semibold flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                تصنيف:
              </span>
              <select
                value={auditFilterAction}
                onChange={e => setAuditFilterAction(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium bg-white focus:outline-none"
              >
                <option value="all">كافة العمليات</option>
                <option value="critical">عمليات حساسة (حرجة)</option>
                <option value="warn">تحذيرات وتسويات</option>
                <option value="backup">نسخ احتياطي واسترجاع</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2.5 w-10">#</th>
                    <th className="p-2.5">العملية والإجراء</th>
                    <th className="p-2.5">المشغل / المستخدم</th>
                    <th className="p-2.5">التاريخ والتوقيت</th>
                    <th className="p-2.5">تفاصيل الحركة</th>
                    <th className="p-2.5 font-mono text-left">بصمة التحقق (Hash)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500 text-xs">
                        {loadingAuditLogs ? 'جاري تحميل السجلات والتحقق من التشفير...' : 'لا توجد سجلات مطابقة للبحث'}
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-2.5 font-mono text-slate-400 text-center">{idx + 1}</td>
                        <td className="p-2.5">
                          <b className="text-slate-900 block">{log.action}</b>
                          <span className="text-[10px] text-slate-500 font-mono">الكيان: {log.entity}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800 block">{log.actorName || 'المستخدم الحالي'}</span>
                          <span className="text-[10px] text-slate-500">{log.actorEmail || '-'}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="text-slate-900 font-bold block">{log.date}</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('ar-EG') : '-'}
                          </span>
                        </td>
                        <td className="p-2.5 max-w-xs truncate text-slate-600">
                          {JSON.stringify(log.details || {})}
                        </td>
                        <td className="p-2.5 text-left font-mono text-[10px] text-slate-500">
                          {log.hash ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {log.hash.slice(0, 16)}...
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DANGER ZONE */}
      {activeTab === 'danger' && (
        <div className="p-5 sm:p-6 rounded-2xl bg-white border border-rose-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-rose-100">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-rose-900">
                منطقة الإجراءات الحساسة (Admin Danger Zone)
              </h3>
              <p className="text-xs text-rose-700 mt-0.5">
                عمليات خاصة بإعادة ضبط المصنع أو بدء موسم دراسي جديد بالكامل.
              </p>
            </div>
          </div>

          <div className="p-4 bg-rose-50/70 rounded-xl border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <b className="text-sm font-bold text-slate-900">تصفية وتفريغ قاعدة البيانات بالكامل</b>
              <p className="text-xs text-slate-600">
                مسح كافة الفواتير، الأصناف، العملاء والموردين. (يقوم النظام تلقائياً بحفظ Snapshot طوارئ قبل التصفية).
              </p>
            </div>

            <button
              onClick={handlePurgeDatabase}
              className="px-4 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs shrink-0"
            >
              <Trash2 className="w-4 h-4" />
              تصفية كافة البيانات
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
