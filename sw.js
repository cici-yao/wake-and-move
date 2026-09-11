// Wake & Move — service worker
// Caches the app shell so the page can load offline / install as a PWA.
// Note: this does NOT make the pose-detection model work offline — MoveNet's
// weights are fetched from a CDN on first use and need a network connection.

const CACHE_NAME = 'wake-and-move-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isAppShellDoc =
    event.request.mode === 'navigate' ||
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('manifest.json');

  // Network-first for the page itself (and the manifest): a stale cached
  // index.html silently serving old code after every new deploy is a much
  // worse failure mode during active development than one extra network
  // round trip. Falls back to whatever's cached only when offline.
  if (isAppShellDoc) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (icons, CDN scripts, model weights) —
  // these rarely change, so serving from cache first is fine and faster,
  // and a live connection is still required the first time each resource
  // is requested.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          // Only cache successful, basic (same-origin) responses to keep
          // this simple and avoid storing large opaque cross-origin blobs
          // indefinitely from the CDN.
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
