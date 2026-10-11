import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerMaktabatiServiceWorker } from './lib/offlineSync';
import { ErrorBoundary } from './components/ErrorBoundary';
import { errorReporter } from './lib/errorReporter';

// Initialize global crash reporter
errorReporter.init();

// Register PWA service worker for full offline mode in production only
if (import.meta.env.PROD) {
  registerMaktabatiServiceWorker();
} else {
  // In development, ensure any stale service worker is completely unregistered and caches purged
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
  if (typeof window !== 'undefined' && 'caches' in window) {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key);
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
