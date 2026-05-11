/**
 * PWA Update Notification Component
 * Displays a toast/banner when a new version is available
 * Can be placed at the root level of the app
 */

import React, { useState, useEffect } from 'react';
import { usePWAUpdate, usePWAOnlineStatus, usePWAInstallation } from '../hooks/usePWAUpdate';
import { AlertCircle, Download, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';

/**
 * Main PWA Notification Manager Component
 * Shows update notifications, offline status, and install prompts
 */
export function PWANotificationManager() {
  const { isUpdateAvailable, skipWaiting } = usePWAUpdate();
  const { isOnline } = usePWAOnlineStatus();
  const { isInstalled, isStandalone } = usePWAInstallation();

  return (
    <>
      {/* Update Available Notification */}
      {isUpdateAvailable && <UpdateNotification onSkipWaiting={skipWaiting} />}

      {/* Offline Status Notification */}
      {!isOnline && <OfflineNotification />}

      {/* Online Status Notification */}
      {isOnline && !isStandalone && <OnlineNotification />}

      {/* Install Prompt (only for new users) */}
      {!isInstalled && <InstallPrompt />}
    </>
  );
}

/**
 * Update Notification Component
 */
function UpdateNotification({ onSkipWaiting }: { onSkipWaiting: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Alert className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-blue-50 border-blue-200 shadow-lg z-50">
      <Download className="h-4 w-4 text-blue-600" />
      <AlertDescription className="ml-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-blue-900">Update Available</p>
            <p className="text-sm text-blue-800">A new version of SportSync is available.</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded transition-colors"
            >
              Later
            </button>
            <button
              onClick={onSkipWaiting}
              className="px-3 py-1 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
            >
              Update Now
            </button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Offline Status Notification
 */
function OfflineNotification() {
  return (
    <Alert className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-orange-50 border-orange-200 shadow-lg z-50">
      <WifiOff className="h-4 w-4 text-orange-600" />
      <AlertDescription className="ml-2">
        <p className="font-semibold text-orange-900">You're Offline</p>
        <p className="text-sm text-orange-800">Some features may be limited. Your bookings will sync when online.</p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Online Status Notification (only when returning online)
 */
function OnlineNotification() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <Alert className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-green-50 border-green-200 shadow-lg z-50 animate-in fade-in slide-in-from-bottom-4">
      <Wifi className="h-4 w-4 text-green-600" />
      <AlertDescription className="ml-2">
        <p className="font-semibold text-green-900">Back Online</p>
        <p className="text-sm text-green-800">Syncing your pending bookings...</p>
      </AlertDescription>
    </Alert>
  );
}

/**
 * Install Prompt Component
 * Shows a custom install prompt for first-time users
 */
function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowPrompt(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    (deferredPrompt as any).prompt();
    const { outcome } = await (deferredPrompt as any).userChoice;

    if (outcome === 'accepted') {
      setInstalled(true);
    }

    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt || installed) return null;

  return (
    <Alert className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-indigo-50 border-indigo-200 shadow-lg z-50">
      <CheckCircle2 className="h-4 w-4 text-indigo-600" />
      <AlertDescription className="ml-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-indigo-900">Install SportSync</p>
            <p className="text-sm text-indigo-800">Get quick access and work offline</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setShowPrompt(false)}
              className="px-3 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-100 rounded transition-colors"
            >
              No Thanks
            </button>
            <button
              onClick={handleInstall}
              className="px-3 py-1 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded transition-colors"
            >
              Install
            </button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default PWANotificationManager;
