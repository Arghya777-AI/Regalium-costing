// ── SERVICE WORKER ────────────────────────────────────────────────────────────
// Regalium Cost Dashboard
//
// Strategy: network-first for all app code (HTML, JS, CSS, JSON).
// The SW skips waiting immediately on install so new code is live without
// any user action. Cache acts only as offline fallback.

const CACHE_NAME = 'regalium-v3';

// These hosts must always go straight to the network — never cache.
const NETWORK_ONLY_HOSTS = [
  'firebaseapp.com',
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'lh3.googleusercontent.com',
  'ipapi.co',
  'api.anthropic.com',
  'cdn.jsdelivr.net',
  'gstatic.com',
];

function isNetworkOnly(url) {
  return NETWORK_ONLY_HOSTS.some(h => url.hostname.includes(h));
}

// App-shell resources: network-first so deploys are instant.
function isAppShell(url) {
  if (url.origin !== self.location.origin) return false;
  const p = url.pathname;
  return (
    p === '/' ||
    p.endsWith('.html') ||
    p.endsWith('.js')   ||
    p.endsWith('.css')  ||
    p.endsWith('.json')
  );
}

// ── Install: cache app shell, then take over immediately ─────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      '/', '/index.html', '/manifest.json',
      '/css/styles.css',
      '/js/data.js', '/js/compute.js', '/js/utils.js', '/js/render.js',
      '/js/edit.js', '/js/charts.js', '/js/formula.js', '/js/keyboard.js',
      '/js/tableops.js', '/js/tab-builder.js', '/js/smartsheet.js',
      '/js/datastudio.js', '/js/activity-tracker.js', '/js/auth-manager.js',
      '/js/admin-panel.js', '/js/firebase-app.js', '/js/main.js', '/js/pwa.js',
    ]).catch(() => {}))
  );
  // Skip waiting immediately — new SW activates without requiring all tabs to close.
  self.skipWaiting();
});

// ── Activate: delete stale caches, claim all open clients ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('regalium-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never intercept external services
  if (isNetworkOnly(url) || url.protocol === 'chrome-extension:') return;

  if (isAppShell(url)) {
    // Network-first: always fetch fresh; cache is the offline fallback only.
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (res && res.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Everything else (icons, images): cache-first.
  event.respondWith(
    caches.match(event.request).then(cached =>
      cached || fetch(event.request).then(res => {
        if (res && res.ok) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        }
        return res;
      })
    )
  );
});

// Keep message handler so manual pwaApplyUpdate() still works if ever called.
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
