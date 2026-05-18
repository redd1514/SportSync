/**
 * PWA install prompt — captures `beforeinstallprompt` once at module load so a
 * later React error (e.g. API 404) does not drop the deferred event.
 * Works alongside vite-plugin-pwa (`/sw.js` registered in main.tsx).
 */

import { useCallback, useEffect, useState } from 'react';

/** Chromium BeforeInstallPromptEvent (not in all TS libs). */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

type InstallListener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
const listeners = new Set<InstallListener>();

function notifyInstallListeners() {
  listeners.forEach((fn) => fn());
}

function readStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

if (typeof window !== 'undefined') {
  appInstalled = readStandalone();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notifyInstallListeners();
  });

  window.addEventListener('appinstalled', () => {
    appInstalled = true;
    deferredPrompt = null;
    notifyInstallListeners();
  });

  window.matchMedia('(display-mode: standalone)').addEventListener('change', () => {
    appInstalled = readStandalone();
    notifyInstallListeners();
  });
}

export interface UsePWAInstallResult {
  /** Browser offered install (deferred prompt is available). */
  isInstallable: boolean;
  /** Running as installed PWA or install just finished. */
  isInstalled: boolean;
  /** Same as `isInstalled` — display-mode standalone. */
  isStandalone: boolean;
  /** User dismissed the custom install UI (session only). */
  isDismissed: boolean;
  /** Service worker API available (install usually needs SW + manifest). */
  canUsePwa: boolean;
  handleInstallClick: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  dismissInstallPrompt: () => void;
}

export function usePWAInstall(): UsePWAInstallResult {
  const [isInstallable, setIsInstallable] = useState(() => deferredPrompt != null);
  const [isInstalled, setIsInstalled] = useState(() => appInstalled || readStandalone());
  const [isDismissed, setIsDismissed] = useState(false);

  const canUsePwa =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window.matchMedia === 'function';

  useEffect(() => {
    const sync = () => {
      setIsInstallable(deferredPrompt != null);
      setIsInstalled(appInstalled || readStandalone());
    };
    sync();
    listeners.add(sync);
    return () => {
      listeners.delete(sync);
    };
  }, []);

  const handleInstallClick = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const prompt = deferredPrompt;
    if (!prompt) return 'unavailable';

    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      deferredPrompt = null;
      setIsInstallable(false);
      if (outcome === 'accepted') {
        appInstalled = true;
        setIsInstalled(true);
      }
      return outcome;
    } catch (err) {
      console.warn('[PWA] Install prompt failed:', err);
      return 'unavailable';
    }
  }, []);

  const dismissInstallPrompt = useCallback(() => {
    setIsDismissed(true);
  }, []);

  return {
    isInstallable: isInstallable && !isInstalled && !isDismissed,
    isInstalled,
    isStandalone: isInstalled,
    isDismissed,
    canUsePwa,
    handleInstallClick,
    dismissInstallPrompt,
  };
}
