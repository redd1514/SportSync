import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell, ChevronRight, Clock, MapPin, Star, X, ArrowRight,
  Trophy, GraduationCap, Users, Zap, Shield, Award, Sparkles,
  CalendarDays, Play, ChevronLeft,
} from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { useAnnouncements } from "../../contexts/AnnouncementsContext";
import { SportIcon, getSportColor } from "../SportIcons";
import { SportDetailModal } from "../SportDetailModal";
import { SPORTS_INFO } from "../sportsData";

/* ─── Dark palette (no isDark) ─────────────────────────────────────── */
const BG     = "#0F1011";
const SURF   = "#1A1B1E";
const SURF2  = "#242529";
const BORDER = "rgba(255,255,255,0.07)";
const TP     = "#E8E8EA";
const TS     = "#9294A0";
const ORANGE = "#F97316";
const BLUE   = "#2563EB";

const quickStats = [
  { icon: Clock,  label: "Hours",    value: "7AM–12MN",   color: ORANGE  },
  { icon: MapPin, label: "Location", value: "Valenzuela",  color: BLUE   },
  { icon: Star,   label: "Rating",   value: "4.9 ★",      color: "#FBBF24" },
  { icon: Users,  label: "Courts",   value: "12 total",   color: "#22c55e" },
];

/* ─── Image Carousel ─────────────────────────────────────────────── */
function SportsCarousel({ onSportSelect }: { onSportSelect: (sport: string) => void }) {
  const [current, setCurrent] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX    = useRef(0);
  const deltaX    = useRef(0);
  const autoRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const total     = SPORTS_INFO.length;

  const next = useCallback(() => setCurrent(c => (c + 1) % total), [total]);
  const prev = useCallback(() => setCurrent(c => (c - 1 + total) % total), [total]);

  // Auto-advance every 3.5s
  useEffect(() => {
    autoRef.current = setInterval(next, 3500);
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [next]);

  const resetAuto = () => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(next, 3500);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    deltaX.current = 0;
    setDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    deltaX.current = e.touches[0].clientX - startX.current;
  };
  const handleTouchEnd = () => {
    setDragging(false);
    if (deltaX.current < -50)      { next(); resetAuto(); }
    else if (deltaX.current > 50)  { prev(); resetAuto(); }
    deltaX.current = 0;
  };

  const sport = SPORTS_INFO[current];
  const color  = getSportColor(sport.name);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl select-none" style={{ height: 240 }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>

      {/* Slides */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 cursor-pointer"
          onClick={() => onSportSelect(sport.name)}
        >
          <img src={sport.image} alt={sport.name} className="w-full h-full object-cover" />
          {/* Gradient overlay */}
          <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${color}dd 0%, ${color}55 40%, rgba(0,0,0,0.2) 100%)` }} />
          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <SportIcon sport={sport.name} size={20} color="white" strokeWidth={2.5} />
                  <span className="text-white font-black" style={{ fontSize: 22 }}>{sport.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full font-black text-white" style={{ fontSize: 11, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}>
                    {sport.priceLabel}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full font-black text-white" style={{ fontSize: 11, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}>
                    {sport.courts}
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)" }}>
                <ChevronRight size={18} className="text-white" />
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Prev / Next arrows */}
      <button
        onClick={e => { e.stopPropagation(); prev(); resetAuto(); }}
        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center z-10"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
      >
        <ChevronLeft size={16} className="text-white" />
      </button>
      <button
        onClick={e => { e.stopPropagation(); next(); resetAuto(); }}
        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center z-10"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)" }}
      >
        <ChevronRight size={16} className="text-white" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
        {SPORTS_INFO.map((_, i) => (
          <button key={i} onClick={e => { e.stopPropagation(); setCurrent(i); resetAuto(); }}
            className="transition-all rounded-full"
            style={{ width: i === current ? 18 : 5, height: 5, background: i === current ? "white" : "rgba(255,255,255,0.4)" }}
          />
        ))}
      </div>

      {/* Sport counter */}
      <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-full font-black" style={{ fontSize: 10, background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.7)", backdropFilter: "blur(8px)" }}>
        {current + 1} / {total}
      </div>
    </div>
  );
}

interface MobileHomeProps {
  onNavigate: (tab: string) => void;
  onOpenAI?: () => void;
}

export function PremiumMobileHome({ onNavigate, onOpenAI }: MobileHomeProps) {
  const { user, bookings } = useUser();
  const { announcements, dismissAnnouncement, undismissedCount } = useAnnouncements();
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const upcoming  = bookings.filter(b => ["confirmed", "pending_payment", "pending_verification", "rescheduled"].includes(b.status)).slice(0, 3);
  const unreadCount = undismissedCount;
  const firstName = user?.name?.split(" ")[0] || "Athlete";

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar" style={{ background: BG }}>

      {/* ── Header ── */}
      <div className="sticky top-0 z-20" style={{ background: "rgba(15,16,17,0.94)", borderBottom: "1px solid rgba(255,255,255,0.06)", backdropFilter: "blur(18px)" }}>
        <div className="px-5 py-3.5 flex items-center justify-between">
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
            <p style={{ fontSize: 12, color: TS }}>{getGreeting()},</p>
            <p className="font-black" style={{ fontSize: 20, color: TP }}>
              <span style={{ background: `linear-gradient(135deg,${ORANGE},#fb923c)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {firstName}
              </span>
            </p>
          </motion.div>

          {/* AI + Bell */}
          <div className="flex items-center gap-2">
            <motion.button whileTap={{ scale: 0.88 }} onClick={onOpenAI}
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#0047AB,#1d4ed8)", boxShadow: "0 4px 12px rgba(0,71,171,0.4)" }}>
              <Sparkles size={16} className="text-white" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowNotifications(true)}
              className="relative w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <Bell size={17} style={{ color: TP }} />
              {unreadCount > 0 && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-white font-black"
                  style={{ fontSize: 9 }}>
                  {unreadCount}
                </motion.span>
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ── Notifications Sheet ── */}
      <AnimatePresence>
        {showNotifications && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40" onClick={() => setShowNotifications(false)} />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
              style={{ background: SURF, border: "1px solid " + BORDER, borderBottom: "none", maxHeight: "70vh" }}>
              <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
              <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: BORDER }}>
                <p className="font-black" style={{ color: TP, fontSize: 17 }}>Notifications</p>
                <button onClick={() => setShowNotifications(false)} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <X size={15} style={{ color: TS }} />
                </button>
              </div>
              <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: "55vh" }}>
                {announcements.length === 0 ? (
                  <div className="flex flex-col items-center py-12 gap-3">
                    <Bell size={28} style={{ color: TS, opacity: 0.35 }} />
                    <p style={{ color: TS, fontSize: 13 }}>No notifications</p>
                  </div>
                ) : announcements.map(ann => (
                  <div key={ann.id} className="flex items-start gap-3 px-5 py-4 border-b" style={{ borderColor: BORDER }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(249,115,22,0.12)" }}>
                      <Bell size={15} style={{ color: ORANGE }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black" style={{ color: TP, fontSize: 13 }}>{ann.title}</p>
                      <p style={{ color: TS, fontSize: 12, lineHeight: 1.5 }}>{ann.message}</p>
                    </div>
                    <button onClick={() => dismissAnnouncement(ann.id)} className="p-1 flex-shrink-0">
                      <X size={13} style={{ color: TS }} />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Greeting + live badge ── */}
      <div className="px-5 pt-5 pb-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-4"
            style={{ background: `${ORANGE}12`, borderColor: `${ORANGE}30` }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" style={{ boxShadow: "0 0 6px #22c55e" }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: ORANGE, letterSpacing: 0.5 }}>
              JRC SPORTSYNC · VALENZUELA CITY
            </span>
          </div>

          <h1 className="font-black mb-2" style={{ fontSize: 28, lineHeight: 1.1, color: TP }}>
            Where Every Game<br />
            <span style={{ background: `linear-gradient(135deg,${ORANGE} 0%,#fb923c 60%,#fbbf24 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Comes to Life.
            </span>
          </h1>
          <p style={{ color: TS, fontSize: 13, lineHeight: 1.5 }}>
            6 sports · 12 courts · Open 7 AM – 12 MN daily
          </p>
        </motion.div>
      </div>

      {/* ── CTA row ── */}
      <div className="flex items-center gap-2 px-5 pb-5">
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => onNavigate("map")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-black"
          style={{ background: `linear-gradient(135deg,${ORANGE},#ea6b00)`, fontSize: 14, boxShadow: `0 8px 20px ${ORANGE}40` }}>
          <Play size={14} fill="white" /> Facility Map
        </motion.button>
        <motion.button whileTap={{ scale: 0.96 }} onClick={() => onNavigate("coaching")}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-black border"
          style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER, fontSize: 14, color: TP }}>
          <GraduationCap size={14} style={{ color: BLUE }} /> Coaching
        </motion.button>
      </div>

      {/* ── Quick Stats ── */}
      <div className="px-5 mb-5">
        <div className="grid grid-cols-4 gap-2">
          {quickStats.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
              className="rounded-2xl p-2.5 flex flex-col items-center gap-1" style={{ background: SURF, border: "1px solid " + BORDER }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}15` }}>
                <s.icon size={13} style={{ color: s.color }} />
              </div>
              <p className="font-black text-center" style={{ fontSize: 10, color: TP, lineHeight: 1.2 }}>{s.value}</p>
              <p style={{ fontSize: 9, color: TS }}>{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Sports Carousel ── */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-black" style={{ fontSize: 17, color: TP }}>Our Sports</p>
          <button onClick={() => onNavigate("map")} className="flex items-center gap-1 font-black" style={{ color: ORANGE, fontSize: 12 }}>
            Facility Map <ChevronRight size={13} />
          </button>
        </div>
        <SportsCarousel onSportSelect={setSelectedSport} />
      </div>

      {/* ── Upcoming Bookings ── */}
      {upcoming.length > 0 && (
        <div className="px-5 mb-5">
          <div className="flex items-center justify-between mb-3">
            <p className="font-black" style={{ fontSize: 17, color: TP }}>Upcoming</p>
            <button onClick={() => onNavigate("mybookings")} className="font-black" style={{ color: ORANGE, fontSize: 12 }}>View All</button>
          </div>
          <div className="space-y-2">
            {upcoming.map((b, idx) => {
              const c   = getSportColor(b.sport || "Basketball");
              const [hh] = b.time.split(":").map(Number);
              const h12  = hh % 12 || 12;
              const ap   = hh >= 12 ? "PM" : "AM";
              return (
                <motion.div key={b.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.07 }}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: SURF, border: "1px solid " + BORDER }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${c}18`, border: `1px solid ${c}28` }}>
                    <SportIcon sport={b.sport} size={18} color={c} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black truncate" style={{ fontSize: 13, color: TP }}>{b.court}</p>
                    <p style={{ fontSize: 11, color: TS }}>{b.date} · {h12}:00 {ap}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full font-black" style={{ background: `${c}18`, color: c, fontSize: 10 }}>{b.duration}h</span>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Loyalty ── */}
      {user && (
        <div className="px-5 mb-5">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
            style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.18)" }}>
            <Trophy size={20} style={{ color: "#FBBF24", flexShrink: 0 }} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-black" style={{ fontSize: 13, color: TP }}>Loyalty Points</p>
                <p className="font-black" style={{ fontSize: 16, color: "#FBBF24" }}>{user.loyaltyPoints}</p>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((user.loyaltyPoints / 10) * 100, 100)}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                  className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#FBBF24,#F97316)" }} />
              </div>
              <p style={{ fontSize: 10, color: TS, marginTop: 4 }}>
                {user.loyaltyPoints >= 10 ? "🎉 Eligible for a free session!" : `${10 - user.loyaltyPoints} pts to free session`}
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Coach CTA ── */}
      <div className="px-5 mb-8">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl p-5"
          style={{ background: "linear-gradient(135deg,#08101e 0%,#0c1a30 60%,#080e1c 100%)", border: "1px solid rgba(37,99,235,0.2)" }}>
          <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-30 pointer-events-none"
            style={{ background: `radial-gradient(circle,${BLUE}66,transparent 70%)`, filter: "blur(40px)", transform: "translate(30%,-30%)" }} />
          <div className="flex items-start gap-3 relative z-10">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg,${BLUE},#1d4ed8)`, boxShadow: `0 6px 18px ${BLUE}50` }}>
              <GraduationCap size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border mb-1.5"
                style={{ background: `${BLUE}18`, borderColor: `${BLUE}35` }}>
                <Award size={9} style={{ color: "#60a5fa" }} />
                <span style={{ fontSize: 9, fontWeight: 800, color: "#60a5fa" }}>COACHING</span>
              </div>
              <p className="font-black" style={{ fontSize: 15, color: TP }}>Become a JRC Coach</p>
              <p style={{ fontSize: 12, color: TS, lineHeight: 1.5, marginTop: 2 }}>Share your passion & earn doing what you love.</p>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onNavigate("coaching")}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-2xl text-white font-black relative z-10"
            style={{ background: `linear-gradient(135deg,${BLUE},#1d4ed8)`, fontSize: 13, boxShadow: `0 6px 18px ${BLUE}40` }}>
            <Play size={12} fill="white" /> Browse Coaches <ArrowRight size={13} />
          </motion.button>
        </motion.div>
      </div>

      <SportDetailModal
        sport={selectedSport}
        onClose={() => setSelectedSport(null)}
        onBook={() => { setSelectedSport(null); onNavigate("map"); }}
      />
    </div>
  );
}
