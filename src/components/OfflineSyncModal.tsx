import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { OfflineSyncManager, QueuedOfflineOperation } from '../lib/offlineSync';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Printer,
  Trash2,
  X,
  Smartphone,
  Layers,
  ArrowUpDown,
  FileText
} from 'lucide-react';
import { fmt, formatTimeEn } from '../lib/utils';

interface OfflineSyncModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  pwaInstallPrompt?: any;
  onTriggerInstall?: () => void;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  pwaInstallPrompt: propPwaInstallPrompt,
  onTriggerInstall: propOnTriggerInstall
}) => {
  const {
    connStatus,
    toast,
    db,
    showPrintModal,
    currentProfile,
    offlineModalOpen,
    closeOfflineModal,
    pwaInstallPrompt: appPwaPrompt,
    triggerPwaInstall: appTriggerInstall
  } = useApp();

  const isOpen = propIsOpen !== undefined ? propIsOpen : offlineModalOpen;
  const onClose = propOnClose || closeOfflineModal;
  const pwaPrompt = propPwaInstallPrompt || appPwaPrompt;
  const onInstall = propOnTriggerInstall || appTriggerInstall;

  const [queue, setQueue] = useState<QueuedOfflineOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [storageInfo, setStorageInfo] = useState<{ usageMB: number; quotaMB: number; percent: number }>({
    usageMB: 0,
    quotaMB: 0,
    percent: 0
  });

  useEffect(() => {
    if (!isOpen) return;
    const unsub = OfflineSyncManager.subscribe(q => setQueue(q));
    OfflineSyncManager.getStorageEstimate().then(setStorageInfo);
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleForceSync = async () => {
    if (!navigator.onLine) {
      toast('⚠️ لا يوجد اتصال بالإنترنت حالياً — سيتم المزامنة تلقائياً عند عودة النت');
      return;
    }

    setIsSyncing(true);
    toast('🔄 جاري مزامنة العمليات المعلقة مع السحابة...');
    try {
      const res = await OfflineSyncManager.syncAllPending();
      if (res.synced > 0) {
        toast(`✅ تمت مزامنة ${res.synced} عملية بنجاح مع السحابة`);
        setSyncLogs(prev => [
          `[${formatTimeEn(new Date())}] تمت مزامنة ${res.synced} عملية بنجاح.`,
          ...prev
        ]);
      } else if (res.failed === 0 && res.skippedOtherUser === 0) {
        toast('✨ كافة البيانات متزامنة بالفعل مع السحابة');
      }

      if (res.skippedOtherUser > 0) {
        toast(`🔒 توجد ${res.skippedOtherUser} عملية معلقة تابعة لمستخدم آخر تم إبقاؤها بأمان`);
        setSyncLogs(prev => [
          `[${formatTimeEn(new Date())}] تم تأجيل مزامنة ${res.skippedOtherUser} عملية تابعة لمستخدمين آخرين للحفاظ على هوية المسجل.`,
          ...prev
        ]);
      }

      if (res.failed > 0) {
        toast(`⚠️ تعذر مزامنة ${res.failed} عملية: تفقد اتصالك`);
        setSyncLogs(prev => [
          `[${formatTimeEn(new Date())}] فشل مزامنة ${res.failed} عملية: ${res.errors.join(', ')}`,
          ...prev
        ]);
      }
    } catch (err: any) {
      toast(`خطأ أثناء المزامنة: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReprintOfflineInvoice = (op: QueuedOfflineOperation) => {
    if (op.type !== 'invoice' || !op.payload?.invoice) {
      toast('لا توجد بيانات طباعة لهذه العملية');
      return;
    }
    const inv = op.payload.invoice;
    // Open print preview
    const cashierName = currentProfile?.name || 'كاشير';
    showPrintModal({
      title: `فاتورة بيع أوفلاين #${inv.number}`,
      phone: inv.customerPhone,
      filename: `فاتورة_أوفلاين_رقم_${inv.number}.pdf`,
      bodyHtml: `
        <div style="font-family: Cairo, Tajawal, sans-serif; direction: rtl; padding: 20px;">
          <div style="text-align: center; border-bottom: 2px dashed #92400E; padding-bottom: 15px; margin-bottom: 15px;">
            <h2 style="margin: 0; color: #92400E;">مكتبتي — إيصال بيع (أوفلاين)</h2>
            <div style="font-size: 13px; color: #64748B; margin-top: 4px;">فاتورة غير متصلة بالإنترنت محفوظة محلياً</div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px;">
            <b>رقم الفاتورة: #${inv.number}</b>
            <span>التاريخ: ${inv.date || new Date().toISOString().slice(0, 10)}</span>
          </div>
          <div style="margin-bottom: 12px; font-size: 14px;">
            <span>العميل: <b>${inv.customerName || 'عميل نقدي'}</b></span>
            ${inv.customerPhone ? `<span style="margin-right: 15px;">الهاتف: ${inv.customerPhone}</span>` : ''}
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
            <thead>
              <tr style="background: #F1F5F9; border-bottom: 1px solid #CBD5E1;">
                <th style="padding: 8px; text-align: right;">الصنف</th>
                <th style="padding: 8px; text-align: center;">الكمية</th>
                <th style="padding: 8px; text-align: center;">السعر</th>
                <th style="padding: 8px; text-align: left;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              ${(inv.items || []).map((it: any) => `
                <tr style="border-bottom: 1px solid #E2E8F0;">
                  <td style="padding: 8px;">${it.name}</td>
                  <td style="padding: 8px; text-align: center;">${it.qty}</td>
                  <td style="padding: 8px; text-align: center;">${fmt(it.price)}</td>
                  <td style="padding: 8px; text-align: left;">${fmt(it.price * it.qty)} ج</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 20px; border-top: 2px solid #0F172A; padding-top: 10px; text-align: left; font-size: 16px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span>الإجمالي المستحق:</span>
              <b style="color: #92400E;">${fmt(inv.total)} جنيه</b>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: #64748B;">
              <span>المدفوع:</span>
              <span>${fmt(inv.paidAmount ?? inv.total)} جنيه</span>
            </div>
          </div>
          <div style="margin-top: 30px; text-align: center; font-size: 12px; color: #94A3B8;">
            شكراً لتعاملكم معنا — نظام مكتبتي المتطور
          </div>
        </div>
      `
    });
  };

  const handleExportOfflineQueueJson = () => {
    try {
      const dataStr = JSON.stringify(queue, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `سجل_العمليات_المعلقة_أوفلاين_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('💾 تم تصدير ملف العمليات المعلقة بنجاح');
    } catch {
      toast('تعذر تصدير الملف');
    }
  };

  const pendingCount = queue.filter(q => q.status !== 'synced').length;

  return (
    <div
      id="offline-sync-modal"
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-4 overflow-y-auto animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 md:p-5 bg-gradient-to-r from-[#92400E] to-[#B45309] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs">
              {connStatus.online ? <Wifi className="w-5 h-5 text-emerald-300" /> : <WifiOff className="w-5 h-5 text-amber-200" />}
            </div>
            <div>
              <h2 className="text-lg font-bold">إدارة العمل دون اتصال بالإنترنت (Offline / PWA)</h2>
              <p className="text-xs text-amber-100">
                {connStatus.online ? 'الإنترنت متصل — النظام متزامن سحابياً' : 'وضع عدم الاتصال نشط — يمكنك إصدار الفواتير بحرية'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Indicators Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 border-b border-slate-200 text-xs">
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                connStatus.online ? 'bg-emerald-500 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <div>
              <div className="text-slate-500 text-[10px]">حالة الشبكة</div>
              <b className={connStatus.online ? 'text-emerald-700' : 'text-amber-700'}>
                {connStatus.online ? 'متصل بالإنترنت' : 'غير متصل (Offline)'}
              </b>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <div>
              <div className="text-slate-500 text-[10px]">فواتير معلقة بالمحل</div>
              <b className="text-slate-800 font-mono text-sm">{pendingCount} عملية</b>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-600 shrink-0" />
            <div>
              <div className="text-slate-500 text-[10px]">المخزن المحلي</div>
              <b className="text-slate-800 font-mono">{storageInfo.usageMB > 0 ? `${storageInfo.usageMB} MB` : 'نشط ومؤمّن'}</b>
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600 shrink-0" />
            <div>
              <div className="text-slate-500 text-[10px]">الأصناف المحفوظة</div>
              <b className="text-slate-800 font-mono">{db.products?.length || 0} صنف</b>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 md:p-5 overflow-y-auto space-y-4 flex-1">
          {/* PWA Install Banner */}
          {pwaPrompt && (
            <div className="p-3.5 bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-800">تثبيت التطبيق على جهاز الكاشير (PWA)</h4>
                  <p className="text-xs text-slate-600">لتشغيل النظام بضغطة واحدة من سطح المكتب وبدون شريط المتصفح</p>
                </div>
              </div>
              <button
                onClick={onInstall}
                className="px-3 py-1.5 bg-[#92400E] hover:bg-[#78350F] text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-xs"
              >
                تثبيت الآن
              </button>
            </div>
          )}

          {/* Pending Operations List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#92400E]" />
                قائمة الفواتير والعمليات المحفوظة في وضع الأوفلاين ({queue.length})
              </h3>
              {queue.length > 0 && (
                <button
                  onClick={handleExportOfflineQueueJson}
                  className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  تصدير نسخة احتياطية
                </button>
              )}
            </div>

            {queue.length === 0 ? (
              <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
                <h4 className="text-sm font-bold text-slate-700">كافة العمليات متزامنة بنسبة 100%</h4>
                <p className="text-xs text-slate-500 mt-1">
                  لا توجد فواتير أو حركات معلقة في الذاكرة المحلية. أي فاتورة جديدة تصدرها أثناء انقطاع الإنترنت ستظهر هنا فوراً.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {queue.map(op => (
                  <div
                    key={op.id}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between hover:border-slate-300 transition-all text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          op.status === 'synced'
                            ? 'bg-emerald-500'
                            : op.status === 'syncing'
                            ? 'bg-blue-500 animate-ping'
                            : op.status === 'failed'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      <div>
                        <div className="font-bold text-slate-800">{op.title}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {formatTimeEn(op.createdAt)} — {op.type}
                        </div>
                        {op.errorMsg && (
                          <div className="text-[10px] text-red-600 mt-0.5 font-medium">{op.errorMsg}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {op.type === 'invoice' && (
                        <button
                          onClick={() => handleReprintOfflineInvoice(op)}
                          title="طباعة إيصال الفاتورة من المخزن المحلي"
                          className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => OfflineSyncManager.removeItem(op.id)}
                        title="حذف من قائمة الانتظار"
                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sync Information / FAQ */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 space-y-1.5">
            <b className="block font-bold">💡 كيف يعمل وضع عدم الاتصال (Full Offline Mode) في مكتبتي؟</b>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              عند انقطاع كابل الإنترنت أو الواي فاي، يواصل نظام مكتبتي عمله بسرعة 100%؛ حيث يخصم الكميات من المخزون، ويحدث أرصدة العملاء، ويطبع الإيصالات للزبائن فوراً، ويحفظ الفواتير بأرقام تسلسلية صحيحة في الذاكرة الآمنة للجهاز. وبمجرد عودة الإنترنت، يقوم النظام تلقائياً بترحيل كافة الفواتير دفعة واحدة إلى الخادم السحابي دون أي تدخل يدوي.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={() => OfflineSyncManager.clearQueue(true)}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium"
          >
            تنظيف المكتمل
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              إغلاق
            </button>
            <button
              onClick={handleForceSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-[#92400E] hover:bg-[#78350F] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'جاري المزامنة...' : 'مزامنة السحابة الآن'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
