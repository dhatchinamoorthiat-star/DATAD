import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App.jsx';

// Sentry is gated on the DSN env var — no DSN = no crash reporting overhead.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,           // student names are ok to see
        blockAllMedia: false,         // don't block images
      }),
    ],
    tracesSampleRate: 0.25,          // 1-in-4 sessions for performance
    replaysSessionSampleRate: 0.1,   // 1-in-10 session replays
    replaysOnErrorSampleRate: 1.0,   // always capture replay on error
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please refresh the page.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);

// Register service worker — PWAContext handles update prompts & lifecycle
// Only in production: in dev it intercepts Vite's module/HMR requests and breaks the app.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('SW registration failed:', err));
  });
} else if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  // A worker registered by an older build (before the PROD gate above existed)
  // can still be controlling this origin. It keeps cycling install/activate,
  // firing `controllerchange` in PWAContext and reloading the page every few
  // seconds. Kill any leftover registration and its caches so dev stays clean.
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => reg.unregister());
  });
  if ('caches' in window) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}
