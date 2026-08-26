import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { detectBrowser, detectAndroid } from '../utils/installInstructions';
import { isNative } from '../utils/native';

const PWAContext = createContext(null);

const DISMISSED_KEY = 'datad-pwa-install-dismissed';

// Long enough that the card never flashes during load.
const PROMPT_DELAY_MS = 3000;
// Chrome can fire `beforeinstallprompt` a beat late; wait past PROMPT_DELAY_MS
// before falling back to manual instructions so we don't show the worse UI to
// a browser that was about to give us the real one.
const FALLBACK_DELAY_MS = 6000;

// In the Capacitor shell the app is, definitionally, already installed — it
// came from the Play Store or the App Store. Without this the WebView takes the
// desktop-fallback branch below (no `beforeinstallprompt`, not iOS Safari) and
// after six seconds shows a student who just installed the app a card telling
// them to "Open the browser menu" and "Add to Home screen" — inside the very
// app it is asking them to install. There is no browser menu to open.
//
// Answered here rather than by the display-mode queries: a WebView is not
// reliably `display-mode: standalone`, and `navigator.standalone` is Safari's.
function isStandalone() {
  if (isNative) return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true
  );
}

// iPadOS reports as MacIntel but has touch; iPhones/iPods report directly.
function detectIOS() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function PWAProvider({ children }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [cacheSize, setCacheSize] = useState(null);
  const swReg = useRef(null);

  const isIOS = detectIOS();
  const isAndroid = detectAndroid();
  const browser = detectBrowser();

  // `deferredPrompt` read from inside a timeout would be stale, so mirror it.
  const deferredRef = useRef(null);

  // Install prompt
  useEffect(() => {
    if (installed || localStorage.getItem(DISMISSED_KEY)) return undefined;

    const timers = [];

    const onBIP = (e) => {
      e.preventDefault();
      deferredRef.current = e;
      setDeferredPrompt(e);
      timers.push(setTimeout(() => setShowInstallPrompt(true), PROMPT_DELAY_MS));
    };
    const onInstalled = () => {
      setInstalled(true);
      setShowInstallPrompt(false);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);

    if (isIOS) {
      // iOS Safari never fires beforeinstallprompt — go straight to the
      // "Add to Home Screen" instructions.
      timers.push(setTimeout(() => setShowInstallPrompt(true), PROMPT_DELAY_MS));
    } else {
      // Desktop Safari and Firefox never fire it either, and Chrome withholds
      // it until its own engagement heuristic is met. If nothing arrived by
      // now, show manual instructions rather than nothing at all.
      timers.push(setTimeout(() => {
        if (!deferredRef.current) setShowInstallPrompt(true);
      }, FALLBACK_DELAY_MS));
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
      timers.forEach(clearTimeout);
    };
  }, [installed, isIOS]);

  // Online / offline
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Service worker lifecycle + messages
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let onVisible;

    navigator.serviceWorker.ready.then((reg) => {
      swReg.current = reg;

      // Detect waiting worker (update available)
      if (reg.waiting) setUpdateAvailable(true);
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
          }
        });
      });

      // The worker no longer activates itself on install — this banner is the
      // only path to a new version. An installed PWA can stay open for days
      // without a navigation, and the browser's own re-check is roughly daily,
      // so ask on every return to the tab.
      onVisible = () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      };
      document.addEventListener('visibilitychange', onVisible);
    });

    const onMessage = (e) => {
      if (e.data?.type === 'CACHE_SIZE') setCacheSize(e.data.size);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    // Controller change = new SW took over → reload for fresh content
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      if (onVisible) document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    deferredRef.current = null;
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  function dismissInstall() {
    setShowInstallPrompt(false);
    localStorage.setItem(DISMISSED_KEY, '1');
  }

  function applyUpdate() {
    swReg.current?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    setUpdateAvailable(false);
  }

  function clearCache() {
    if (!('serviceWorker' in navigator)) return Promise.resolve();
    return navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: 'CLEAR_CACHE' });
    });
  }

  function requestCacheSize() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: 'GET_CACHE_SIZE' });
    });
  }

  return (
    <PWAContext.Provider value={{
      showInstallPrompt,
      installed,
      isIOS,
      isAndroid,
      browser,
      // 'prompt' = the browser gave us a real install prompt to fire;
      // 'manual' = it never will, so show step-by-step instructions.
      installMode: deferredPrompt ? 'prompt' : 'manual',
      isOnline,
      updateAvailable,
      cacheSize,
      deferredPrompt,
      installApp,
      dismissInstall,
      applyUpdate,
      clearCache,
      requestCacheSize,
    }}>
      {children}
    </PWAContext.Provider>
  );
}

export const usePWA = () => {
  const ctx = useContext(PWAContext);
  if (!ctx) throw new Error('usePWA must be used inside PWAProvider');
  return ctx;
};
