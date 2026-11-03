// Vasnapló offline cache
const CACHE = 'vasnaplo-v7';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (e) => {
  // cache: 'reload' = mindig a friss fájlt kérjük le, ne a böngésző régi példányát
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Csak a saját régi tárolóit törli, a másik app (ugyanazon a címen) tárolóját nem.
  const prefix = CACHE.split('-v')[0] + '-v';
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith(prefix) && k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Értesítés érkezett: megjelenítjük
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Értesítés', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: d.tag || undefined,
    data: { url: './#kozos' }
  }));
});

// Rákoppintottak: megnyitjuk vagy előhozzuk az appot
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(target);
  }));
});

// Először a tárolt változatot adja (gyors, offline is megy), közben frissít a háttérben.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // Csak az app saját fájljait és a betűtípusokat tároljuk; a közös tábla mindig élőben megy.
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !fonts) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      // Oldalbetöltésnél (navigate) nem lehet módosítani a kérést, ezért újat készítünk belőle.
      const fresh = e.request.mode === 'navigate'
        ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
        : new Request(e.request, { cache: 'no-cache' });
      const net = fetch(fresh).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || net;
    })
  );
});
