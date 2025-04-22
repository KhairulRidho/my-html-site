const CACHE_NAME = 'menu-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/data/items.json',  // Cache file JSON yang berisi data item
];

// Install Service Worker dan cache file yang dibutuhkan
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Cek cache terlebih dahulu sebelum mencoba fetch data dari internet
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Jika ada di cache, langsung kembalikan dari cache
        if (response) {
          return response;
        }

        // Kalau nggak ada di cache, lakukan fetch ke server
        return fetch(event.request)
          .then((networkResponse) => {
            // Jika request ke server berhasil, cache responsenya
            return caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              });
          });
      })
  );
});

// Hapus cache lama saat ada update service worker
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
