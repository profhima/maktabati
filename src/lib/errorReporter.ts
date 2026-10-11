/**
 * Enterprise Crash Reporting & Error Telemetry Adapter
 * Ready for plug-and-play Sentry integration without hard dependency lock-in.
 */

export interface CrashReport {
  id: string;
  timestamp: string;
  message: string;
  name: string;
  stack?: string;
  componentStack?: string;
  context?: Record<string, any>;
  url: string;
  userAgent: string;
}

const ERROR_STORAGE_KEY = 'maktabati_recent_errors_v1';
const MAX_STORED_ERRORS = 10;

class ErrorReporter {
  private initialized = false;

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // Check if Sentry is available on window or initialized via script tag
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
    const sentryGlobal = (window as any).Sentry;

    if (sentryGlobal && sentryDsn) {
      try {
        sentryGlobal.init({
          dsn: sentryDsn,
          environment: import.meta.env.MODE || 'production',
          tracesSampleRate: 0.1
        });
        console.info('[ErrorReporter] Sentry initialized successfully.');
      } catch (err) {
        console.warn('[ErrorReporter] Sentry init note:', err);
      }
    }

    // Global uncaught error listener
    window.addEventListener('error', (event) => {
      this.captureException(event.error || new Error(event.message), {
        source: 'window.onerror',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason instanceof Error
        ? event.reason
        : new Error(typeof event.reason === 'string' ? event.reason : JSON.stringify(event.reason));

      const msg = reason.message || '';
      // Filter out harmless browser/IndexedDB teardown rejections when tab/iframe hides or unloads
      if (
        msg.includes('Database is closing') ||
        msg.includes('Database is hidden') ||
        msg.includes('ResizeObserver loop')
      ) {
        event.preventDefault();
        return;
      }

      this.captureException(reason, { source: 'unhandledrejection' });
    });
  }

  public captureException(error: Error | unknown, errorInfo?: any, extraContext?: Record<string, any>): CrashReport {
    const err = error instanceof Error ? error : new Error(String(error));
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const report: CrashReport = {
      id: errorId,
      timestamp: new Date().toISOString(),
      name: err.name || 'Error',
      message: err.message || 'Unknown error occurred',
      stack: err.stack,
      componentStack: errorInfo?.componentStack || errorInfo?.stack,
      context: {
        ...(errorInfo || {}),
        ...(extraContext || {})
      },
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    };

    // Structured enterprise console output
    console.error(`🚨 [CRASH REPORT ${report.id}] ${report.name}: ${report.message}`, {
      stack: report.stack,
      componentStack: report.componentStack,
      context: report.context
    });

    // Forward to Sentry if active
    try {
      const sentryGlobal = (window as any).Sentry;
      if (sentryGlobal && typeof sentryGlobal.captureException === 'function') {
        sentryGlobal.captureException(err, {
          extra: {
            errorId: report.id,
            componentStack: report.componentStack,
            context: report.context
          }
        });
      }
    } catch (_sentryErr) {}

    // Save recent reports for offline debugging and support export
    this.storeReportLocally(report);

    return report;
  }

  private storeReportLocally(report: CrashReport) {
    if (typeof sessionStorage === 'undefined') return;
    try {
      const existing: CrashReport[] = JSON.parse(sessionStorage.getItem(ERROR_STORAGE_KEY) || '[]');
      existing.unshift(report);
      if (existing.length > MAX_STORED_ERRORS) {
        existing.pop();
      }
      sessionStorage.setItem(ERROR_STORAGE_KEY, JSON.stringify(existing));
    } catch (_storageErr) {}
  }

  public getRecentReports(): CrashReport[] {
    if (typeof sessionStorage === 'undefined') return [];
    try {
      return JSON.parse(sessionStorage.getItem(ERROR_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  public clearReports() {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.removeItem(ERROR_STORAGE_KEY);
    } catch {}
  }
}

export const errorReporter = new ErrorReporter();
export const reportError = (error: Error | unknown, errorInfo?: any, extraContext?: Record<string, any>) =>
  errorReporter.captureException(error, errorInfo, extraContext);
