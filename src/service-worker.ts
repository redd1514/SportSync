/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />

declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheFirst, NetworkFirst, NetworkOnly, StaleWhileRevalidate } from 'workbox-strategies';

// Cleanup old caches
cleanupOutdatedCaches();

// Precache static assets built by Vite
precacheAndRoute(self.__WB_MANIFEST);

// Navigation route for SPA - serve index.html for all navigation requests
const navigationRoute = new NavigationRoute(
  new NetworkFirst({
    cacheName: 'navigations',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
      }),
    ],
  }),
  {
    denylist: [/^\/api\//],
  }
);

registerRoute(navigationRoute);

// Cache strategies for different resource types

// API endpoints - Network First (fresh data priority)
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      }),
    ],
  })
);

// Images - Cache First
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
);

// Fonts - Cache First
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// CSS and JS - Stale While Revalidate
registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  })
);

// Handle offline mode
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Skip cross-origin requests
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API calls in offline mode - return cached or network error
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return a custom offline response for API calls
        return new Response(
          JSON.stringify({
            error: 'Offline - Please check your internet connection',
            status: 'offline',
          }),
          {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'application/json',
            }),
          }
        );
      })
    );
  }
});

// Background sync for booking retries (when connection is restored)
self.addEventListener('sync', (event: any) => {
  if (event.tag === 'sync-bookings') {
    event.waitUntil(
      (async () => {
        try {
          // Sync pending bookings when connection is restored
          const response = await fetch('/api/bookings/sync', {
            method: 'POST',
          });

          if (!response.ok) {
            throw new Error('Sync failed');
          }

          // Notify the app that sync was successful
          self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'SYNC_COMPLETE',
                status: 'success',
              });
            });
          });
        } catch (error) {
          // Retry sync on next opportunity
          throw error;
        }
      })()
    );
  }
});

// Push notifications for booking reminders
self.addEventListener('push', (event: PushEvent) => {
  const options: NotificationOptions = {
    badge: '/pwa-icons/badge-72x72.png',
    icon: '/pwa-icons/icon-192x192.png',
    tag: 'sportsync-notification',
    requireInteraction: false,
  };

  let title = 'JRC SportSync';

  if (event.data) {
    try {
      const payload = event.data.json();
      options.body = payload.body;
      title = payload.title || title;
      options.data = payload.data;
    } catch {
      options.body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification clicks
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return (client as WindowClient).focus();
        }
      }
      // If not, open a new window/tab with the target URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

// Message handler for app -> service worker communication
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        caches.delete(cacheName);
      });
    });
  }
});

// Periodic background sync (requires user permission on some browsers)
// This would be used to sync pending bookings periodically
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event: any) => {
    if (event.tag === 'sync-pending-bookings') {
      event.waitUntil(
        fetch('/api/bookings/sync', { method: 'POST' }).catch(() => {
          console.log('Periodic sync failed - will retry later');
        })
      );
    }
  });
}

console.log('[Service Worker] ServiceWorker installed and ready');
