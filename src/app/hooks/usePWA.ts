/**
 * PWA Service Worker Registration and Update Management
 * Handles service worker lifecycle and automatic updates
 */

export interface PWAConfig {
  enableNotifications?: boolean;
  enableBackgroundSync?: boolean;
  enablePeriodicSync?: boolean;
}

interface UpdateEvent extends Event {
  detail?: {
    type: string;
  };
}

let registration: ServiceWorkerRegistration | null = null;
let updateCheckInterval: ReturnType<typeof setInterval> | null = null;

/** Emitted by vite-plugin-pwa (injectManifest) at build/dev time */
const SERVICE_WORKER_URL = '/sw.js';

/**
 * Register the service worker and set up update detection
 */
export async function registerServiceWorker(config: PWAConfig = {}): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers are not supported in this browser');
    return null;
  }

  try {
    registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL, {
      scope: '/',
    });

    console.log('[PWA] Service Worker registered successfully:', registration);

    // Handle service worker updates
    setupUpdateListener();

    // Request notification permission if enabled
    if (config.enableNotifications) {
      requestNotificationPermission();
    }

    // Request periodic sync permission if enabled
    if (config.enablePeriodicSync) {
      requestPeriodicSyncPermission();
    }

    // Request background sync if enabled
    if (config.enableBackgroundSync) {
      setupBackgroundSync();
    }

    // Check for updates periodically (every 6 hours)
    updateCheckInterval = setInterval(checkForUpdates, 6 * 60 * 60 * 1000);

    return registration;
  } catch (error) {
    console.error('[PWA] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Check for service worker updates
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!registration) {
    console.warn('[PWA] Service Worker not registered');
    return false;
  }

  try {
    const updated = await registration.update();
    if (updated.installing) {
      console.log('[PWA] New Service Worker version available');
      notifyUpdateAvailable(updated);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[PWA] Failed to check for updates:', error);
    return false;
  }
}

/**
 * Listen for controller changes (indicates SW update)
 */
function setupUpdateListener(): void {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] Service Worker has been updated');
    // Optionally reload the app
    // window.location.reload();
  });

  // Listen for messages from the service worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, status } = event.data;

    if (type === 'SYNC_COMPLETE') {
      console.log('[PWA] Background sync completed:', status);
      // Trigger UI update or notification
      window.dispatchEvent(
        new CustomEvent('pwa:sync-complete', {
          detail: { status },
        })
      );
    }
  });
}

/**
 * Notify app of available update
 */
function notifyUpdateAvailable(registration: ServiceWorkerRegistration): void {
  window.dispatchEvent(
    new CustomEvent('pwa:update-available', {
      detail: { registration },
    })
  );

  // Show a native notification
  if (Notification.permission === 'granted') {
    new Notification('SportSync Update Available', {
      body: 'A new version is available. Please refresh the app.',
      badge: '/pwa-icons/badge-72x72.png',
      icon: '/pwa-icons/icon-192x192.png',
      tag: 'update-notification',
    });
  }
}

/**
 * Skip waiting and activate new service worker immediately
 */
export async function skipWaiting(): Promise<void> {
  if (!registration?.waiting) {
    console.warn('[PWA] No waiting Service Worker to skip');
    return;
  }

  registration.waiting.postMessage({ type: 'SKIP_WAITING' });

  // Listen for the controller change and reload
  const onControllerChange = () => {
    navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    window.location.reload();
  };

  navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[PWA] Notifications are not supported');
    return 'denied';
  }

  if (Notification.permission !== 'granted') {
    return Notification.requestPermission();
  }

  return 'granted';
}

/**
 * Send a notification
 */
export function sendNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> | null {
  if (!registration) {
    console.warn('[PWA] Service Worker not registered');
    return null;
  }

  return registration.showNotification(title, {
    badge: '/pwa-icons/badge-72x72.png',
    icon: '/pwa-icons/icon-192x192.png',
    ...options,
  });
}

/**
 * Request periodic background sync permission (for Android)
 */
async function requestPeriodicSyncPermission(): Promise<boolean> {
  if (!registration || !('periodicSync' in registration)) {
    console.warn('[PWA] Periodic sync not supported');
    return false;
  }

  try {
    const permission = await navigator.permissions.query({
      name: 'periodic-background-sync',
    } as any);

    if (permission.state === 'granted') {
      // Register periodic sync for syncing pending bookings every hour
      await (registration as any).periodicSync.register('sync-pending-bookings', {
        minInterval: 60 * 60 * 1000, // 1 hour
      });

      console.log('[PWA] Periodic sync registered');
      return true;
    }
  } catch (error) {
    console.error('[PWA] Periodic sync setup failed:', error);
  }

  return false;
}

/**
 * Setup background sync for offline bookings
 */
async function setupBackgroundSync(): Promise<boolean> {
  if (!registration) {
    console.warn('[PWA] Service Worker not registered');
    return false;
  }

  try {
    if ('sync' in registration) {
      await (registration.sync as any).register('sync-bookings');
      console.log('[PWA] Background sync registered');
      return true;
    }
  } catch (error) {
    console.error('[PWA] Background sync setup failed:', error);
  }

  return false;
}

/**
 * Retry background sync manually
 */
export async function retryBackgroundSync(): Promise<boolean> {
  if (!registration) {
    console.warn('[PWA] Service Worker not registered');
    return false;
  }

  try {
    if ('sync' in registration) {
      await (registration.sync as any).register('sync-bookings');
      console.log('[PWA] Background sync retry initiated');
      return true;
    }
  } catch (error) {
    console.error('[PWA] Background sync retry failed:', error);
  }

  return false;
}

/**
 * Check if the app is running in standalone mode
 */
export function isStandaloneMode(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');
}

/**
 * Get the current installation state
 */
export function getInstallationState(): {
  isInstalled: boolean;
  isStandalone: boolean;
  supportsInstall: boolean;
} {
  return {
    isInstalled: isStandaloneMode(),
    isStandalone: isStandaloneMode(),
    supportsInstall: 'serviceWorker' in navigator && 'PushManager' in window,
  };
}

/**
 * Clear all caches
 */
export async function clearAllCaches(): Promise<void> {
  if (!registration) {
    console.warn('[PWA] Service Worker not registered');
    return;
  }

  registration.active?.postMessage({ type: 'CLEAR_CACHE' });

  // Also clear all cache storage
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));

  console.log('[PWA] All caches cleared');
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }

  if (!registration) {
    console.warn('[PWA] Service Worker not registered');
    return;
  }

  const success = await registration.unregister();
  if (success) {
    console.log('[PWA] Service Worker unregistered');
    await clearAllCaches();
  }
}

export default {
  registerServiceWorker,
  checkForUpdates,
  skipWaiting,
  requestNotificationPermission,
  sendNotification,
  retryBackgroundSync,
  isStandaloneMode,
  getInstallationState,
  clearAllCaches,
  unregisterServiceWorker,
};
