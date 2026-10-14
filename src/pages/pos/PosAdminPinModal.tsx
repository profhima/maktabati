import React from 'react';
import { ShieldAlert, Lock } from 'lucide-react';
import { fmt } from '../../lib/utils';
import { verifyAdminOrManagerPin } from '../../lib/permissions';

export interface PosAdminPinModalProps {
  adminPinModalOpen: boolean;
  setAdminPinModalOpen: (open: boolean) => void;
  adminPinInput: string;
  setAdminPinInput: (val: string) => void;
  totalAllDiscounts: number;
  netTotal: number;
  userProfiles: any[];
  setIsDiscountApproved: (app: boolean) => void;
  toast: (msg: string) => void;
  pendingSaveAction: boolean | null;
  setPendingSaveAction: (act: boolean | null) => void;
  handleSaveInvoice: (isReceipt: boolean, forceApproved?: boolean) => void;
}

export const PosAdminPinModal: React.FC<PosAdminPinModalProps> = ({
  adminPinModalOpen,
  setAdminPinModalOpen,
  adminPinInput,
  setAdminPinInput,
  totalAllDiscounts,
  netTotal,
  userProfiles,
  setIsDiscountApproved,
  toast,
  pendingSaveAction,
  setPendingSaveAction,
  handleSaveInvoice
}) => {
  if (!adminPinModalOpen) return null;

  const handleVerify = async () => {
    const check = await verifyAdminOrManagerPin(adminPinInput, userProfiles || []);
    if (check.valid) {
      setIsDiscountApproved(true);
      setAdminPinModalOpen(false);
      setAdminPinInput('');
      toast(`✅ تمت الموافقة الإدارية بواسطة (${check.approver?.name || 'المدير'})`);
      if (pendingSaveAction !== null) {
        handleSaveInvoice(pendingSaveAction, true);
        setPendingSaveAction(null);
      }
    } else {
      toast(check.error ? `❌ ${check.error}` : '❌ رمز المرور غير صحيح');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-right animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 mb-4 text-rose-600">
          <div className="p-2.5 rounded-full bg-rose-50 border border-rose-200">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-900">طلب موافقة إدارية على الخصم</h3>
            <p className="text-xs text-slate-500">نسبة أو قيمة الخصم تتجاوز الحد المسموح للكاشير</p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 mb-4">
          <div className="flex justify-between">
            <span className="text-slate-500">إجمالي الخصومات المطلوبة:</span>
            <b className="font-bold text-rose-600">{fmt(totalAllDiscounts)} ج</b>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">الصافي بعد الخصم:</span>
            <b className="font-bold text-emerald-600">{fmt(netTotal)} ج</b>
          </div>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-amber-600" />
            رمز PIN الخاص بالمدير / المشرف:
          </label>
          <input
            type="password"
            maxLength={6}
            autoFocus
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-center font-bold text-lg focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-900"
            placeholder="••••"
            value={adminPinInput}
            onChange={e => setAdminPinInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                handleVerify();
              }
            }}
          />
          <span className="block text-[10px] text-center text-slate-400 mt-1">
            (أدخل رمز PIN الخاص بالمدير أو المشرف المسؤول)
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setAdminPinModalOpen(false);
              setAdminPinInput('');
              setPendingSaveAction(null);
            }}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer border border-slate-200"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleVerify}
            className="py-2.5 px-3 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs transition-colors cursor-pointer"
          >
            اعتماد وتأكيد
          </button>
        </div>
      </div>
    </div>
  );
};
