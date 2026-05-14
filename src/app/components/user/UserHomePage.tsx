import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight, Trophy, GraduationCap, Sparkles, Play, Award, CheckCircle,
  ChevronRight, CalendarDays, Maximize2, Users, Zap, Shield, Clock, MapPin, Star,
} from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { useRealtimeBookingAPI } from "../../hooks/useRealtimeAPI";
import { SPORTS_INFO } from "../sportsData";
import { getSportColor, SportIcon } from "../SportIcons";
import {
  BG, SURF, SURF2, BORDER, TP, TS, ORANGE, BLUE,
  SPORT_RATES, MARQUEE_ITEMS,
  FloatingOrbs, TickerBar, SportRateModal, Lightbox,
} from "./UserHomeComponents";

type Tab = "home" | "booking" | "coaching" | "account";

function greetingText() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export function UserHomePage({ onNavigate }: { onNavigate: (tab: Tab, sub?: string) => void }) {
  const { user } = useUser();
  const { bookings } = useRealtimeBookingAPI(user?.id || '', { autoFetch: true });
  const [hoveredSport, setHoveredSport] = useState<string | null>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const firstName = user?.name?.split(" ")[0] || "Athlete";
  
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
  const upcoming = bookings.filter(b => {
    const isPastDate = parseBookingDate(b.date) < today;
    const isPendingReq = b.cancellationRequested || localPendingRequests.includes(b.id);
    if (isPastDate || b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected') return false;
    if (isPendingReq) return false;
    return true;
  }).slice(0, 3);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar" style={{ background: BG, fontFamily: "'Outfit','Inter',sans-serif", color: TP }}>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ minHeight: 360 }}>
        <FloatingOrbs />
        <div className="relative z-10 px-6 sm:px-8 pt-10 pb-10">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-5"
              style={{ background: `${ORANGE}12`, borderColor: `${ORANGE}30` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#22c55e', boxShadow: '0 0 6px rgba(34,197,94,0.8)' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: ORANGE, letterSpacing: 0.5 }}>JRC SPORTSYNC · VALENZUELA CITY</span>
            </div>
          </motion.div>

          <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-10">
            <div className="flex-1">
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
                style={{ color: TS, fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                {greetingText()}, <span style={{ color: TP }}>{firstName}</span>
              </motion.p>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.55 }}
                style={{ fontSize: "clamp(28px,4.5vw,50px)", fontWeight: 900, lineHeight: 1.08, marginBottom: 22 }}>
                Where Every Game<br />
                <span style={{ background: `linear-gradient(135deg,${ORANGE} 0%,#fb923c 60%,#fbbf24 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Comes to Life.
                </span>
              </motion.h1>

              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="flex items-center gap-3 flex-wrap mb-6">
                <motion.button whileHover={{ scale: 1.04, boxShadow: `0 16px 40px ${ORANGE}55` }} whileTap={{ scale: 0.97 }}
                  onClick={() => onNavigate("booking", "map")}
                  className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl text-white"
                  style={{ background: `linear-gradient(135deg,${ORANGE},#ea6b00)`, fontSize: 14, fontWeight: 800, boxShadow: `0 8px 24px ${ORANGE}40` }}>
                  <Play size={14} fill="white" /> Book a Court
                </motion.button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => onNavigate("coaching", "services")}
                  className="flex items-center gap-2 px-5 py-3.5 rounded-2xl border transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", borderColor: BORDER, fontSize: 14, fontWeight: 700 }}>
                  <GraduationCap size={15} style={{ color: BLUE }} /> Coaching Hub
                </motion.button>
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="flex items-center gap-5 flex-wrap">
                {[
                  { icon: Clock,  text: "7AM – 12MN",       color: ORANGE },
                  { icon: MapPin, text: "Valenzuela City",   color: BLUE },
                  { icon: Star,   text: "4.9 / 5.0 rating", color: "#FBBF24" },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-1.5">
                    <item.icon size={13} style={{ color: item.color }} />
                    <span style={{ color: TS, fontSize: 12, fontWeight: 600 }}>{item.text}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Right widget column */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
              className="lg:w-72 flex-shrink-0 space-y-3 w-full">
              {/* Upcoming bookings */}
              <div className="rounded-2xl border overflow-hidden" style={{ background: `${SURF}d0`, borderColor: BORDER, backdropFilter: "blur(20px)" }}>
                <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: BORDER }}>
                  <div className="flex items-center gap-2">
                    <CalendarDays size={14} style={{ color: ORANGE }} />
                    <p style={{ color: TP, fontSize: 13, fontWeight: 800 }}>Upcoming</p>
                  </div>
                  <button onClick={() => onNavigate("booking", "mybookings")}
                    className="flex items-center gap-1 hover:opacity-70 transition-opacity"
                    style={{ color: ORANGE, fontSize: 11, fontWeight: 700 }}>
                    View All <ChevronRight size={11} />
                  </button>
                </div>
                <div className="p-3">
                  {upcoming.length === 0 ? (
                    <div className="text-center py-5">
                      <CalendarDays size={24} className="mx-auto mb-2" style={{ color: TS, opacity: 0.3 }} />
                      <p style={{ color: TS, fontSize: 12 }}>No upcoming bookings</p>
                      <button onClick={() => onNavigate("booking", "map")}
                        className="mt-1.5 hover:opacity-70 transition-opacity font-black" style={{ color: ORANGE, fontSize: 12 }}>Book now →</button>
                    </div>
                  ) : upcoming.map(b => {
                    const c = getSportColor(b.sport || "Basketball");
                    const [hh] = b.time.split(":").map(Number);
                    const h12 = hh % 12 || 12; const ampm = hh >= 12 ? "PM" : "AM";
                    return (
                      <div key={b.id} className="flex items-center gap-3 px-1 py-2.5 border-b last:border-0" style={{ borderColor: BORDER }}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${c}18`, border: `1px solid ${c}28` }}>
                          <SportIcon sport={b.sport || "Basketball"} size={15} color={c} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ color: TP, fontSize: 12, fontWeight: 700 }}>{b.court}</p>
                          <p style={{ color: TS, fontSize: 11 }}>{b.date} · {h12}:00 {ampm}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full font-black" style={{ background: `${c}18`, color: c, fontSize: 10 }}>{b.duration}h</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Loyalty */}
              {user && (
                <div className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ background: "rgba(251,191,36,0.05)", borderColor: "rgba(251,191,36,0.15)" }}>
                  <Trophy size={18} style={{ color: "#FBBF24", flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p style={{ color: TP, fontSize: 13, fontWeight: 800 }}>Loyalty Points</p>
                      <p style={{ color: "#FBBF24", fontSize: 16, fontWeight: 900 }}>{user.loyaltyPoints}</p>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((user.loyaltyPoints / 10) * 100, 100)}%` }}
                        transition={{ delay: 0.6, duration: 1.2, ease: "easeOut" }}
                        className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#FBBF24,#F97316)" }} />
                    </div>
                    <p style={{ color: TS, fontSize: 10, marginTop: 4 }}>
                      {user.loyaltyPoints >= 10 ? "Eligible for a free session!" : `${10 - user.loyaltyPoints} pts to free session`}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      <TickerBar />

      {/* ── SPORT SLICES ── */}
      <section className="px-6 sm:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.45 }}
          className="flex items-end justify-between mb-5"
        >
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Our Sports</h2>
            <p style={{ color: TS, fontSize: 13 }}>Hover to explore · Click for rates</p>
          </div>
          <button onClick={() => onNavigate("booking", "map")}
            className="flex items-center gap-1 hover:opacity-70 transition-opacity" style={{ color: ORANGE, fontSize: 13, fontWeight: 700 }}>
            Facility Map <ChevronRight size={14} />
          </button>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.45, delay: 0.1 }}
          className="flex gap-2 rounded-3xl overflow-hidden" style={{ height: 300 }}>
          {SPORTS_INFO.map(sport => {
            const color = getSportColor(sport.name);
            const img = SPORT_RATES[sport.name]?.image || sport.image;
            const isHov = hoveredSport === sport.name;
            return (
              <motion.div key={sport.name}
                className="relative cursor-pointer overflow-hidden sport-slice"
                style={{ flex: isHov ? "4 0 0" : "1 0 0", borderRadius: 20 }}
                onMouseEnter={() => setHoveredSport(sport.name)}
                onMouseLeave={() => setHoveredSport(null)}
                onClick={() => setSelectedSport(sport.name)}>
                <motion.img src={img} alt={sport.name} className="w-full h-full object-cover"
                  animate={{ scale: isHov ? 1.1 : 1.02 }} transition={{ duration: 0.65, ease: [0.25,0.46,0.45,0.94] }} />
                <motion.div className="absolute inset-0"
                  animate={{ background: isHov
                    ? `linear-gradient(to top,${color}ee 0%,${color}55 45%,rgba(0,0,0,0.1) 100%)`
                    : "linear-gradient(to top,rgba(0,0,0,0.82) 0%,rgba(0,0,0,0.25) 60%,transparent 100%)" }}
                  transition={{ duration: 0.4 }} />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <AnimatePresence mode="wait">
                    {isHov ? (
                      <motion.div key="exp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)" }}>
                            <SportIcon sport={sport.name} size={16} color="white" />
                          </div>
                          <p className="text-white font-black" style={{ fontSize: 17 }}>{sport.name}</p>
                        </div>
                        <p className="text-white font-black" style={{ fontSize: 21, marginBottom: 2 }}>
                          {SPORT_RATES[sport.name]?.rates[0]?.price || sport.priceLabel}
                        </p>
                        <p className="text-white/70" style={{ fontSize: 11 }}>{sport.courts}</p>
                        <div className="mt-3 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5"
                          style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.22)" }}>
                          <span className="text-white font-black" style={{ fontSize: 11 }}>View Rates & Book</span>
                          <ArrowRight size={11} className="text-white" />
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div key="col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <SportIcon sport={sport.name} size={13} color="rgba(255,255,255,0.8)" />
                          </div>
                          <p className="text-white font-black" style={{ fontSize: 11 }}>{sport.name}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* ── COMMUNITY CAROUSEL ── */}
      <section className="py-6" style={{ background: `${SURF2}88`, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.4 }}
          className="px-6 sm:px-8 mb-4 flex items-center gap-3"
        >
          <div className="w-1 h-5 rounded-full" style={{ background: ORANGE }} />
          <h3 style={{ fontSize: 16, fontWeight: 800 }}>Join the JRC Community</h3>
          <span style={{ color: TS, fontSize: 12 }}>· Click any photo to expand</span>
        </motion.div>
        <div className="relative overflow-hidden" style={{ height: 200 }}>
          <div className="absolute left-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(to right,${BG},transparent)` }} />
          <div className="absolute right-0 top-0 bottom-0 w-20 z-10 pointer-events-none" style={{ background: `linear-gradient(to left,${BG},transparent)` }} />
          <div className="flex marquee-track gap-3 px-3">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <motion.button key={i}
                whileHover={{ scale: 1.05, y: -5 }} whileTap={{ scale: 0.97 }}
                onClick={() => setLightboxIndex(i % MARQUEE_ITEMS.length)}
                className="flex-shrink-0 relative overflow-hidden rounded-2xl group"
                style={{ width: 280, height: 190 }}>
                <img src={item.src} alt={item.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top,rgba(0,0,0,0.65) 0%,transparent 55%)" }} />
                <div className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}>
                  <Maximize2 size={13} className="text-white" />
                </div>
                <span className="absolute bottom-3 left-3.5 text-white font-black" style={{ fontSize: 13 }}>{item.label}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ── COACH CTA ── */}
      <section className="px-6 sm:px-16 py-10 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl border"
          style={{ background: "linear-gradient(135deg,#080c18 0%,#0c1830 50%,#080e1c 100%)", borderColor: `${BLUE}28` }}>
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute w-72 h-72 rounded-full opacity-30" style={{ top: -80, right: -40, background: `radial-gradient(circle,${BLUE}66,transparent 70%)`, filter: "blur(50px)" }} />
            <div className="absolute w-48 h-48 rounded-full opacity-20" style={{ bottom: -40, left: 60, background: `radial-gradient(circle,${ORANGE}55,transparent 70%)`, filter: "blur(35px)" }} />
          </div>
          <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-4" style={{ background: `${BLUE}18`, borderColor: `${BLUE}38` }}>
                <Award size={11} style={{ color: "#60a5fa" }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: "#60a5fa", letterSpacing: 0.5 }}>COACHING OPPORTUNITY</span>
              </div>
              <h2 style={{ fontSize: "clamp(20px,3vw,32px)", fontWeight: 900, lineHeight: 1.15, marginBottom: 12, color: TP }}>
                Are You a Sports Expert?<br /><span style={{ color: "#60a5fa" }}>Become a JRC Coach.</span>
              </h2>
              <p style={{ color: TS, fontSize: 14, maxWidth: 460, lineHeight: 1.65 }}>
                Share your passion, train the next generation of athletes, and earn doing what you love.
              </p>
              <div className="flex flex-wrap gap-4 mt-5">
                {[{ icon: Clock, text: "Flexible schedule" }, { icon: Zap, text: "Competitive rates" }, { icon: Shield, text: "Pro facility" }, { icon: Users, text: "Grow your clientele" }].map(f => (
                  <div key={f.text} className="flex items-center gap-1.5">
                    <f.icon size={13} style={{ color: "#22c55e" }} />
                    <span style={{ color: TS, fontSize: 12 }}>{f.text}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-1"
                style={{ background: `linear-gradient(135deg,${BLUE},#1d4ed8)`, boxShadow: `0 12px 40px ${BLUE}55` }}>
                <GraduationCap size={38} className="text-white" />
              </div>
              <motion.button whileHover={{ scale: 1.04, boxShadow: `0 16px 40px ${BLUE}55` }} whileTap={{ scale: 0.97 }}
                onClick={() => onNavigate("coaching", "apply")}
                className="flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white"
                style={{ background: `linear-gradient(135deg,${BLUE},#1d4ed8)`, fontSize: 14, fontWeight: 800, boxShadow: `0 8px 24px ${BLUE}40`, whiteSpace: "nowrap" }}>
                Apply to be a Coach <ArrowRight size={15} />
              </motion.button>
              <p style={{ color: TS, fontSize: 11, textAlign: "center" }}>Free · Admin reviews within 24h</p>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Modals */}
      <SportRateModal sport={selectedSport} onClose={() => setSelectedSport(null)} onBook={() => { setSelectedSport(null); onNavigate("booking", "map"); }} />
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox images={MARQUEE_ITEMS} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}