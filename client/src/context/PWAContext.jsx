import { createContext, useContext, useEffect, useRef, useState } from 'react';

const PWAContext = createContext(null);

const DISMISSED_KEY = 'datad-pwa-install-dismissed';

function isStandalone() {
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

  // Install prompt
  useEffect(() => {
    const onBIP = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!installed && !localStorage.getItem(DISMISSED_KEY)) {
        // Slight delay so it doesn't flash immediately on load
        setTimeout(() => setShowInstallPrompt(true), 3000);
      }
    };
    const onInstalled = () => {
      setInstalled(true);
      setShowInstallPrompt(false);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);

    // iOS Safari never fires beforeinstallprompt — show the card with
    // "Add to Home Screen" instructions instead.
    let iosTimer;
    if (isIOS && !installed && !localStorage.getItem(DISMISSED_KEY)) {
      iosTimer = setTimeout(() => setShowInstallPrompt(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
      if (iosTimer) clearTimeout(iosTimer);
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
