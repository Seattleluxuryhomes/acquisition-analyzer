// BidVoice service worker — makes the app installable and launchable offline.
// Strategy: network-first for page navigations (so a fresh deploy is never stuck
// behind a stale cache), cache-first for static assets, and NEVER touch dynamic
// routes (/api/*, /p/*) so data and private files always go to the network.
const CACHE = 'bt-v3';   // bumped: BidVoice rebrand — old cached shell is cleared on activate
const SHELL = ['/', '/index.html', '/landing.html', '/manifest.json',
  '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png',
  '/brand-tile.png', '/brand-white.png', '/brand-orange.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // never cache mutations
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // only same-origin
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/p/')) return; // dynamic → network

  if (req.mode === 'navigate') {                          // pages: network-first
    e.respondWith(
      fetch(req)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); return res; })
        .catch(() => caches.match(req).then((r) => r || caches.match('/') || caches.match('/index.html')))
    );
    return;
  }

  e.respondWith(                                          // assets: cache-first
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {}); }
      return res;
    }).catch(() => hit))
  );
});
