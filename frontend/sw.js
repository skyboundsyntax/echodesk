/**
 * ECHODESK — Offline-First Progressive Web App Service Worker
 * Guarantees 100% offline operation on mobile phones (Android / iOS) and desktops.
 * Caches core shell assets and executes fallback gracefully without remote surveillance.
 */

const CACHE_NAME = 'echodesk-v1.1.0';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/design-tokens.css',
  './css/app.css',
  './css/zen.css',
  './css/privacy.css',
  './css/bridge.css',
  './css/demo.css',
  './css/mobile.css',
  './js/core/events.js',
  './js/core/storage.js',
  './js/core/session-state.js',
  './js/ai/ai-provider.js',
  './js/engines/privacy-gate.js',
  './js/engines/intent-engine.js',
  './js/engines/memory-engine.js',
  './js/engines/flow-engine.js',
  './js/engines/bridge-engine.js',
  './js/sensors/voice-input.js',
  './js/sensors/camera-presence.js',
  './js/ui/jot-controller.js',
  './js/ui/zen-controller.js',
  './js/ui/memory-controller.js',
  './js/ui/privacy-controller.js',
  './js/ui/bridge-controller.js',
  './js/ui/demo-controller.js',
  './js/app.js',
];

// Install Event: Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clear older caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Cache First for assets, Network with Cache Fallback for dynamic requests
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests and external API telemetry
  if (req.method !== 'GET') {
    return;
  }

  // Network-first for backend API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => {
        return new Response(
          JSON.stringify({
            offline: true,
            message: 'Device is offline. ECHODESK Deterministic Local Provider active.',
          }),
          {
            headers: { 'Content-Type': 'application/json' },
            status: 503,
          }
        );
      })
    );
    return;
  }

  // Cache-first with network fallback for local static assets
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate)
        fetch(req).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, networkResponse);
            });
          }
        }).catch(() => {
          // Ignore network errors when offline
        });
        return cachedResponse;
      }

      return fetch(req).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(req, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Offline fallback for HTML navigation
        if (req.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
