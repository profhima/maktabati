import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ROLE_PRESETS } from '../lib/permissions';
import { verifyPin, getPinLockoutStatus } from '../lib/pinSecurity';
import {
  Users,
  KeyRound,
  ShieldCheck,
  Lock,
  Unlock,
  CheckCircle2,
  X,
  LogIn,
  Crown
} from 'lucide-react';

export const OperatorSwitchModal: React.FC = () => {
  const {
    db,
    activeOperator,
    switchActiveOperator,
    operatorSwitchModalOpen,
    closeOperatorSwitchModal,
    toast
  } = useApp();

  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!operatorSwitchModalOpen) return null;

  const usersList = db.userProfiles || [];

  const handleSelectUser = (uid: string | null) => {
    setSelectedUserUid(uid);
    setPinInput('');
    setErrorMsg('');

    // If selecting admin or user with no pin, can switch immediately
    if (uid === null) {
      switchActiveOperator(null);
      closeOperatorSwitchModal();
      return;
    }

    const u = usersList.find(x => x.uid === uid || x.id === uid);
    if (u && !u.pinHash && !u.pinCode) {
      switchActiveOperator(uid);
      closeOperatorSwitchModal();
    }
  };

  const handleConfirmPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUserUid) return;

    const u = usersList.find(x => x.uid === selectedUserUid || x.id === selectedUserUid);
    if (!u) return;

    const ident = u.uid || u.id || '';
    const initialLockout = getPinLockoutStatus(ident);
    if (initialLockout.isLocked) {
      setErrorMsg(`الحساب مقفل مؤقتاً بسبب تكرار المحاولات. المتبقي: ${Math.ceil(initialLockout.remainingSeconds / 60)} دقيقة`);
      setPinInput('');
      return;
    }

    const isPinValid = await verifyPin(pinInput, u);
    if (!isPinValid) {
      const postLockout = getPinLockoutStatus(ident);
      if (postLockout.isLocked) {
        setErrorMsg('تم قفل الحساب مؤقتاً لمدة 5 دقائق بعد استنفاد 5 محاولات خاطئة');
      } else {
        setErrorMsg(`رمز الـ PIN غير صحيح (محاولة ${postLockout.failedAttempts} من 5)`);
      }
      setPinInput('');
      return;
    }

    const success = await switchActiveOperator(selectedUserUid, pinInput);
    if (success) {
      closeOperatorSwitchModal();
    } else {
      setErrorMsg('تعذر التبديل لهذا الحساب');
    }
  };

  const handleNumClick = (digit: string) => {
    if (pinInput.length < 6) {
      setPinInput(prev => prev + digit);
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  const selectedUserObj = selectedUserUid
    ? usersList.find(x => x.uid === selectedUserUid || x.id === selectedUserUid)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-[#FFFDF8] border border-[#D8CBB0] rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-[#FAF6EE] border-b border-[#EFE7D6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-[#A9762F]/15 text-[#A9762F]">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-serif font-black text-sm sm:text-base text-[#1F2A3C]">
                تبديل الموظف النشط / قفل الوردية
              </h3>
              <p className="text-[11px] text-[#64748B]">
                اختر الموظف أو الكاشير المسؤول لتسجيل اسمه على الفواتير
              </p>
            </div>
          </div>
          <button
            onClick={closeOperatorSwitchModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4">
          {!selectedUserUid ? (
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-[#3A4A63] block mb-1">
                اختر الحساب المراد التبديل إليه:
              </span>

              {/* Super Admin Option */}
              <button
                onClick={() => handleSelectUser(null)}
                className={`w-full p-3 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer ${
                  activeOperator === null
                    ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30'
                    : 'bg-white border-[#D8CBB0] hover:bg-[#FAF6EE]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-base">
                    👑
                  </div>
                  <div>
                    <b className="block text-xs font-bold text-[#1F2A3C]">حساب الإدارة الرئيسي (Super Admin)</b>
                    <span className="text-[10px] text-[#64748B]">صلاحيات كاملة 100% بدون حجب</span>
                  </div>
                </div>
                {activeOperator === null && (
                  <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
                    الحالي
                  </span>
                )}
              </button>

              {/* Staff List */}
              {usersList.map(u => {
                const preset = ROLE_PRESETS[u.role] || ROLE_PRESETS.cashier;
                const isSelected = activeOperator?.uid === u.uid || activeOperator?.id === u.id;
                const isActive = u.isActive !== false;

                return (
                  <button
                    key={u.id || u.uid}
                    disabled={!isActive}
                    onClick={() => handleSelectUser(u.uid || u.id || '')}
                    className={`w-full p-3 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/30'
                        : isActive
                        ? 'bg-white border-[#D8CBB0] hover:bg-[#FAF6EE]'
                        : 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#EFE7D6] flex items-center justify-center font-bold text-base">
                        {preset.icon || '👤'}
                      </div>
                      <div>
                        <b className="block text-xs font-bold text-[#1F2A3C]">{u.name}</b>
                        <span className="text-[10px] text-[#64748B]">
                          {preset.label.split(' ')[0]} {u.pinHash || u.pinCode ? '• محمي بـ PIN' : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <span className="text-[10px] bg-amber-500 text-white font-bold px-2 py-0.5 rounded-full">
                          الحالي
                        </span>
                      ) : (
                        <span className="text-xs text-[#A9762F] font-bold">دخول ←</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            /* PIN Screen for Selected User */
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-[#EFE7D6] flex items-center justify-center text-2xl font-bold">
                  {ROLE_PRESETS[selectedUserObj?.role || 'cashier']?.icon || '👤'}
                </div>
                <h4 className="font-serif font-black text-sm text-[#1F2A3C]">
                  {selectedUserObj?.name}
                </h4>
                <p className="text-xs text-[#64748B]">أدخل رمز الـ PIN للمتابعة</p>
              </div>

              {/* PIN Display Dots */}
              <div className="flex justify-center items-center gap-3 py-2">
                {[0, 1, 2, 3].map(idx => (
                  <div
                    key={idx}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      pinInput.length > idx
                        ? 'bg-[#A9762F] border-[#A9762F] scale-110'
                        : 'border-[#D8CBB0] bg-white'
                    }`}
                  />
                ))}
              </div>

              {errorMsg && (
                <div className="p-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center font-bold">
                  {errorMsg}
                </div>
              )}

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleNumClick(num)}
                    className="p-3.5 rounded-2xl bg-white border border-[#D8CBB0] hover:bg-[#FAF6EE] text-base font-mono font-black text-[#1F2A3C] shadow-2xs transition-all active:scale-95 cursor-pointer"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedUserUid(null)}
                  className="p-3.5 rounded-2xl bg-[#F6F1E7] text-xs font-bold text-[#64748B] hover:bg-[#EFE7D6] cursor-pointer"
                >
                  رجوع
                </button>
                <button
                  type="button"
                  onClick={() => handleNumClick('0')}
                  className="p-3.5 rounded-2xl bg-white border border-[#D8CBB0] hover:bg-[#FAF6EE] text-base font-mono font-black text-[#1F2A3C] shadow-2xs cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="p-3.5 rounded-2xl bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100 cursor-pointer"
                >
                  مسح ⌫
                </button>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => handleConfirmPin()}
                  disabled={pinInput.length === 0}
                  className="w-full py-2.5 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-xs sm:text-sm shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  تأكيد الدخول
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
