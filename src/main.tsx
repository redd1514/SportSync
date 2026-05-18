
  import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";
/** Register `beforeinstallprompt` listener before React mounts (see usePWAInstall.ts). */
import "./app/hooks/usePWAInstall";
import { registerServiceWorker } from "./app/hooks/usePWA.ts";

// Register PWA Service Worker
if ('serviceWorker' in navigator) {
  registerServiceWorker({
    enableNotifications: true,
    enableBackgroundSync: true,
    enablePeriodicSync: true,
  }).catch(err => console.error('Failed to register PWA:', err));
}

createRoot(document.getElementById("root")!).render(<App />);
  