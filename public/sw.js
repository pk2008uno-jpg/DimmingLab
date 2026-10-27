/**
 * DimmingLab - Service Worker for Offline Classroom Support
 * Precaches application assets and scientific datasets so the app operates
 * with zero network access during classroom activities or school outages.
 */

const CACHE_NAME = 'dimminglab-offline-v1';

const REQUIRED_DATASETS = [
  '/',
  '/index.html',
  '/data/case_a_kepler8b.json',
  '/data/case_b_eclipsing_binary.json',
  '/data/case_c_single_dropout.json',
  '/data/case_d_injection.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(REQUIRED_DATASETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key.startsWith('dimminglab-')) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request, { ignoreVary: true }).then((cached) => {
        if (cached) return cached;

        return cache.match(url.pathname, { ignoreVary: true }).then((pathMatch) => {
          if (pathMatch) return pathMatch;

          return fetch(event.request).then((resp) => {
            if (resp && resp.status === 200) {
              cache.put(event.request, resp.clone());
            }
            return resp;
          }).catch(() => {
            if (event.request.mode === 'navigate') {
              return cache.match('/index.html', { ignoreVary: true }).then((html) => {
                return html || cache.match('/', { ignoreVary: true });
              });
            }
          });
        });
      });
    })
  );
});
