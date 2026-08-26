// DATAD Service Worker — v5
// Cache strategy:
//   • /assets/* + fonts → cache-first (content-hashed, so immutable)
//   • Navigation        → network-first, cached page, then offline.html
//   • API               → network-only (never cached)
//   • Everything else   → stale-while-revalidate

const CACHE_VERSION = 'v5';
const STATIC_CACHE  = `datad-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `datad-dynamic-${CACHE_VERSION}`;

// App shell — precache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// ── Install ──────────────────────────────────────────────────────────────────
// No skipWaiting() here on purpose. A new worker waits until the user accepts
// the update in UpdateBanner, which posts SKIP_WAITING below. Activating on
// install instead would claim the clients mid-session and force a reload
// through PWAContext's controllerchange handler, discarding unsaved work.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE_URLS))
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  const keep = [STATIC_CACHE, DYNAMIC_CACHE];
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Message ───────────────────────────────────────────────────────────────────
// Receive SKIP_WAITING from the update-available UI
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
  if (e.data?.type === 'GET_CACHE_SIZE') {
    getCacheSize().then((size) => e.source.postMessage({ type: 'CACHE_SIZE', size }));
  }
});

// ── Push ─────────────────────────────────────────────────────────────────────
// The only path that reaches the student when the app is closed. Everything
// else in this file is a cache; this is a delivery channel.
self.addEventListener('push', (e) => {
  // Payload is JSON from PushService.sendToUser. Push services are also allowed
  // to wake a worker with no data at all, so nothing here may assume a body.
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = { title: 'DATAD', body: e.data?.text?.() || '' };
  }

  const title = data.title || 'DATAD';

  e.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      // Collapses repeat banners for one notification rather than stacking
      // them — the same job groupCount does in the bell.
      tag: data.id || data.type || 'datad',
      renotify: false,
      data: { link: data.link || '/', id: data.id },
    })
  );
});

// Tapping a banner should land on the thing it is about, and should reuse an
// already-open DATAD window rather than opening a second copy of the PWA.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const link = e.notification.data?.link || '/';
  const url = new URL(link, self.location.origin).href;

  e.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((wins) => {
        for (const win of wins) {
          if (win.url.startsWith(self.location.origin) && 'focus' in win) {
            // navigate() can reject (cross-origin, or a client that has since
            // gone away); focusing is the part that matters.
            win.navigate?.(url).catch(() => {});
            return win.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never intercept cross-origin, chrome-extension, or non-http
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return;

  // Never intercept API calls — always go to network
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests: network-first, cache as fallback, offline.html last resort
  if (request.mode === 'navigate') {
    e.respondWith(networkFirstNav(request));
    return;
  }

  // Static assets (Vite hashed filenames): cache-first
  if (isStaticAsset(url.pathname)) {
    e.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Everything else: stale-while-revalidate (dynamic pages, icons, fonts)
  e.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// ── Strategies ───────────────────────────────────────────────────────────────

async function networkFirstNav(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await caches.match('/index.html');
    if (shell) return shell;
    return caches.match('/offline.html');
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok) {
      const c = await caches.open(cacheName);
      c.put(request, res.clone());
    }
    return res;
  } catch {
    return unavailableOffline();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((res) => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  if (cached) return cached;
  const fetched = await fetchPromise;
  if (fetched) return fetched;
  // offline.html is a navigation fallback only. Returning it for a script or
  // stylesheet hands the browser an HTML body under the asked-for MIME type,
  // which `X-Content-Type-Options: nosniff` then rejects outright — a blank
  // page instead of the offline screen.
  return unavailableOffline();
}

function unavailableOffline() {
  return new Response('Unavailable offline', {
    status: 503,
    statusText: 'Offline',
    headers: { 'Content-Type': 'text/plain' },
  });
}

// Vite emits `assets/AboutPage-CRYsU4QL.js` — a dash before a mixed-case
// base64url hash, not `name.a1b2c3d4.js`. Everything Vite puts under /assets/
// is content-hashed and therefore immutable, so match the directory rather
// than trying to re-derive the hash format.
function isStaticAsset(pathname) {
  return pathname.startsWith('/assets/') ||
    /\.(woff2?|ttf|otf|eot)$/.test(pathname);
}

// ── Cache size (Settings → App → Cache size) ─────────────────────────────────
async function getCacheSize() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const { usage } = await navigator.storage.estimate();
    return usage || 0;
  }
  return 0;
}
