// ── SERVICE WORKER ────────────────────────────────────────────────────────────
// Regalium Cost Dashboard — PWA caching + update detection
// Bump CACHE_VERSION to force update notification on next deploy.

const CACHE_VERSION = 'v1';
const CACHE_NAME    = `regalium-${CACHE_VERSION}`;

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/styles.css',
  '/icons/icon.svg',
  '/js/local-config.js',
  '/js/data.js',
  '/js/utils.js',
  '/js/compute.js',
  '/js/edit.js',
  '/js/render.js',
  '/js/charts.js',
  '/js/datastudio.js',
  '/js/smartsheet.js',
  '/js/tableops.js',
  '/js/tab-builder.js',
  '/js/keyboard.js',
  '/js/formula.js',
  '/js/firebase-app.js',
  '/js/activity-tracker.js',
  '/js/auth-manager.js',
  '/js/admin-panel.js',
  '/js/pwa.js',
  '/js/main.js'
];

// Hosts that must always go to the network
const NETWORK_ONLY = [
  'firebaseapp.com',
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'lh3.googleusercontent.com',
  'ipapi.co',
  'api.anthropic.com',
  'cdn.jsdelivr.net',
  'gstatic.com'
];

// ── Install: precache app shell ───────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .catch(e => console.warn('SW precache error (non-fatal):', e))
  );
  // Do NOT skipWaiting here — let the app decide when to update
});

// ── Activate: clean old caches ────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('regalium-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for app shell ───────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (NETWORK_ONLY.some(h => url.hostname.includes(h))) return;
  if (url.protocol === 'chrome-extension:') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(res => {
          if (res && res.ok && res.type !== 'opaque') {
            cache.put(event.request, res.clone());
          }
          return res;
        }).catch(() => null);
        // Return cached immediately; revalidate in background
        return cached || networkFetch;
      })
    )
  );
});

// ── Messages from app ─────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
