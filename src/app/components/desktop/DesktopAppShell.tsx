import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home, CalendarDays, Users, User, Bell, LogOut, Trophy, Clock, MapPin, Star, Zap,
  ChevronRight, ArrowRight, X, Megaphone,
  BookOpen, Activity, Plus, ChevronLeft, ChevronDown, Settings,
  LayoutDashboard, CalendarCheck, Map, BookMarked, GraduationCap, Award,
  Pencil,
} from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { useAnnouncements, ANNOUNCEMENT_COLORS } from "../../contexts/AnnouncementsContext";
import { MobileProfileScreen } from "../mobile/MobileProfileScreen";
import { SportIcon, getSportColor, getSportBg } from "../SportIcons";
import { SportDetailModal } from "../SportDetailModal";
import { SPORTS_INFO, ALL_COURTS } from "../sportsData";
import { ConsolidatedAdminDashboard } from "../admin/ConsolidatedAdminDashboard";
import { ConsolidatedStaffDashboard } from "../admin/ConsolidatedStaffDashboard";
import { UserMyBookings } from "../UserMyBookings";
import { UserCoachingServices } from "../user/UserCoachingServices";
import { UserMyCoaching } from "../user/UserMyCoaching";
import { FacilityMapViewer } from "../shared/FacilityMapViewer";
import { FloatingAIChat } from "../FloatingAIChat";
import { UserHomePage } from "../user/UserHomePage";
import { CoachApplicationForm } from "../user/CoachApplicationForm";
import { useCoaching } from "../../contexts/CoachingContext";
import { PhotoAvatar, loadProfilePhoto, onProfilePhotoUpdated } from "../shared/ProfilePhotoPicker";
import { useUserAPI } from "../../hooks/useUserAPI";
import { LoyaltyProgressBar } from "../shared/loyalty/LoyaltyProgressBar";
import { LOYALTY_DISCOUNT_PERCENT, loyaltyRewardsAvailable } from "../../constants/loyalty";

type Tab = "home" | "booking" | "coaching" | "account";
type BookingSub = "mybookings" | "map";
type CoachingSub = "services" | "mycoaching" | "apply";

interface NavItem {
  id: Tab;
  icon: any;
  label: string;
  color: string;
  gradient: string;
  children?: { id: string; label: string; icon: any }[];
}

const NAV: NavItem[] = [
  {
    id: "home", icon: LayoutDashboard, label: "Dashboard",
    color: "#FF8C00", gradient: "from-orange-500 to-amber-500",
  },
  {
    id: "booking", icon: CalendarDays, label: "Facility Map Booking",
    color: "#0047AB", gradient: "from-blue-600 to-cyan-500",
    children: [
      { id: "map",        label: "Facility Map",    icon: Map },
      { id: "mybookings", label: "My Bookings",     icon: BookMarked },
    ],
  },
  {
    id: "coaching", icon: GraduationCap, label: "Coaching Hub",
    color: "#a855f7", gradient: "from-purple-600 to-pink-500",
    children: [
      { id: "services",   label: "Coaching Services", icon: Award },
      { id: "mycoaching", label: "My Coaching",        icon: Users },
      { id: "apply",      label: "Apply as Coach",     icon: Pencil },
    ],
  },
  {
    id: "account", icon: User, label: "Account & Activity",
    color: "#22c55e", gradient: "from-green-500 to-emerald-500",
  },
];

const QUICK_STATS = [
  { icon: Clock,  label: "Hours",     value: "7AM–12MN",         color: "#FF8C00" },
  { icon: MapPin, label: "Location",  value: "Valenzuela City",  color: "#0047AB" },
  { icon: Star,   label: "Rating",    value: "4.9 / 5.0",        color: "#FFD700" },
  { icon: Zap,    label: "Available", value: "9 / 12 courts",    color: "#22c55e" },
];

function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return "Just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/* ─── Tooltip wrapper (for collapsed sidebar) ─── */
function SidebarTooltip({ label, children, danger }: { label: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className="relative group">
      {children}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-[9999] pointer-events-none opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
        <div
          className="whitespace-nowrap rounded-xl px-3 py-2 font-black shadow-xl"
          style={{
            fontSize: 12,
            background: "rgba(20,20,20,0.97)",
            border: `1px solid ${danger ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.1)"}`,
            color: danger ? "#f87171" : "#F8FAFC",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/* ─── Home view ─── */
function DesktopHome({ onNavigate }: { onNavigate: (tab: Tab, sub?: string) => void }) {
  const { user, bookings } = useUser();
  const [selectedSport, setSelectedSport] = useState<string | null>(null);

  const localPendingRequests = (() => {
    try {
      return JSON.parse(localStorage.getItem('jrc_localPendingRequests') || '[]');
    } catch {
      return [];
    }
  })();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseBookingDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const upcomingBookings = bookings.filter(b => {
    const isPastDate = parseBookingDate(b.date) < today;
    const isPendingReq = b.cancellationRequested || localPendingRequests.includes(b.id);
    if (isPastDate || b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected') return false;
    if (isPendingReq) return false;
    return true;
  });

  const recentBookings = bookings.slice(0, 4);

  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-6">
      {/* Hero banner */}
      <div className="relative rounded-3xl overflow-hidden" style={{ height: 200 }}>
        <img src="https://images.unsplash.com/photo-1741940513798-4ce04b95ffda?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRvb3IlMjBzcG9ydHMlMjBjb3VydCUyMGFjdGlvbiUyMGRyYW1hdGljJTIwbGlnaHRpbmd8ZW58MXx8fHwxNzcyMzQxNTAxfDA&ixlib=rb-4.1.0&q=80&w=1200" alt="Facility" className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(120deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)" }} />
        <div className="absolute inset-0 flex flex-col justify-center p-8">
          <span className="text-gray-400 mb-1" style={{ fontSize: 13 }}>{greeting()},</span>
          <h1 className="text-white mb-4" style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.15 }}>
            Welcome back, <span style={{ color: "#FF8C00" }}>{user?.name?.split(" ")[0] || "Athlete"}</span>
          </h1>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate("booking", "map")}
            className="flex items-center gap-2 text-white px-5 py-2.5 rounded-full w-fit shadow-2xl"
            style={{ background: "linear-gradient(135deg,#FF8C00,#e67e00)", fontSize: 13, fontWeight: 900, boxShadow: "0 8px 24px rgba(255,140,0,0.4)" }}
          >
            Book a Court <ArrowRight size={15} />
          </motion.button>
        </div>
        {user && (
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2">
            <Trophy size={13} className="text-[#FFD700]" />
            <span className="text-white font-black" style={{ fontSize: 12 }}>{user.loyaltyPoints} pts</span>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {QUICK_STATS.map(s => (
          <motion.div
            key={s.label}
            whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
            className="rounded-2xl p-4 border border-white/5 transition-all"
            style={{ background: "linear-gradient(135deg,#141414,#111)" }}
          >
            <s.icon size={18} style={{ color: s.color }} className="mb-2.5" />
            <p className="text-white font-black" style={{ fontSize: 14 }}>{s.value}</p>
            <p className="text-gray-600" style={{ fontSize: 11 }}>{s.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Sports grid */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-black" style={{ fontSize: 17 }}>Our Sports</h3>
            <button onClick={() => onNavigate("booking", "map")} className="flex items-center gap-1 text-[#FF8C00] font-black" style={{ fontSize: 12 }}>
              Book Now <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {SPORTS_INFO.map(sport => {
              const color = getSportColor(sport.name);
              return (
                <motion.div key={sport.name} whileHover={{ scale: 1.02, y: -2 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedSport(sport.name)}
                  className="rounded-2xl overflow-hidden cursor-pointer border"
                  style={{ backgroundColor: getSportBg(sport.name), borderColor: `${color}30` }}
                >
                  <div className="relative h-36 overflow-hidden">
                    <img src={sport.image} alt={sport.name} className="w-full h-full object-cover transition-transform duration-500 hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-3 left-3"><SportIcon sport={sport.name} size={24} color={color} strokeWidth={2.5} /></div>
                  </div>
                  <div className="p-3.5">
                    <p className="text-white font-black" style={{ fontSize: 14 }}>{sport.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p style={{ color, fontSize: 13, fontWeight: 800 }}>{sport.priceLabel}</p>
                      <p className="text-gray-500" style={{ fontSize: 11 }}>{sport.courts}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar widgets */}
        <div className="space-y-4">
          {/* Upcoming */}
          <div className="rounded-2xl p-4 border border-white/5" style={{ background: "#141414" }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-black" style={{ fontSize: 14 }}>Upcoming</h4>
              <button onClick={() => onNavigate("booking", "mybookings")} className="text-[#FF8C00] font-black" style={{ fontSize: 11 }}>View All</button>
            </div>
            {upcomingBookings.length === 0 ? (
              <div className="text-center py-5">
                <CalendarDays size={26} className="text-gray-700 mx-auto mb-2" />
                <p className="text-gray-500" style={{ fontSize: 12 }}>No upcoming bookings</p>
                <button onClick={() => onNavigate("booking", "map")} className="text-[#FF8C00] font-black mt-1.5" style={{ fontSize: 12 }}>Book one now</button>
              </div>
            ) : upcomingBookings.slice(0, 3).map(b => (
              <div key={b.id} className="flex items-center gap-3 bg-[#1A1A1A] rounded-xl p-3 mb-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${getSportColor(b.sport)}20` }}>
                  <SportIcon sport={b.sport} size={18} color={getSportColor(b.sport)} strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black truncate" style={{ fontSize: 13 }}>{b.sport}</p>
                  <p className="text-gray-500 truncate" style={{ fontSize: 11 }}>{b.date} · {b.time}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Loyalty */}
          {user && (
            <div className="rounded-2xl p-4 border border-[#FFD700]/20" style={{ background: "rgba(255,215,0,0.04)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Trophy size={15} className="text-[#FFD700]" />
                <h4 className="text-white font-black" style={{ fontSize: 14 }}>Loyalty Rewards</h4>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400" style={{ fontSize: 12 }}>Points</span>
                <motion.span key={loyaltyPoints} initial={{ scale: 0.82 }} animate={{ scale: 1 }} className="text-[#FFD700] font-black" style={{ fontSize: 13 }}>{loyaltyPoints}/10</motion.span>
              </div>
              <LoyaltyProgressBar points={loyaltyPoints} height={8} />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className={loyaltyRewards > 0 ? "text-yellow-300" : "text-gray-600"} style={{ fontSize: 11 }}>
                  {loyaltyRewards > 0
                    ? `${loyaltyRewards} reward · ${LOYALTY_DISCOUNT_PERCENT}% off court`
                    : `${10 - (loyaltyPoints % 10 || 10)} more for ${LOYALTY_DISCOUNT_PERCENT}% off`}
                </p>
                <button type="button" onClick={resetMyLoyalty} className="rounded-lg px-2 py-1 text-gray-500 hover:text-white hover:bg-white/5" style={{ fontSize: 10, fontWeight: 800 }}>
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <SportDetailModal sport={selectedSport} onClose={() => setSelectedSport(null)} onBook={() => { setSelectedSport(null); onNavigate("booking", "map"); }} />
    </div>
  );
}

/* ─── Main shell ─── */
interface DesktopAppShellProps { onLogout: () => void; }
export function DesktopAppShell({ onLogout }: DesktopAppShellProps) {
  const { user, logout, isAdmin, isStaff, updateUser } = useUser();
  const { resetLoyaltyPoints } = useUserAPI();
  const { findCoachByEmail } = useCoaching();
  const myCoachProfile = user?.email ? findCoachByEmail(user.email) : null;
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [activeSub, setActiveSub] = useState<Record<string, string>>({ booking: "map", coaching: "services" });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [clearingNotifs, setClearingNotifs] = useState(false);
  const [notifClearError, setNotifClearError] = useState("");
  const [showClearNotifConfirm, setShowClearNotifConfirm] = useState(false);

  // From Incoming: Announcement and Booking logic
  const { announcements, dismissAnnouncement, clearUserNotifications, undismissedCount } = useAnnouncements();
  const [bookingPrefill, setBookingPrefill] = useState<{
    sport: string;
    date: string;
    time: string;
    coachId?: string;
    coachingSessionId?: string;
    coachingStudentName?: string;
    coachingStudentId?: string;
    coachName?: string;
    coachHourlyRate?: number;
    durationHours?: number;
    coachingMessage?: string;
  } | undefined>(undefined);

  // From Incoming: Profile Photo logic
  const [profilePhoto, setProfilePhoto] = useState(() => loadProfilePhoto(user?.id));
  const unread = undismissedCount;
  const loyaltyPoints = user?.loyaltyPoints || 0;
  const loyaltyRewards = Math.floor(loyaltyPoints / 10);
  const loyaltyProgress = loyaltyRewards > 0 ? 100 : Math.min((loyaltyPoints / 10) * 100, 100);
  const resetMyLoyalty = async () => {
    if (!user) return;
    try {
      await resetLoyaltyPoints(user.id);
    } catch {
      /* demo fallback */
    }
    updateUser(user.id, { loyaltyPoints: 0 });
  };

  useEffect(() => {
    setProfilePhoto(loadProfilePhoto(user?.id));
    return onProfilePhotoUpdated((dataUrl, updatedUserId) => {
      if (!updatedUserId || updatedUserId === user?.id) setProfilePhoto(dataUrl);
    });
  }, [user?.id]);

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const navigate = (tab: Tab | string, sub?: any) => {
    if (tab === "book_court") {
      setBookingPrefill(sub);
      setActiveTab("booking");
      setActiveSub(prev => ({ ...prev, booking: "map" }));
      setMobileOpen(false);
      return;
    }
    const t = tab as Tab;
    setActiveTab(t);
    if (typeof sub === "string") setActiveSub(prev => ({ ...prev, [t]: sub }));
    setMobileOpen(false);
  };

  const openNotification = (ann: (typeof announcements)[number]) => {
    if (!ann.dismissed) dismissAnnouncement(ann.id);
    if (ann.actionTab === "coaching") navigate("coaching", ann.actionSub || "mycoaching");
    else if (ann.actionTab === "booking") navigate("booking", ann.actionSub || "mybookings");
    else navigate("home");
    setShowNotifs(false);
  };

  const getCurrentSub = () => activeSub[activeTab] || "";

  if (isAdmin) return <ConsolidatedAdminDashboard onLogout={handleLogout} />;
  if (isStaff) return <ConsolidatedStaffDashboard onLogout={handleLogout} />;

  /* ── Content renderer ── */
  const renderContent = () => {
    const sub = getCurrentSub();
    switch (activeTab) {
      case "home":
        return <UserHomePage onNavigate={navigate} />;

      case "booking":
        return (
          <AnimatePresence mode="wait">
            <motion.div
              key={sub}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {sub === "mybookings" && (
                <div className="h-full overflow-y-auto custom-scrollbar">
                  <UserMyBookings />
                </div>
              )}
              {sub === "map" && (
                <div className="h-full overflow-hidden">
                  <FacilityMapViewer
                    mode="customer"
                    compact
                    prefill={bookingPrefill}
                    onExitCoachingReservation={bookingPrefill?.coachingSessionId || bookingPrefill?.coachId ? () => {
                      setBookingPrefill(undefined);
                      setActiveTab("coaching");
                      setActiveSub(prev => ({ ...prev, coaching: "mycoaching" }));
                    } : undefined}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        );

      case "coaching":
        return (
          <AnimatePresence mode="wait">
            <motion.div
              key={sub}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto custom-scrollbar"
            >
              {sub === "services" && <UserCoachingServices onNavigate={(t, params) => {
                if (t === "mycoaching") navigate("coaching", "mycoaching");
                else if (t === "book_court") navigate("book_court", params);
              }} />}
              {sub === "mycoaching" && <UserMyCoaching onNavigate={(t, params) => { 
                if (t === "coaches") navigate("coaching", "services"); 
                else if (t === "book_court") navigate("book_court", params);
              }} />}
              {sub === "apply" && <CoachApplicationForm />}
            </motion.div>
          </AnimatePresence>
        );

      case "account":
        return (
          <div className="h-full overflow-y-auto p-6 custom-scrollbar">
            <div className="max-w-4xl mx-auto bg-[#111] rounded-3xl overflow-hidden border border-white/8 shadow-2xl" style={{ minHeight: 620 }}>
              <MobileProfileScreen onLogout={handleLogout} />
            </div>
          </div>
        );
    }
  };

  /* ── Page title ── */
  const sub = getCurrentSub();
  const activeNavItem = NAV.find(n => n.id === activeTab);
  const activeChild = activeNavItem?.children?.find(c => c.id === sub);
  const pageTitle = activeChild?.label || activeNavItem?.label || "Dashboard";
  const pageColor = activeNavItem?.color || "#FF8C00";

  /* ─── Sidebar nav item ─── */
  const renderSidebarItem = (item: NavItem) => {
    const isActive = activeTab === item.id;
    const currentSubId = activeSub[item.id];
    const hasChildren = !!item.children?.length;

    const btn = (
      <button
        onClick={() => navigate(item.id, item.children?.[0]?.id)}
        className="w-full flex items-center gap-3 rounded-xl transition-all group relative"
        style={{
          padding: sidebarCollapsed ? "10px 0" : "9px 10px",
          justifyContent: sidebarCollapsed ? "center" : "flex-start",
          background: isActive ? `${item.color}14` : "transparent",
        }}
      >
        {/* Active left bar */}
        {isActive && !sidebarCollapsed && (
          <motion.div layoutId="sideActiveBar" className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full" style={{ backgroundColor: item.color }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
        )}

        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
          style={{
            background: isActive ? `linear-gradient(135deg, ${item.color}, ${item.color}cc)` : "rgba(255,255,255,0.05)",
            boxShadow: isActive ? `0 4px 12px ${item.color}40` : "none",
          }}
        >
          <item.icon size={16} color={isActive ? "white" : "#555"} strokeWidth={isActive ? 2.5 : 2} />
        </div>

        {!sidebarCollapsed && (
          <>
            <div className="text-left min-w-0 flex-1">
              <p className="font-black transition-colors" style={{ fontSize: 12, color: isActive ? "#F8FAFC" : "#777" }}>
                {item.label}
              </p>
              {isActive && activeChild && (
                <p style={{ fontSize: 10, color: item.color, fontWeight: 700 }}>{activeChild.label}</p>
              )}
            </div>
            {hasChildren && (
              <ChevronDown size={13} className="transition-transform flex-shrink-0" style={{ color: "#555", transform: isActive ? "rotate(180deg)" : "rotate(0deg)" }} />
            )}
          </>
        )}
      </button>
    );

    return (
      <div>
        {sidebarCollapsed ? <SidebarTooltip label={item.label}>{btn}</SidebarTooltip> : btn}

        {/* Sub-items — simple fade, no height animation */}
        {isActive && hasChildren && !sidebarCollapsed && (
          <div className="mt-1 mb-1 ml-4 pl-4 space-y-0.5" style={{ borderLeft: `1px solid rgba(255,255,255,0.06)` }}>
            {item.children!.map(child => {
              const isSubActive = currentSubId === child.id;
              return (
                <button
                  key={child.id}
                  onClick={(e) => { e.stopPropagation(); navigate(item.id, child.id); }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all relative"
                  style={{
                    background: isSubActive ? `${item.color}12` : "transparent",
                  }}
                >
                  <child.icon size={13} style={{ color: isSubActive ? item.color : "#555" }} strokeWidth={2} />
                  <span className="font-black" style={{ fontSize: 12, color: isSubActive ? "#F8FAFC" : "#666" }}>
                    {child.label}
                  </span>
                  {isSubActive && (
                    <div
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-screen h-screen bg-[#0A0A0A] flex overflow-hidden">

      {/* ── Mobile overlay ── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-30 md:hidden backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 72 : 228 }}
        transition={{ type: "spring", stiffness: 380, damping: 34 }}
        className={`bg-[#0E0E0E] border-r border-white/[0.05] flex-col flex-shrink-0 overflow-hidden
          fixed md:static inset-y-0 left-0 z-40 flex
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} transition-transform duration-300 md:transition-none`}
        style={{ minWidth: sidebarCollapsed ? 72 : 228, maxWidth: sidebarCollapsed ? 72 : 228 }}
      >
        {/* Logo + toggle */}
        <div className="flex items-center px-4 py-5 flex-shrink-0" style={{ justifyContent: sidebarCollapsed ? "center" : "space-between" }}>
          <div className="flex items-center gap-2.5" style={{ overflow: "hidden" }}>
              <div className="flex items-center gap-2.5" style={{ overflow: "hidden" }}>
                  {/* Replaced the div logo with an img tag */}
                  <img 
                    src="/pwa-icons/icon-48x48.png" 
                    alt="JRC Logo"
                    className="w-9 h-9 rounded-xl flex-shrink-0 object-cover shadow-lg"
                  />
              </div>
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }} transition={{ duration: 0.15 }} style={{ overflow: "hidden", whiteSpace: "nowrap" }}>
                  <p className="font-black" style={{ fontSize: 15, lineHeight: 1.1 }}>
                    <span style={{ color: "white" }}>JRC </span>
                    <span style={{ color: "#FF8C00" }}>Sport</span>
                    <span style={{ color: "#0047AB" }}>Sync</span>
                  </p>
                  <p style={{ fontSize: 9, fontWeight: 800, color: "#3a3a3a", letterSpacing: 1.5 }}>SPORTS COMPLEX</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/8 text-gray-600 hover:text-gray-300 flex-shrink-0"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {sidebarCollapsed && (
          <div className="flex justify-center mb-2">
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/8 text-gray-600 hover:text-gray-300"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div className="w-full h-px bg-white/[0.04] flex-shrink-0 mx-auto" style={{ width: sidebarCollapsed ? 40 : "calc(100% - 24px)", marginLeft: sidebarCollapsed ? "auto" : 12 }} />

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3 space-y-0.5" style={{ padding: sidebarCollapsed ? "12px 8px" : "12px 10px" }}>
          {!sidebarCollapsed && (
            <p className="text-gray-700 mb-2 pl-2 font-black" style={{ fontSize: 9, letterSpacing: 1.5 }}>NAVIGATION</p>
          )}
          {NAV.map(item => <div key={item.id}>{renderSidebarItem(item)}</div>)}
        </nav>

        <div className="w-full h-px bg-white/[0.04] flex-shrink-0" />

        {/* User footer */}
        <div className="flex-shrink-0 p-3" style={{ paddingLeft: sidebarCollapsed ? 8 : 12, paddingRight: sidebarCollapsed ? 8 : 12 }}>
          {sidebarCollapsed ? (
            <SidebarTooltip label="Sign Out" danger>
              <button
                onClick={handleLogout}
                className="w-full flex justify-center py-2 rounded-xl hover:bg-red-500/10 transition-all text-gray-600 hover:text-red-400"
              >
                <LogOut size={16} />
              </button>
            </SidebarTooltip>
          ) : (
            <div className="rounded-2xl p-3 border border-white/5" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
                  <PhotoAvatar src={profilePhoto} name={user?.name} size={36} rounded={12} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-black truncate" style={{ fontSize: 12 }}>{user?.name}</p>
                  <p className="text-gray-600 truncate" style={{ fontSize: 10 }}>{user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/8 py-1.5 rounded-xl transition-all"
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                <LogOut size={13} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 bg-[#111] px-4 py-3 border-b border-white/[0.05] flex-shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-xl hover:bg-white/5 transition-all flex-shrink-0">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <path d="M0 1h18M0 7h14M0 13h18" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <p className="text-white font-black" style={{ fontSize: 15 }}>
            <span style={{ color: "#FF8C00" }}>JRC</span> SportSync
          </p>
          <button onClick={() => setShowNotifs(s => !s)} className="relative p-2 rounded-xl hover:bg-white/5 transition-all ml-auto">
            <Bell size={18} className="text-gray-400" />
            {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF8C00] rounded-full" />}
          </button>
        </div>

        {/* Top header bar (desktop) */}
        <div className="hidden md:flex h-14 bg-[#0E0E0E] border-b border-white/[0.05] items-center px-6 flex-shrink-0 gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${pageColor}20` }}>
              {activeNavItem && <activeNavItem.icon size={13} style={{ color: pageColor }} strokeWidth={2.5} />}
            </div>
            <span className="text-gray-600" style={{ fontSize: 13 }}>{activeNavItem?.label}</span>
            {activeChild && (
              <>
                <ChevronRight size={12} className="text-gray-700" />
                <span className="text-white font-black" style={{ fontSize: 13 }}>{activeChild.label}</span>
              </>
            )}
          </div>

          <div className="flex-1" />

          {/* Points badge */}
          {user && (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 border" style={{ background: "rgba(255,215,0,0.06)", borderColor: "rgba(255,215,0,0.15)" }}>
              <Trophy size={12} className="text-[#FFD700]" />
              <span className="text-[#FFD700] font-black" style={{ fontSize: 12 }}>{user.loyaltyPoints} pts</span>
            </div>
          )}

          {/* Coach badge */}
          {myCoachProfile && (
            <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 border" style={{ background: "rgba(168,85,247,0.06)", borderColor: "rgba(168,85,247,0.15)" }}>
              <Award size={12} className="text-purple-400" />
              <span className="text-purple-400 font-black" style={{ fontSize: 12 }}>Coach</span>
            </div>
          )}

          {/* Notification bell */}
          <div className="relative">
            <button onClick={() => setShowNotifs(s => !s)}
              className="relative w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/6 transition-all"
              style={{ background: showNotifs ? "rgba(255,140,0,0.1)" : "rgba(255,255,255,0.04)" }}
            >
              <Bell size={16} style={{ color: showNotifs ? "#FF8C00" : "#888" }} />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white font-black"
                  style={{ fontSize: 9, background: "linear-gradient(135deg,#FF8C00,#e67e00)" }}>
                  {unread}
                </span>
              )}
            </button>
            <AnimatePresence>
              {showNotifs && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -8 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute right-0 top-full mt-2 w-80 z-[100] rounded-2xl overflow-hidden shadow-2xl"
                  style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", position: 'fixed', top: '60px', right: '16px' }}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between gap-3">
                    <p className="text-white font-black" style={{ fontSize: 14 }}>Notifications</p>
                    <div className="flex items-center gap-2">
                      {announcements.length > 0 && (
                        <button
                          disabled={clearingNotifs}
                          onClick={() => {
                            setNotifClearError("");
                            setShowClearNotifConfirm(true);
                          }}
                          className="px-2.5 py-1 rounded-lg border border-white/10 text-gray-400 hover:text-red-300 hover:border-red-500/30 hover:bg-red-500/10 font-black"
                          style={{ fontSize: 10 }}
                        >
                          {clearingNotifs ? "Clearing..." : "Clear"}
                        </button>
                      )}
                      <button onClick={() => setShowNotifs(false)} className="text-gray-600 hover:text-white">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {notifClearError && (
                      <div className="mx-4 mt-3 rounded-xl px-3 py-2 text-red-200 font-black border border-red-500/25 bg-red-500/10" style={{ fontSize: 11 }}>
                        {notifClearError}
                      </div>
                    )}
                    {announcements.length === 0 ? (
                      <div className="py-8 text-center text-gray-500" style={{ fontSize: 13 }}>No notifications</div>
                    ) : announcements.map(n => (
                      <button key={n.id} onClick={() => openNotification(n)}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/4 transition-all text-left border-b border-white/4"
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${(ANNOUNCEMENT_COLORS[n.type]?.text || '#FF8C00')}18` }}>
                          {n.id.startsWith("notif:") ? <Bell size={14} style={{ color: ANNOUNCEMENT_COLORS[n.type]?.text || '#FF8C00' }} /> : <Megaphone size={14} style={{ color: ANNOUNCEMENT_COLORS[n.type]?.text || '#FF8C00' }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-black" style={{ fontSize: 12 }}>{n.title}</p>
                          <p className="text-gray-500 truncate" style={{ fontSize: 11 }}>{n.message}</p>
                          <p className="text-gray-700" style={{ fontSize: 10 }}>{new Date(n.createdAt).toLocaleDateString()}</p>
                        </div>
                        {!n.dismissed && <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#FF8C00' }} />}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-hidden relative" onClick={() => setShowNotifs(false)}>
          {renderContent()}
        </main>
      </div>

      {/* Floating AI Chat — Customer only (admin/staff return early above) */}
      <AnimatePresence>
        {showClearNotifConfirm && (
          <div className="fixed inset-0 z-[220] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/75 backdrop-blur-sm"
              onClick={() => setShowClearNotifConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 14 }}
              className="relative w-full max-w-sm rounded-3xl border border-white/10 bg-[#171717] p-6 shadow-2xl"
            >
              <p className="text-white font-black" style={{ fontSize: 18 }}>Clear notifications?</p>
              <p className="mt-2 text-gray-400" style={{ fontSize: 13, lineHeight: 1.5 }}>
                This removes all visible notifications and clears the Supabase notification records for your account.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  disabled={clearingNotifs}
                  onClick={() => setShowClearNotifConfirm(false)}
                  className="flex-1 rounded-2xl bg-white/8 py-3 text-gray-300 font-black"
                  style={{ fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={clearingNotifs}
                  onClick={async () => {
                    setClearingNotifs(true);
                    setNotifClearError("");
                    try {
                      await clearUserNotifications();
                      setShowClearNotifConfirm(false);
                      setShowNotifs(false);
                    } catch (error: any) {
                      setNotifClearError(error?.message || "Could not clear notifications.");
                    } finally {
                      setClearingNotifs(false);
                    }
                  }}
                  className="flex-1 rounded-2xl py-3 text-white font-black disabled:opacity-60"
                  style={{ fontSize: 13, background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
                >
                  {clearingNotifs ? "Clearing..." : "Clear all"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <FloatingAIChat />
    </div>
  );
}
