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
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(() => {
    const v = localStorage.getItem('datad-last-synced');
    return v ? new Date(v) : null;
  });
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

  function triggerBackgroundSync() {
    const reg = swReg.current;
    if (!reg) return;
    if (reg.sync) {
      // Chromium: real Background Sync — fires even if the tab closes
      reg.sync.register('datad-background-sync').catch(() => {
        reg.active?.postMessage({ type: 'FLUSH_QUEUE' });
      });
    } else {
      // iOS Safari / Firefox: no Sync API — flush the queue directly
      reg.active?.postMessage({ type: 'FLUSH_QUEUE' });
    }
  }

  // Online / offline
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      triggerBackgroundSync();
    };
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
    });

    const onMessage = (e) => {
      if (e.data?.type === 'SYNC_START') setSyncing(true);
      if (e.data?.type === 'SYNC_DONE') {
        setSyncing(false);
        const now = new Date();
        setLastSynced(now);
        localStorage.setItem('datad-last-synced', now.toISOString());
      }
      if (e.data?.type === 'CACHE_SIZE') setCacheSize(e.data.size);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    // Controller change = new SW took over → reload for fresh content
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload(); }
    });

    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
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
      syncing,
      lastSynced,
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
