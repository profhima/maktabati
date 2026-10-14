import React from 'react';
import { ShieldAlert, AlertOctagon, LogOut, RefreshCw } from 'lucide-react';
import { fsauth } from '../lib/firebase';
import { UserProfile } from '../types';

export interface MissingProfileScreenProps {
  currentUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  };
  onSignOut?: () => void;
}

export const MissingProfileScreen: React.FC<MissingProfileScreenProps> = ({
  currentUser,
  onSignOut
}) => {
  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      fsauth.signOut();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 mx-auto flex items-center justify-center shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          لا يوجد ملف صلاحيات لهذا الحساب
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          تم التحقق من بيانات الدخول، ولكن حسابك لم يُربط بعد بملف موظف أو صلاحيات في نظام المتجر. يُرجى التواصل مع المدير المسؤول لتعيين صلاحياتك.
        </p>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right text-xs text-slate-500 font-mono space-y-1">
          <div><span className="font-sans font-bold text-slate-700">المستخدم:</span> {currentUser.email || currentUser.displayName || 'بدون بريد'}</div>
          <div><span className="font-sans font-bold text-slate-700">المعرّف (UID):</span> {currentUser.uid}</div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};

export interface AccountDisabledScreenProps {
  currentUser: {
    uid: string;
    email?: string | null;
  };
  currentProfile: UserProfile;
  onSignOut?: () => void;
}

export const AccountDisabledScreen: React.FC<AccountDisabledScreenProps> = ({
  currentUser,
  currentProfile,
  onSignOut
}) => {
  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      fsauth.signOut();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 mx-auto flex items-center justify-center shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          هذا الحساب معطّل حالياً
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          تم إيقاف تفعيل حسابك من قِبل إدارة النظام. يُرجى مراجعة المسؤول لإعادة تفعيل الحساب وتمكين الوصول للمتجر.
        </p>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right text-xs text-slate-500 font-mono space-y-1">
          <div><span className="font-sans font-bold text-slate-700">الموظف:</span> {currentProfile.name}</div>
          <div><span className="font-sans font-bold text-slate-700">البريد:</span> {currentUser.email || currentProfile.email || 'غير مسجل'}</div>
          <div><span className="font-sans font-bold text-slate-700">المعرّف (UID):</span> {currentUser.uid}</div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );
};

export interface ProfileVerificationErrorScreenProps {
  currentUser: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
  };
  errorMessage?: string | null;
  onRetry: () => void;
  onSignOut?: () => void;
}

export const ProfileVerificationErrorScreen: React.FC<ProfileVerificationErrorScreenProps> = ({
  currentUser,
  errorMessage,
  onRetry,
  onSignOut
}) => {
  const handleSignOut = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      fsauth.signOut();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 mx-auto flex items-center justify-center shadow-inner">
          <AlertOctagon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">
          تعذر التحقق من بيانات وصلاحيات الحساب
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          تعذر الاتصال بخادم النظام أو حدث خطأ أثناء فحص الصلاحيات. لحماية أمان المتجر والبيانات المالية، تم تعليق الدخول مؤقتاً لحين إعادة المحاولة والتأكد من الصلاحيات.
        </p>
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-right text-xs text-slate-500 font-mono space-y-1">
          <div><span className="font-sans font-bold text-slate-700">المستخدم:</span> {currentUser.email || currentUser.displayName || 'بدون بريد'}</div>
          <div><span className="font-sans font-bold text-slate-700">المعرّف (UID):</span> {currentUser.uid}</div>
          {errorMessage && (
            <div className="text-rose-600 truncate mt-1">
              <span className="font-sans font-bold">الخطأ:</span> {errorMessage}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onRetry}
            className="py-3 px-4 rounded-xl bg-[#A9762F] hover:bg-[#96682A] text-white font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
          <button
            onClick={handleSignOut}
            className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-slate-300"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );
};
