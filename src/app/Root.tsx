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
import { FloatingAIChat } from "./components/FloatingAIChat";
import { useUser } from "./contexts/UserContext";

type AppState = "splash" | "auth" | "app";

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
  const { isAdmin, isStaff } = useUser();
  const showAI = appState === "app" && !isAdmin && !isStaff;
  return (
    <>
      {appState === "app" && (
        isMobile ? (
          <ConsolidatedMobileAppShell onLogout={onLogout} />
        ) : (
          <DesktopAppShell onLogout={onLogout} />
        )
      )}
      {showAI && <FloatingAIChat />}
    </>
  );
}

export default function Root() {
  const [appState, setAppState] = useState<AppState>("splash");
  const isMobile = useIsMobile();

  return (
    <ThemeProvider>
      <UserProvider key="force-hmr-remount-v2">
        <CoachingProvider>
          <AddonsProvider>
            <FacilityMapProvider>
              <AnnouncementsProvider>
                {/* Splash Screen — always shown first */}
                {appState === "splash" && (
                  <div className="fixed inset-0 z-50 bg-[#0D0D0D]">
                    <SplashScreen onComplete={() => setAppState("auth")} />
                  </div>
                )}

                {/* Auth Screen — Login / Sign Up */}
                {appState === "auth" && (
                  <MobileAuth onLoginSuccess={() => setAppState("app")} />
                )}

                {/* Authenticated App — Mobile or Desktop shell based on screen size */}
                <AppWithAI appState={appState} isMobile={isMobile} onLogout={() => setAppState("auth")} />
              </AnnouncementsProvider>
            </FacilityMapProvider>
          </AddonsProvider>
        </CoachingProvider>
      </UserProvider>
    </ThemeProvider>
  );
}
