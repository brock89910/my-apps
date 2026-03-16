// Osakahibachi Inventory — Service Worker
// Caches the app so it loads instantly with no internet (Costco, walk-in freezer)

const CACHE_NAME = 'osaka-inventory-v2';

// Everything the app needs to run offline
const ASSETS = [
  'osakahibachi-stock.html',
  'manifest.json',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap',
];

// ── INSTALL: cache all assets ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        // Font CDN might fail offline during first install — that's ok
        console.log('Some assets failed to cache:', err);
      });
    })
  );
  // Activate immediately without waiting for old tabs to close
  self.skipWaiting();
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: serve from cache when offline ──
// Strategy: Network first, fall back to cache
// This means: try to get fresh data, but if no signal, serve the cached version
self.addEventListener('fetch', event => {
  // Don't intercept Firebase/Google API calls — let those fail gracefully
  // The app handles Firebase offline via localStorage fallback
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('google') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('gstatic')
  ) {
    return; // Let Firebase SDK handle its own requests
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Got a fresh response — update the cache
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // No network — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // If nothing in cache either, return a simple offline page
          return new Response(
            '<html><body style="font-family:sans-serif;padding:40px;text-align:center">' +
            '<h2>📵 No connection</h2>' +
            '<p>Open the app while connected at least once to enable offline mode.</p>' +
            '</body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});
