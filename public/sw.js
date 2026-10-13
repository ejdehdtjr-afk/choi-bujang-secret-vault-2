const CACHE = 'byte-back-shell-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([OFFLINE, '/icon.svg', '/icon-192.png', '/icon-512.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('byte-back-shell-') && key !== CACHE)
    .map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !request.mode.includes('navigate')) return;
  // Never cache authenticated pages, API responses, tokens, or note content.
  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE)));
});
