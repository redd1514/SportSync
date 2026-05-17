import { useState, useEffect } from "react";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UserProvider } from "./contexts/UserContext";
import { CoachingProvider } from "./contexts/CoachingContext";
import { AddonsProvider } from "./contexts/AddonsContext";
import { FacilityMapProvider } from "./contexts/FacilityMapContext";
import { AnnouncementsProvider } from "./contexts/AnnouncementsContext";
import { SplashScreen } from "./components/mobile/SplashScreen";
import { MobileAuth } from "./components/MobileAuth";
import { ConsolidatedMobileAppShell } from "./components/mobile/ConsolidatedMobileAppShell";
import { DesktopAppShell } from "./components/desktop/DesktopAppShell";
import { useUser } from "./contexts/UserContext";
import { PaymentReturnReceiptModal } from "./components/shared/PaymentReturnReceiptModal";

type AppState = "splash" | "auth" | "app";
const RECOVERY_PENDING_KEY = "auth_recovery_pending";

function isRecoveryFlowInUrl() {
  if (typeof window === "undefined") return false;
  const searchParams = new URLSearchParams(window.location.search);
  if (searchParams.get("type") === "recovery") return true;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  return params.get("type") === "recovery";
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return isMobile;
}

function AppWithAI({ appState, isMobile, onLogout }: { appState: string; isMobile: boolean; onLogout: () => void }) {
  return (
    <>
      {appState === "app" &&
        (isMobile ? (
          <ConsolidatedMobileAppShell onLogout={onLogout} />
        ) : (
          <DesktopAppShell onLogout={onLogout} />
        ))}
    </>
  );
}

function isPaymentReturnUrl() {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search).get("payment");
  return p === "success" || p === "cancelled";
}

function RootContent() {
  const [appState, setAppState] = useState<AppState>(() =>
    isPaymentReturnUrl() ? "app" : "splash",
  );
  const isMobile = useIsMobile();
  const { isLoggedIn, authFlow, isLoading } = useUser();
  const [isRecoveryPending, setIsRecoveryPending] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const fromStorage = window.sessionStorage.getItem(RECOVERY_PENDING_KEY) === "1";
    const fromUrl = isRecoveryFlowInUrl();
    if (fromUrl) window.sessionStorage.setItem(RECOVERY_PENDING_KEY, "1");
    return fromStorage || fromUrl;
  });

  useEffect(() => {
    if (appState === "splash") return;
    if (isLoading) return;
    if (isRecoveryPending || authFlow === "password_recovery") {
      setAppState("auth");
      return;
    }
    setAppState(isLoggedIn ? "app" : "auth");
  }, [isLoggedIn, appState, isRecoveryPending, authFlow, isLoading]);

  const handleSplashComplete = () => {
    if (isRecoveryFlowInUrl()) {
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(RECOVERY_PENDING_KEY, "1");
      }
      setIsRecoveryPending(true);
      setAppState("auth");
      return;
    }
    if (isLoading) return;
    setAppState(isLoggedIn && !isRecoveryPending && authFlow !== "password_recovery" ? "app" : "auth");
  };

  return (
    <>
      {/* Splash Screen — always shown first */}
      {appState === "splash" && (
        <div className="fixed inset-0 z-50 bg-[#0D0D0D]">
          <SplashScreen onComplete={handleSplashComplete} />
        </div>
      )}

      {/* Auth Screen — Login / Sign Up */}
      {appState === "auth" && (
        <MobileAuth
          onLoginSuccess={() => {
            if (typeof window !== "undefined") {
              window.sessionStorage.removeItem(RECOVERY_PENDING_KEY);
            }
            setIsRecoveryPending(false);
            setAppState("app");
          }}
        />
      )}

      {/* Authenticated App — Mobile or Desktop shell based on screen size */}
      <AppWithAI appState={appState} isMobile={isMobile} onLogout={() => setAppState("auth")} />
      {appState === "app" && <PaymentReturnReceiptModal />}
    </>
  );
}

export default function Root() {
  return (
    <ThemeProvider>
      <UserProvider key="force-hmr-remount-v2">
        <CoachingProvider>
          <AddonsProvider>
            <FacilityMapProvider>
              <AnnouncementsProvider>
                <RootContent />
              </AnnouncementsProvider>
            </FacilityMapProvider>
          </AddonsProvider>
        </CoachingProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
