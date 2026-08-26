import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';

// Fonts, self-hosted.
//
// These used to come from fonts.googleapis.com, which meant every visitor's
// browser announced itself to Google before the first paint — on a page whose
// own hero badge promises "No tracking". Serving them from our own origin
// makes that claim true, and removes a third-party render-blocking request
// from the critical path.
//
// Latin subsets only: the product is in English, and the Cyrillic/Greek/
// Vietnamese cuts would only ever sit unused in the bundle. Weights match
// tailwind.config.js — Inter 400-700 for body, JetBrains Mono 400-600 for the
// terminal skin and code, Syne 700/800 for the wordmark alone.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/syne/latin-700.css';
import '@fontsource/syne/latin-800.css';

import './index.css';
import App from './App.jsx';
import { installGlobalErrorReporting } from './utils/reportError';
import { isNative } from './utils/native';

// Sentry is gated on the DSN env var — no DSN = no crash reporting overhead.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || 'development',
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Masked, reversing the previous setting.
        //
        // The old comment read "student names are ok to see", and for a name on
        // a dashboard that is true. But replay records whatever is on screen,
        // and the screens here include private notes, the résumé editor, the
        // finance tracker, and the onboarding answers the M2 fix just stopped
        // showing to other students. Sending those to a third-party replay
        // service would reintroduce that exposure through a side door, and with
        // a longer retention than our own database.
        //
        // Masking costs the ability to read exact copy in a replay; the layout,
        // the clicks, and the sequence — which is what a replay is actually for
        // — all survive.
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.25,          // 1-in-4 sessions for performance
    replaysSessionSampleRate: 0.1,   // 1-in-10 session replays
    replaysOnErrorSampleRate: 1.0,   // always capture replay on error

    /**
     * Last gate before an event leaves the browser.
     *
     * Two things the SDK will otherwise send: the full URL including any query
     * string, and request headers. A password-reset or verification link puts a
     * single-use token in the query string, so a captured error on that page
     * would ship a working token to a third party.
     */
    beforeSend(event) {
      const strip = (url) => (typeof url === 'string' ? url.split('?')[0] : url);
      if (event.request) {
        event.request.url = strip(event.request.url);
        delete event.request.headers;
        delete event.request.cookies;
      }
      for (const crumb of event.breadcrumbs || []) {
        if (crumb.data?.url) crumb.data.url = strip(crumb.data.url);
      }
      return event;
    },
  });
}

// Covers what React error boundaries structurally cannot see: errors thrown in
// event handlers and async callbacks, and rejected promises nobody awaited.
// Installed unconditionally — it reports to our own API, so it works with no
// Sentry DSN configured.
installGlobalErrorReporting();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. Please refresh the page.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);

// Register service worker — PWAContext handles update prompts & lifecycle
// Only in production: in dev it intercepts Vite's module/HMR requests and breaks the app.
//
// And never inside the Capacitor shell. There the bundle is served from the
// app's own local origin, so a worker would cache assets the store already
// versions — and PWAContext would then offer "a new version is available,
// reload" for a build that can only actually change through an App Store
// update. See utils/native.js.
if (!isNative && import.meta.env.PROD && 'serviceWorker' in navigator) {
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
