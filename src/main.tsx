
  import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
/** Register `beforeinstallprompt` listener before React mounts (see usePWAInstall.ts). */
import "./app/hooks/usePWAInstall";
import { registerServiceWorker } from "./app/hooks/usePWA.ts";

const STALE_CHUNK_RELOAD_KEY = "sportsync_stale_chunk_reload";

function isStaleChunkError(value: unknown) {
  const message = value instanceof Error ? value.message : String(value ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk \d+ failed|ChunkLoadError/i.test(message);
}

async function recoverFromStaleChunk() {
  const lastReload = Number(sessionStorage.getItem(STALE_CHUNK_RELOAD_KEY) || 0);
  if (Date.now() - lastReload < 30_000) return;
  sessionStorage.setItem(STALE_CHUNK_RELOAD_KEY, String(Date.now()));
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } finally {
    window.location.reload();
  }
}

window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  void recoverFromStaleChunk();
});

window.addEventListener("unhandledrejection", (event) => {
  if (!isStaleChunkError(event.reason)) return;
  event.preventDefault();
  void recoverFromStaleChunk();
});

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  registerServiceWorker({
    enableNotifications: true,
    enableBackgroundSync: true,
    enablePeriodicSync: true,
  }).catch(err => console.error('Failed to register PWA:', err));
}

createRoot(document.getElementById("root")!).render(<App />);
  
