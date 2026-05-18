/**
 * React Hook for handling PWA update notifications
 * Provides UI feedback when a new version is available
 */

import { useEffect, useRef, useState } from 'react';

export interface UpdateNotification {
  isAvailable: boolean;
  registration: ServiceWorkerRegistration | null;
}

/**
 * Hook to manage PWA update notifications
 * Usage:
 * const { isUpdateAvailable, registration, skipWaiting } = usePWAUpdate();
 */
export function usePWAUpdate() {
  const [updateNotification, setUpdateNotification] = useState<UpdateNotification>({
    isAvailable: false,
    registration: null,
  });

  const listenerRef = useRef<((this: Window, ev: Event) => void) | null>(null);

  useEffect(() => {
    // Listen for update available event from service worker
    const handleUpdateAvailable = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { registration } = customEvent.detail;

      setUpdateNotification({
        isAvailable: true,
        registration,
      });

      console.log('[PWA Update] New version available');
    };

    listenerRef.current = handleUpdateAvailable as any;
    window.addEventListener('pwa:update-available', handleUpdateAvailable);

    return () => {
      if (listenerRef.current) {
        window.removeEventListener('pwa:update-available', listenerRef.current);
      }
    };
  }, []);

  const skipWaiting = async () => {
    if (updateNotification.registration?.waiting) {
      updateNotification.registration.waiting.postMessage({
        type: 'SKIP_WAITING',
      });

      // Reload the app after the new service worker takes control
      let reloaded = false;
      const handleControllerChange = () => {
        if (!reloaded) {
          reloaded = true;
          navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
          window.location.reload();
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    }
  };

  const dismissUpdate = () => {
    setUpdateNotification({
      isAvailable: false,
      registration: null,
    });
  };

  return {
    isUpdateAvailable: updateNotification.isAvailable,
    registration: updateNotification.registration,
    skipWaiting,
    dismissUpdate,
  };
}

/**
 * Hook to check if app is running in standalone mode (installed).
 * For install UI, prefer `usePWAInstall` (captures deferred prompt safely).
 */
export function usePWAInstallation() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const read = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');

    const sync = () => {
      const standalone = read();
      setIsStandalone(standalone);
      setIsInstalled(standalone);
    };

    sync();

    const onInstalled = () => {
      sync();
      console.log('[PWA] App installed successfully');
    };

    window.addEventListener('appinstalled', onInstalled);
    window.matchMedia('(display-mode: standalone)').addEventListener('change', sync);

    return () => {
      window.removeEventListener('appinstalled', onInstalled);
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', sync);
    };
  }, []);

  return { isInstalled, isStandalone };
}

/**
 * Hook to detect online/offline status
 */
export function usePWAOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[PWA] Back online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[PWA] Gone offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline };
}

/**
 * Hook to sync pending actions when connection is restored
 */
export function usePWASync() {
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  useEffect(() => {
    const handleSyncComplete = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { status } = customEvent.detail;

      if (status === 'success') {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    };

    window.addEventListener('pwa:sync-complete', handleSyncComplete);

    return () => {
      window.removeEventListener('pwa:sync-complete', handleSyncComplete);
    };
  }, []);

  return { syncStatus };
}
