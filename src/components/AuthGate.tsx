import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { fsauth } from '../lib/firebase';
import { BookOpen, KeyRound, Mail, AlertCircle, LogIn } from 'lucide-react';
import { SHOP_NAME } from '../lib/constants';

export const AuthGate: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If user is authenticated with Firebase, allow application entry
  if (currentUser) {
    return <>{children}</>;
  }

  const getFriendlyAuthError = (code?: string, fallbackMsg?: string): string => {
    switch (code) {
      case 'auth/invalid-email':
        return 'صيغة البريد الإلكتروني غير صحيحة';
      case 'auth/user-disabled':
        return 'هذا الحساب معطل حالياً، تواصل مع الإدارة';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'البريد الإلكتروني أو كلمة السر غير صحيحة';
      case 'auth/email-already-in-use':
        return 'هذا البريد الإلكتروني مسجل بالفعل بالنظام';
      case 'auth/weak-password':
        return 'كلمة السر ضعيفة، يجب أن تتكون من 6 خانات على الأقل';
      case 'auth/network-request-failed':
        return 'تعذر الاتصال بالخادم، تحقق من اتصال الإنترنت';
      case 'auth/too-many-requests':
        return 'محاولات دخول كثيرة خاطئة، يرجى الانتظار قليلاً';
      default:
        return fallbackMsg || 'حدث خطأ أثناء التحقق من بيانات الدخول';
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('من فضلك أدخل البريد الإلكتروني وكلمة السر');
      return;
    }

    if (password.length < 6) {
      setError('كلمة السر يجب ألا تقل عن 6 خانات');
      return;
    }

    setLoading(true);
    try {
      await fsauth.signInWithEmailAndPassword(cleanEmail, password);
    } catch (err: any) {
      setError(getFriendlyAuthError(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  // Safe development pre-fill only if explicitly enabled via environment variable
  const isDevLoginAvailable =
    import.meta.env.DEV &&
    import.meta.env.VITE_ENABLE_DEV_LOGIN === 'true' &&
    !!import.meta.env.VITE_DEV_EMAIL;

  const handleDevFill = () => {
    if (isDevLoginAvailable) {
      setEmail(import.meta.env.VITE_DEV_EMAIL || '');
      setPassword(import.meta.env.VITE_DEV_PASSWORD || '');
    }
  };

  return (
    <div className="fixed inset-0 z-[20000] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-500 mx-auto flex items-center justify-center text-white shadow-lg shadow-amber-600/30 mb-4">
          <BookOpen className="w-8 h-8" />
        </div>

        <h2 className="font-bold text-2xl text-slate-900 mb-1 tracking-tight">مكتبتي</h2>
        <p className="text-xs text-slate-500 font-semibold mb-5">{SHOP_NAME} • بوابة الدخول الموحدة للمسؤول والموظفين</p>

        <form onSubmit={handleAuth} className="space-y-3.5 text-right">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
            <div className="relative">
              <input
                type="email"
                required
                autoComplete="email"
                className="w-full px-3 py-2.5 pr-9 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-900 font-medium"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute top-3.5 right-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">كلمة السر</label>
            <div className="relative">
              <input
                type="password"
                required
                autoComplete="current-password"
                className="w-full px-3 py-2.5 pr-9 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500 font-mono text-slate-900"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute top-3.5 right-3" />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 justify-center">
              <AlertCircle className="w-4 h-4 flex-none" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-md shadow-amber-600/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <span>جاري التحقق...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>تسجيل الدخول للنظام</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span className="text-[11px] text-slate-400">
            حسابات الموظفين تُدار حصرياً عبر المدير المسؤول
          </span>

          {isDevLoginAvailable && (
            <button
              type="button"
              onClick={handleDevFill}
              className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              [Dev Fill]
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
