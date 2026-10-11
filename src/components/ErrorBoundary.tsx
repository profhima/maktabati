import React, { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Copy, Check, Home, ShieldAlert } from 'lucide-react';
import { reportError, CrashReport } from '../lib/errorReporter';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  crashReport: CrashReport | null;
  copied: boolean;
  showDetails: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      crashReport: null,
      copied: false,
      showDetails: false
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const report = reportError(error, errorInfo, {
      boundary: 'GlobalErrorBoundary',
      location: typeof window !== 'undefined' ? window.location.pathname : ''
    });

    this.setState({
      errorInfo,
      crashReport: report
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      crashReport: null,
      copied: false,
      showDetails: false
    });
  };

  private handleGoHome = () => {
    window.location.href = window.location.origin;
  };

  private handleCopy = async () => {
    const { error, errorInfo, crashReport } = this.state;
    const text = [
      `=== تقرير خطأ نظام مكتبتي ===`,
      `معرف الخطأ: ${crashReport?.id || 'N/A'}`,
      `الوقت: ${crashReport?.timestamp || new Date().toISOString()}`,
      `رسالة الخطأ: ${error?.message || 'Unknown'}`,
      `مسار الخطأ: ${error?.stack || 'N/A'}`,
      `Component Stack: ${errorInfo?.componentStack || 'N/A'}`
    ].join('\n\n');

    try {
      await navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 3000);
    } catch (_err) {
      console.warn('Could not copy to clipboard');
    }
  };

  public render() {
    if (this.state.hasError) {
      const { error, errorInfo, crashReport, copied, showDetails } = this.state;

      return (
        <div
          dir="rtl"
          className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4 selection:bg-rose-500 selection:text-white"
        >
          <div className="bg-slate-800 border border-slate-700 rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl space-y-6">
            {/* Header Icon */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-none shadow-inner">
                <AlertOctagon className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {this.props.fallbackTitle || 'حدث استثناء غير متوقع بالنظام'}
                </h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  تم حماية بياناتك ومنع انهيار التطبيق بواسطة Enterprise Error Boundary
                </p>
              </div>
            </div>

            {/* Error Summary Box */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  معرّف الحادثة (Crash ID):
                </span>
                <span className="font-mono text-amber-400 font-bold tracking-wider">
                  {crashReport?.id || 'err_unknown'}
                </span>
              </div>

              <p className="font-mono text-rose-300 bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/50 break-all leading-relaxed">
                {error?.message || 'Unknown runtime error'}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={this.handleReload}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة تحميل الصفحة</span>
              </button>

              <button
                onClick={this.handleReset}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-600"
              >
                <RefreshCw className="w-4 h-4" />
                <span>محاولة استئناف الواجهة</span>
              </button>

              <button
                onClick={this.handleGoHome}
                className="w-full sm:w-auto p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all cursor-pointer border border-slate-700"
                title="العودة للشاشة الرئيسية"
              >
                <Home className="w-4 h-4" />
              </button>
            </div>

            {/* Technical Details Accordion */}
            <div className="pt-2 border-t border-slate-700/50">
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => this.setState({ showDetails: !showDetails })}
                  className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                >
                  {showDetails ? 'إخفاء التفاصيل الفنية ▴' : 'عرض التفاصيل الفنية للخطأ ▾'}
                </button>

                <button
                  type="button"
                  onClick={this.handleCopy}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 transition-all cursor-pointer text-[11px]"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">تم النسخ بنجاح</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ تقرير الدعم الفني</span>
                    </>
                  )}
                </button>
              </div>

              {showDetails && (
                <pre className="mt-3 p-3 bg-black/60 rounded-xl text-[10px] font-mono text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                  {error?.stack || ''}
                  {errorInfo?.componentStack ? `\n\nComponent Stack:\n${errorInfo.componentStack}` : ''}
                </pre>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
