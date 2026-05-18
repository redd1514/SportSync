/**
 * PWA Update Notification Component
 * Displays a toast/banner when a new version is available
 * Can be placed at the root level of the app
 */

import React, { useState, useEffect } from 'react';
import { usePWAUpdate, usePWAOnlineStatus } from '../hooks/usePWAUpdate';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Wifi, WifiOff, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';

const pwaAlertShell =
  'fixed left-3 right-3 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-4 md:left-auto md:right-4 md:max-w-md max-w-[calc(100vw-1.5rem)] shadow-lg z-50';
const pwaAlertContent = 'flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4';
const pwaAlertActions = 'grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-shrink-0';
const pwaAlertButton = 'min-h-10 rounded-lg px-3 py-2 text-sm font-bold transition-colors';

/**
 * Main PWA Notification Manager Component
 * Shows update notifications, offline status, and install prompts
 */
export function PWANotificationManager() {
  const { isUpdateAvailable, skipWaiting } = usePWAUpdate();
  const { isOnline } = usePWAOnlineStatus();
  const { isInstalled, isStandalone, isInstallable, handleInstallClick, dismissInstallPrompt } =
    usePWAInstall();

  return (
    <>
      {isUpdateAvailable && <UpdateNotification onSkipWaiting={skipWaiting} />}

      {!isOnline && <OfflineNotification />}

      {isOnline && !isStandalone && <OnlineNotification />}

      {isInstallable && !isInstalled && (
        <InstallPromptBanner
          onInstall={handleInstallClick}
          onDismiss={dismissInstallPrompt}
        />
      )}
    </>
  );
}

function UpdateNotification({ onSkipWaiting }: { onSkipWaiting: () => void }) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Alert className={`${pwaAlertShell} bg-blue-50 border-blue-200`}>
      <Download className="h-4 w-4 text-blue-600" />
      <AlertDescription className="min-w-0">
        <div className={pwaAlertContent}>
          <div className="min-w-0">
            <p className="font-semibold text-blue-900">Update Available</p>
            <p className="text-sm text-blue-800 break-words">A new version of SportSync is available.</p>
          </div>
          <div className={pwaAlertActions}>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className={`${pwaAlertButton} text-blue-600 hover:bg-blue-100`}
            >
              Later
            </button>
            <button
              type="button"
              onClick={onSkipWaiting}
              className={`${pwaAlertButton} bg-blue-600 text-white hover:bg-blue-700`}
            >
              Update Now
            </button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function OfflineNotification() {
  return (
    <Alert className={`${pwaAlertShell} bg-orange-50 border-orange-200`}>
      <WifiOff className="h-4 w-4 text-orange-600" />
      <AlertDescription className="min-w-0">
        <p className="font-semibold text-orange-900">You're Offline</p>
        <p className="text-sm text-orange-800 break-words">Some features may be limited. Your bookings will sync when online.</p>
      </AlertDescription>
    </Alert>
  );
}

function OnlineNotification() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timer = setTimeout(() => setShow(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <Alert className={`${pwaAlertShell} bg-green-50 border-green-200 animate-in fade-in slide-in-from-bottom-4`}>
      <Wifi className="h-4 w-4 text-green-600" />
      <AlertDescription className="min-w-0">
        <p className="font-semibold text-green-900">Back Online</p>
        <p className="text-sm text-green-800 break-words">Syncing your pending bookings...</p>
      </AlertDescription>
    </Alert>
  );
}

function InstallPromptBanner({
  onInstall,
  onDismiss,
}: {
  onInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const onInstallClick = async () => {
    setBusy(true);
    try {
      await onInstall();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Alert className={`${pwaAlertShell} bg-indigo-50 border-indigo-200`}>
      <CheckCircle2 className="h-4 w-4 text-indigo-600" />
      <AlertDescription className="min-w-0">
        <div className={pwaAlertContent}>
          <div className="min-w-0">
            <p className="font-semibold text-indigo-900">Install SportSync</p>
            <p className="text-sm text-indigo-800 break-words">Get quick access and work offline</p>
          </div>
          <div className={pwaAlertActions}>
            <button
              type="button"
              onClick={onDismiss}
              disabled={busy}
              className={`${pwaAlertButton} text-indigo-600 hover:bg-indigo-100 disabled:opacity-50`}
            >
              No Thanks
            </button>
            <button
              type="button"
              onClick={onInstallClick}
              disabled={busy}
              className={`${pwaAlertButton} bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50`}
            >
              {busy ? 'Installing…' : 'Install'}
            </button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default PWANotificationManager;
