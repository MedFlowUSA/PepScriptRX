const CLEANUP_CACHE = 'pepscriptrx-cleanup-20260617';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CLEANUP_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Keep the app online-first. Existing browsers may still request this worker,
// but it should not intercept navigations or hashed Vite assets.
