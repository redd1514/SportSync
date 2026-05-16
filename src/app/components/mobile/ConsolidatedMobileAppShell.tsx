import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home, Map, Users, User as UserIcon, Wifi, Battery, Signal,
  CalendarDays, BookMarked, GraduationCap, Pencil,
} from "lucide-react";
import { PremiumMobileHome }       from "./PremiumMobileHome";
import { AccountActivityScreen }    from "./AccountActivityScreen";
import { ConsolidatedAdminDashboard }  from "../admin/ConsolidatedAdminDashboard";
import { ConsolidatedStaffDashboard }  from "../admin/ConsolidatedStaffDashboard";
import { FloatingAIChat }           from "../FloatingAIChat";
import { useUser }                  from "../../contexts/UserContext";
import { FacilityMapViewer }        from "../shared/FacilityMapViewer";
import { UserMyBookings }           from "../UserMyBookings";
import { UserCoachingServices }     from "../user/UserCoachingServices";
import { UserMyCoaching }           from "../user/UserMyCoaching";
import { CoachApplicationForm }     from "../user/CoachApplicationForm";

/* ── Tab types ── */
type MainTab    = "home" | "booking" | "coaching" | "account";
type BookingSub = "map" | "mybookings";
type CoachSub   = "browse" | "mycoaching" | "apply";

interface ConsolidatedMobileAppShellProps { onLogout: () => void; }

/* ── Bottom nav config ── */
const mainTabs = [
  { id: "home"     as MainTab, icon: Home,          label: "Home",     color: "#F97316" },
  { id: "booking"  as MainTab, icon: CalendarDays,  label: "Booking",  color: "#2563EB" },
  { id: "coaching" as MainTab, icon: GraduationCap, label: "Coaching", color: "#a855f7" },
  { id: "account"  as MainTab, icon: UserIcon,      label: "Account",  color: "#22c55e" },
];

/* ── Status bar ── */
function PremiumStatusBar() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const h = time.getHours(), m = time.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM"; const dh = h % 12 || 12;
  return (
    <div className="flex items-center justify-between px-5 h-10 flex-shrink-0"
      style={{ background: "#0D0D0D", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="font-black" style={{ fontSize: 13, color: "#E8E8EA" }}>{dh}:{m} {ampm}</span>
      <div className="flex items-center gap-1.5">
        <Signal  size={12} style={{ color: "#E8E8EA", opacity: 0.7 }} />
        <Wifi    size={12} style={{ color: "#E8E8EA", opacity: 0.7 }} />
        <Battery size={12} style={{ color: "#E8E8EA", opacity: 0.7 }} />
      </div>
    </div>
  );
}

/* ── Bottom nav ── */
function BottomNav({ active, onChange }: { active: MainTab; onChange: (t: MainTab) => void }) {
  return (
    <div className="flex-shrink-0 flex items-stretch"
      style={{ background: "#141414", borderTop: "1px solid rgba(255,255,255,0.07)", paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
      {mainTabs.map(tab => {
        const on = active === tab.id;
        return (
          <motion.button key={tab.id} whileTap={{ scale: 0.88 }} onClick={() => onChange(tab.id)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 relative">
            {on && (
              <motion.div layoutId="navLine" className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full"
                style={{ width: 26, height: 2.5, background: tab.color }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }} />
            )}
            <div className="w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200"
              style={{ background: on ? `${tab.color}20` : "transparent" }}>
              <tab.icon size={18} style={{ color: on ? tab.color : "rgba(255,255,255,0.35)", strokeWidth: on ? 2.5 : 1.8, transition: "color 0.18s" }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: on ? 800 : 600, color: on ? tab.color : "rgba(255,255,255,0.35)", transition: "color 0.18s" }}>
              {tab.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Sub-tab pill bar ── */
function SubTabBar<T extends string>({
  tabs, active, onChange, color,
}: { tabs: { id: T; label: string; icon: any }[]; active: T; onChange: (t: T) => void; color: string }) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-2.5 flex-shrink-0 overflow-x-auto scrollbar-hide"
      style={{ background: "#141414", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      {tabs.map(t => {
        const on = active === t.id;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-black flex-shrink-0 transition-all"
            style={{ fontSize: 12, background: on ? color : "rgba(255,255,255,0.05)", color: on ? "white" : "rgba(255,255,255,0.45)" }}>
            <t.icon size={12} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Main Shell ── */
export function ConsolidatedMobileAppShell({ onLogout }: ConsolidatedMobileAppShellProps) {
  const [mainTab,     setMainTab]     = useState<MainTab>("home");
  const [bookingSub,  setBookingSub]  = useState<BookingSub>("map");
  const [coachSub,    setCoachSub]    = useState<CoachSub>("browse");
  const [aiOpen,      setAiOpen]      = useState(false);
  const [bookingPrefill, setBookingPrefill] = useState<{
    sport: string;
    date: string;
    time: string;
    coachingSessionId?: string;
    coachingStudentName?: string;
    coachingStudentId?: string;
    coachName?: string;
    coachHourlyRate?: number;
    durationHours?: number;
  } | undefined>(undefined);
  const { isAdmin, isStaff, logout }  = useUser();

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  if (isAdmin) return <ConsolidatedAdminDashboard onLogout={handleLogout} />;
  if (isStaff) return <ConsolidatedStaffDashboard onLogout={handleLogout} />;

  /* ── Booking sub-screens ── */
  const bookingSubTabs = [
    { id: "map"        as BookingSub, icon: Map,        label: "Facility Map" },
    { id: "mybookings" as BookingSub, icon: BookMarked, label: "My Bookings"  },
  ];

  /* ── Coaching sub-screens ── */
  const coachSubTabs = [
    { id: "browse"    as CoachSub, icon: Users,          label: "Browse Coaches" },
    { id: "mycoaching"as CoachSub, icon: CalendarDays,   label: "My Coaching"    },
    { id: "apply"     as CoachSub, icon: Pencil,         label: "Apply as Coach" },
  ];

  /* ── External navigate ── */
  const navigate = (dest: string, params?: any) => {
    if (dest === "map" || dest === "booking") { setMainTab("booking"); setBookingSub("map"); }
    else if (dest === "book_court") { 
      setBookingPrefill(params);
      setMainTab("booking"); 
      setBookingSub("map"); 
    }
    else if (dest === "mybookings")           { setMainTab("booking"); setBookingSub("mybookings"); }
    else if (dest === "coaching" || dest === "coaches") { setMainTab("coaching"); setCoachSub("browse"); }
    else if (dest === "mycoaching")           { setMainTab("coaching"); setCoachSub("mycoaching"); }
    else if (dest === "apply")                { setMainTab("coaching"); setCoachSub("apply"); }
    else if (dest === "account" || dest === "profile") { setMainTab("account"); }
  };

  /* ── Screen renderer ── */
  const renderScreen = () => {
    switch (mainTab) {
      case "home":
        return <PremiumMobileHome onNavigate={navigate} onOpenAI={() => setAiOpen(true)} />;

      case "booking":
        return (
          <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0D0D0D" }}>
            <SubTabBar tabs={bookingSubTabs} active={bookingSub} onChange={setBookingSub} color="#2563EB" />
            <div className="flex-1 overflow-hidden min-h-0">
              <AnimatePresence mode="wait">
                <motion.div key={bookingSub} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }} className="h-full">
                  {bookingSub === "map"        ? (
                    <FacilityMapViewer
                      mode="customer"
                      compact
                      prefill={bookingPrefill}
                      onExitCoachingReservation={bookingPrefill?.coachingSessionId ? () => {
                        setBookingPrefill(undefined);
                        setMainTab("coaching");
                        setCoachSub("mycoaching");
                      } : undefined}
                    />
                  ) : <div className="h-full overflow-y-auto"><UserMyBookings onNavigate={navigate} /></div>}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        );

      case "coaching":
        return (
          <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0F1011" }}>
            <SubTabBar tabs={coachSubTabs} active={coachSub} onChange={setCoachSub} color="#a855f7" />
            <div className="flex-1 overflow-hidden min-h-0">
              <AnimatePresence mode="wait">
                <motion.div key={coachSub} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }} className="h-full overflow-y-auto">
                  {coachSub === "browse"      ? <UserCoachingServices onNavigate={navigate} />
                   : coachSub === "mycoaching" ? <UserMyCoaching onNavigate={navigate} />
                   :                             <CoachApplicationForm />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        );

      case "account":
        return <AccountActivityScreen onLogout={handleLogout} />;
    }
  };

  return (
    <div className="w-screen h-screen flex flex-col overflow-hidden" style={{ background: "#0D0D0D" }}>
      <PremiumStatusBar />
      <div className="flex-1 overflow-hidden relative min-h-0">
        <AnimatePresence mode="wait">
          <motion.div key={mainTab}
            initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0">
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </div>
      <BottomNav active={mainTab} onChange={t => setMainTab(t)} />
      <FloatingAIChat
        forceOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        onNavigate={(dest) => navigate(dest)}
      />
    </div>
  );
}
