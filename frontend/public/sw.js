// Red Ops service worker — network-first with offline fallback.
// Activated only in production builds (see src/index.js).

const CACHE = 'redops-v2';
const OFFLINE_PAGE = '/offline.html';

self.addEventListener('install', (e) => {
  // Pre-cache the offline page so it's always available
  e.waitUntil(
    caches.open(CACHE).then((c) => c.add(OFFLINE_PAGE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // Never cache API calls — they must always go to the network.
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Opportunistically cache successful same-origin responses.
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        // Try cache first, fall back to offline page for navigation requests
        caches.match(e.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests (HTML pages), show the branded offline page
          if (e.request.mode === 'navigate') {
            return caches.match(OFFLINE_PAGE);
          }
          return cached; // undefined — browser shows default error
        })
      )
  );
});
