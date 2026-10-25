const CACHE_NAME = 'mydiary-cache-v7';
const ASSETS = [
  'index.html',
  'HomeStyle.css',
  'HomeScript.js',
  'ojhag.png'
];

// Install Event - caching files
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - cleanup old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - serve cached content when offline
self.addEventListener('fetch', (e) => {
  // Skip cross-origin requests (like Supabase & Cloudinary API calls) from caching
  if (!e.request.url.startsWith(self.location.origin)) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => {
        // Optional fallback for offline navigation
      });
    })
  );
});