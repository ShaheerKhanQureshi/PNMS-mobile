/* PNMS service worker - deliberately minimal and security-first.
 *
 * WHAT IS CACHED: only versioned, non-sensitive static files of THIS origin: Vite's hashed bundles under /assets/,
 * the application icons, the manifest, the logo and the generic offline page.
 * WHAT IS NEVER TOUCHED: /api/*, /health/*, every non-GET request, every cross-origin request, and HTML documents.
 * Those are not intercepted at all (no respondWith), so the browser talks to the network exactly as without a
 * service worker: no patient data, MR numbers, reports, sessions, CSRF tokens, login responses or exports are ever
 * written to a cache, and there is no offline report creation or background sync.
 * Page navigations are network-only; if the network is down a generic "Connection required" page is shown
 * (it contains no user data and never pretends anything was submitted).
 * UPDATES: a new worker waits; it activates only when the user presses "Refresh" in the app (SKIP_WAITING message),
 * so a nurse or pharmacist in the middle of a scan or report is never reloaded.
 */
const VERSION = 'pnms-static-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/offline.js', '/manifest.webmanifest', '/pwa-192.png', '/pwa-512.png', '/apple-touch-icon.png', '/images/clf-logo.webp'];
const STATIC_PREFIXES = ['/assets/'];
const STATIC_FILES = new Set(PRECACHE);

self.addEventListener('install', (event) => {
  // No skipWaiting() here on purpose (see UPDATES above).
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('pnms-') && key !== VERSION).map((key) => caches.delete(key)))),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isStaticAsset(url) {
  return STATIC_FILES.has(url.pathname) || STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Page loads: network only, generic offline page when unreachable.
  if (request.mode === 'navigate') {
    if (url.origin !== self.location.origin) return;
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || new Response('Connection required', { status: 503 })),
    );
    return;
  }

  // Everything sensitive or dynamic is left completely alone.
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/api' ||
    url.pathname.startsWith('/health') ||
    !isStaticAsset(url)
  ) {
    return;
  }

  // Static, versioned files: cache first, fill from the network. Only complete same-origin 200 responses are stored.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
