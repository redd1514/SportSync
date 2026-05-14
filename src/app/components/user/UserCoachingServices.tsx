import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search, Clock, CalendarDays, CheckCircle, ChevronRight, ChevronLeft,
  X, Star, Filter, Users, Zap, Award,
} from "lucide-react";
import {
  format, startOfToday, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameDay, isSameMonth, isBefore, addMonths, subMonths,
} from "date-fns";
import { useCoaching, Coach, CoachingRequest } from "../../contexts/CoachingContext";
import { useUser } from "../../contexts/UserContext";
import { getSportColor, SportIcon } from "../SportIcons";
import { SectionLoader } from "../shared/LoadingScreen";

const DAY_MAP: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
};

/* ─── Calendar Picker ─────────────────────────────────────────────── */
function CalendarPicker({
  selectedDate,
  onSelect,
  availableDays,
}: {
  selectedDate: Date | null;
  onSelect: (d: Date) => void;
  availableDays: string[];
}) {
  const today = startOfToday();
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDate || today));
  const maxDate = addMonths(today, 3);

  const monthStart = viewMonth;
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const canGoPrev = isBefore(today, viewMonth);
  const canGoNext = isBefore(viewMonth, startOfMonth(maxDate));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          type="button"
          onClick={() => canGoPrev && setViewMonth(subMonths(viewMonth, 1))}
          disabled={!canGoPrev}
          className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center disabled:opacity-20 transition-all hover:bg-white/10"
        >
          <ChevronLeft size={15} className="text-white" />
        </button>
        <span className="text-white font-black" style={{ fontSize: 14 }}>
          {format(viewMonth, "MMMM yyyy")}
        </span>
        <button
          type="button"
          onClick={() => canGoNext && setViewMonth(addMonths(viewMonth, 1))}
          disabled={!canGoNext}
          className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center disabled:opacity-20 transition-all hover:bg-white/10"
        >
          <ChevronRight size={15} className="text-white" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1.5">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-gray-600 font-black" style={{ fontSize: 10, paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const isToday = isSameDay(day, today);
          const isPast = isBefore(day, today);

          const dayOfWeek = day.getDay();
          const isAvailableDay = availableDays.some(d => {
            if (DAY_MAP[d] !== undefined) return DAY_MAP[d] === dayOfWeek;
            let pd: Date;
            if (d.includes('-')) {
              const [y, m, dayOfMonth] = d.split('-').map(Number);
              pd = new Date(y, m - 1, dayOfMonth);
            } else {
              pd = new Date(d);
            }
            return !isNaN(pd.getTime()) && isSameDay(day, pd);
          });

          const isDisabled = isPast || !inMonth || !isAvailableDay;

          return (
            <motion.button
              key={day.toString()}
              type="button"
              whileTap={!isDisabled ? { scale: 0.88 } : {}}
              onClick={() => !isDisabled && onSelect(day)}
              disabled={isDisabled}
              className="aspect-square rounded-xl flex items-center justify-center transition-all"
              style={{
                fontSize: 12, fontWeight: 800,
                backgroundColor: isSelected ? "#F97316" : isToday ? "rgba(249,115,22,0.12)" : "transparent",
                color: isSelected ? "white" : isDisabled ? "#222" : isToday ? "#F97316" : "#e5e7eb",
                border: isToday && !isSelected ? "1px solid rgba(255,140,0,0.4)" : "1px solid transparent",
                cursor: isDisabled ? "default" : "pointer",
                opacity: !inMonth ? 0 : isDisabled ? 0.2 : 1,
                boxShadow: isSelected ? "0 4px 12px rgba(255,140,0,0.4)" : "none",
              }}
            >
              {format(day, "d")}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Time Slots ──────────────────────────────────────────────────── */
const parseTime = (t: string) => {
  const raw = String(t || "").trim();
  const match12 = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2] || "0", 10);
    const ampm = match12[3].toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return { h, m };
  }
  const match24 = raw.match(/^(\d{1,2})(?::(\d{2}))?/);
  if (match24) return { h: parseInt(match24[1], 10), m: parseInt(match24[2] || "0", 10) };
  return { h: 9, m: 0 };
};

const generateTimeSlots = (timeRange: string) => {
  try {
    const [start, end] = timeRange.split(" - ");
    if (!start || !end) return [];
    const s = parseTime(start);
    const e = parseTime(end);
    const slots = [];
    let curr = s.h * 60 + s.m;
    const endMins = e.h * 60 + e.m;
    while (curr < endMins) {
      const h = Math.floor(curr / 60);
      const m = curr % 60;
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      slots.push(`${h12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${ampm}`);
      curr += 60;
    }
    return slots;
  } catch (e) {
    return [];
  }
};

/* ─── Coaching Duration Picker ───────────────────────────────────── */
const fmt12 = (h: number) => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;

function CoachingDurationPicker({
  startTime,
  hourlyRate,
  accentColor,
  selectedDuration,
  onSelect,
}: {
  startTime: string;
  hourlyRate: number;
  accentColor: string;
  selectedDuration: number;
  onSelect: (dur: number, endH: number) => void;
}) {
  const { h: startH } = parseTime(startTime);
  const slots = Array.from({ length: 8 }, (_, i) => i + 1); // 1-8 hours

  return (
    <div className="space-y-2">
      {slots.map(dur => {
        const endH = startH + dur;
        const isSelected = selectedDuration === dur;
        const price = hourlyRate * dur;
        return (
          <motion.button
            key={dur}
            onClick={() => onSelect(dur, endH)}
            whileTap={{ scale: 0.98 }}
            layout
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all"
            style={{
              background: isSelected ? `${accentColor}15` : 'rgba(255,255,255,0.03)',
              borderColor: isSelected ? `${accentColor}60` : 'rgba(255,255,255,0.07)',
              boxShadow: isSelected ? `0 0 0 1px ${accentColor}30` : 'none',
            }}
          >
            <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
              style={{ borderColor: isSelected ? accentColor : '#444', background: isSelected ? accentColor : 'transparent' }}>
              {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
            </div>
            <div className="flex-1 text-left">
              <p className="text-white font-black" style={{ fontSize: 14 }}>{dur} hour{dur > 1 ? 's' : ''}</p>
              <p className="text-gray-500" style={{ fontSize: 11 }}>{fmt12(startH)} — {fmt12(endH)}</p>
            </div>
            <AnimatePresence mode="wait">
              <motion.span
                key={price}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="font-black"
                style={{ fontSize: 16, color: isSelected ? accentColor : '#555' }}
              >
                ₱{price.toLocaleString()}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ─── Star Rating ─────────────────────────────────────────────────── */
const DUMMY_RATINGS: Record<string, { rating: number; reviews: number; specialties: string[] }> = {
  c1: { rating: 4.9, reviews: 127, specialties: ["Shooting", "Defense", "Footwork"] },
  c2: { rating: 4.8, reviews: 94,  specialties: ["Spiking", "Serving", "Setting"] },
  c3: { rating: 4.7, reviews: 61,  specialties: ["Spin", "Loop Drive", "Rally"] },
  c4: { rating: 4.6, reviews: 48,  specialties: ["Ball Handling", "Dribbling", "Vision"] },
  c5: { rating: 4.5, reviews: 33,  specialties: ["Reception", "Serve", "Defense"] },
  c6: { rating: 4.8, reviews: 72,  specialties: ["Smash", "Footwork", "Net Play"] },
};

/* ─── Main Component ──────────────────────────────────────────────── */
export function UserCoachingServices({ onNavigate }: { onNavigate: (tab: any) => void }) {
  const { coaches, addRequest, setActiveRequestId, findCoachByEmail, updateRequestStatus, isLoading: coachesLoading } = useCoaching();
  const { user } = useUser();
  
  /* A user is a coach if they have a coach profile in the database */
  /* Coach profiles only exist after an admin approves a coach application */
  const myCoachProfile = user?.email ? findCoachByEmail(user.email) : null;
  const isAcceptedCoach = !!myCoachProfile;

  /* Filter state */
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  /* Profile/booking modal state */
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);

  /* Request form state */
  const [selectedDateObj, setSelectedDateObj] = useState<Date | null>(null);
  const [time, setTime] = useState("");
  const [durationHours, setDurationHours] = useState(1);
  const [message, setMessage] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdRequest, setCreatedRequest] = useState<CoachingRequest | null>(null);

  /* Derived sport list */
  const allSports = useMemo(() => {
    const sports = Array.from(new Set(coaches.map(c => c.sport))).sort();
    return ["All", ...sports];
  }, [coaches]);

  /* Filtered coaches */
  const filteredCoaches = useMemo(() => {
    return coaches.filter(coach => {
      if (selectedSport !== "All" && coach.sport !== selectedSport) return false;
      if (showAvailableOnly && !coach.isAvailable) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return coach.name.toLowerCase().includes(q) ||
          coach.sport.toLowerCase().includes(q) ||
          coach.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [coaches, selectedSport, showAvailableOnly, searchQuery, myCoachProfile]);

  const handleRequestSubmit = async () => {
    if (!selectedCoach || !selectedDateObj || !time) return;
    try {
      setIsRequesting(true);
      const dateStr = format(selectedDateObj, "yyyy-MM-dd");
      const requestId = await addRequest({
        userId: user?.id || "u1",
        userName: user?.name || "Current User",
        coachId: selectedCoach.id,
        coachName: selectedCoach.name,
        sport: selectedCoach.sport,
        requestedDate: dateStr,
        requestedTime: time,
        message,
        durationHours,
      });
      setActiveRequestId(requestId);
      setShowSuccess(true);
      
      setTimeout(() => {
        setShowSuccess(false);
        setIsRequesting(false);
        setSelectedCoach(null);
        onNavigate("my-coaching");
      }, 2000);
    } catch (error) {
      console.error('Error submitting request:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit coaching request');
      setIsRequesting(false);
    }
  };

  const coachMeta = (id: string) => DUMMY_RATINGS[id] || { rating: 4.5, reviews: 20, specialties: [] };

  if (coachesLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#131314]">
        <SectionLoader label="Loading coaches…" accentColor="#F97316" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#131314]" style={{ scrollbarWidth: 'none' }}>
      <div className="p-4 md:p-6 pb-24 md:pb-6 space-y-6">

        {/* Header */}
        <div>
          <h2 className="text-white font-black" style={{ fontSize: 24 }}>Coaching Services</h2>
          <p className="text-gray-500 mt-1" style={{ fontSize: 14 }}>
            Book expert coaches to elevate your game — {filteredCoaches.filter(c => c.isAvailable).length} available now
          </p>
        </div>

        {/* Search + Filter row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search coaches or sports..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white focus:outline-none text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <button
            onClick={() => setShowAvailableOnly(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-black transition-all flex-shrink-0"
            style={{
              fontSize: 12,
              background: showAvailableOnly ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
              border: showAvailableOnly ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.1)',
              color: showAvailableOnly ? '#22c55e' : '#888',
            }}
          >
            <Filter size={13} />
            Available
          </button>
        </div>

        {/* Sport filter tabs */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {allSports.map(sport => {
              const isActive = sport === selectedSport;
              const color = sport === "All" ? "#F97316" : getSportColor(sport);
              const count = sport === "All" ? coaches.length : coaches.filter(c => c.sport === sport).length;
              return (
                <motion.button
                  key={sport}
                  layout
                  onClick={() => setSelectedSport(sport)}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-2xl flex-shrink-0 font-black overflow-hidden"
                  style={{
                    fontSize: 13,
                    background: isActive ? `${color}18` : 'rgba(255,255,255,0.04)',
                    border: `1.5px solid ${isActive ? `${color}50` : 'rgba(255,255,255,0.08)'}`,
                    color: isActive ? color : '#666',
                    transition: 'all 0.2s ease',
                    boxShadow: isActive ? `0 4px 16px ${color}25` : 'none',
                  }}
                  whileTap={{ scale: 0.96 }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sportTabBg"
                      className="absolute inset-0 rounded-2xl"
                      style={{ background: `${color}10` }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  {sport !== "All" && (
                    <span className="relative z-10">
                      <SportIcon sport={sport} size={14} color={isActive ? color : '#555'} />
                    </span>
                  )}
                  <span className="relative z-10">{sport}</span>
                  <span
                    className="relative z-10 px-1.5 py-0.5 rounded-full font-black"
                    style={{
                      fontSize: 10,
                      background: isActive ? `${color}25` : 'rgba(255,255,255,0.07)',
                      color: isActive ? color : '#555',
                    }}
                  >
                    {count}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-gray-500 font-black" style={{ fontSize: 12 }}>
            {filteredCoaches.length} coach{filteredCoaches.length !== 1 ? 'es' : ''} found
          </p>
          {(selectedSport !== "All" || showAvailableOnly || searchQuery) && (
            <button
              onClick={() => { setSelectedSport("All"); setShowAvailableOnly(false); setSearchQuery(""); }}
              className="text-gray-500 hover:text-white transition-colors font-black flex items-center gap-1"
              style={{ fontSize: 11 }}
            >
              <X size={11} /> Clear filters
            </button>
          )}
        </div>

        {/* Coach Cards Grid */}
        <AnimatePresence mode="popLayout">
          {filteredCoaches.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-16 text-center"
            >
              <Users size={32} className="text-gray-700 mx-auto mb-3" />
              <p className="text-white font-black" style={{ fontSize: 15 }}>No coaches found</p>
              <p className="text-gray-500 mt-1" style={{ fontSize: 13 }}>Try adjusting your filters</p>
            </motion.div>
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCoaches.map((coach, idx) => {
                const color = getSportColor(coach.sport);
                const meta = coachMeta(coach.id);
                return (
                  <motion.div
                    key={coach.id}
                    layout
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ y: -3 }}
                    className="bg-[#1E1E1F] rounded-2xl border border-white/5 shadow-lg overflow-hidden flex flex-col group"
                    style={{ transition: 'box-shadow 0.2s' }}
                  >
                    {/* Image banner */}
                    <div className="relative h-32 overflow-hidden bg-[#1E1E1F]">
                      {coach.image ? (
                        <div className="absolute -inset-px overflow-hidden">
                          <img
                            src={coach.image}
                            alt={coach.name}
                            className="block w-full h-full object-cover"
                            style={{ backfaceVisibility: "hidden", transformOrigin: "center" }}
                          />
                        </div>
                      ) : (
                        <div className="absolute -inset-px flex items-center justify-center" style={{ background: `${color}15` }}>
                          <SportIcon sport={coach.sport} size={40} color={color} />
                        </div>
                      )}
                      <div className="absolute -inset-px bg-gradient-to-t from-[#1E1E1F] via-[#1E1E1F]/20 to-transparent" />

                      {/* Available badge */}
                      <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-sm ${
                        coach.isAvailable ? 'bg-green-500/20 border border-green-500/40' : 'bg-gray-700/50 border border-gray-600/40'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${coach.isAvailable ? 'bg-green-400' : 'bg-gray-500'}`} />
                        <span className={`font-black ${coach.isAvailable ? 'text-green-400' : 'text-gray-500'}`} style={{ fontSize: 10 }}>
                          {coach.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                      </div>

                      {/* Sport tag */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full backdrop-blur-sm"
                        style={{ background: `${color}25`, border: `1px solid ${color}40` }}>
                        <SportIcon sport={coach.sport} size={11} color={color} />
                        <span className="font-black" style={{ fontSize: 10, color }}>{coach.sport}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-white font-black" style={{ fontSize: 16 }}>{coach.name}</h3>
                        <div className="flex items-center gap-1">
                          <Star size={11} className="text-yellow-400" fill="currentColor" />
                          <span className="text-yellow-400 font-black" style={{ fontSize: 12 }}>{meta.rating}</span>
                          <span className="text-gray-600" style={{ fontSize: 10 }}>({meta.reviews})</span>
                        </div>
                      </div>

                      {/* Specialties */}
                      {meta.specialties.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mb-3">
                          {meta.specialties.slice(0, 3).map(spec => (
                            <span key={spec} className="px-2 py-0.5 rounded-lg font-black" style={{ fontSize: 10, background: `${color}15`, color, border: `1px solid ${color}25` }}>
                              {spec}
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-gray-500 line-clamp-2 mb-4 flex-1" style={{ fontSize: 12 }}>
                        {coach.description}
                      </p>

                      {/* Footer info */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                          <Clock size={11} className="text-gray-600" />
                          <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>
                            {coach.availableDays.slice(0, 2).map(d => d.slice(0, 3)).join(', ')}
                            {coach.availableDays.length > 2 ? ` +${coach.availableDays.length - 2}` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-white font-black" style={{ fontSize: 15 }}>
                            &#8369;{coach.hourlyRate.toLocaleString()}
                          </span>
                          <span className="text-gray-600" style={{ fontSize: 10 }}>/hr</span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedCoach(coach)}
                        className="w-full py-2.5 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2"
                        style={{
                          background: coach.isAvailable ? `${color}18` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${coach.isAvailable ? `${color}35` : 'rgba(255,255,255,0.08)'}`,
                          color: coach.isAvailable ? color : '#555',
                          fontSize: 13,
                        }}
                      >
                        View Profile
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Coach Profile Modal ── */}
      <AnimatePresence>
        {selectedCoach && !isRequesting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm p-0 md:p-4"
            onClick={e => e.target === e.currentTarget && setSelectedCoach(null)}
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-[#1E1E1F] w-full max-w-md rounded-t-3xl md:rounded-3xl overflow-hidden border border-white/10"
              style={{ maxHeight: '90vh', overflowY: 'auto', scrollbarWidth: 'none' }}
            >
              {/* Banner */}
              <div className="h-52 relative flex-shrink-0">
                {selectedCoach.image ? (
                  <img src={selectedCoach.image} alt={selectedCoach.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ background: `${getSportColor(selectedCoach.sport)}15` }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#1E1E1F] via-[#1E1E1F]/10 to-transparent" />
                <button
                  onClick={() => setSelectedCoach(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 pt-4">
                {/* Name + availability */}
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-white font-black" style={{ fontSize: 24 }}>{selectedCoach.name}</h3>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full ${selectedCoach.isAvailable ? 'bg-green-500/15 border border-green-500/30' : 'bg-gray-800 border border-gray-700'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${selectedCoach.isAvailable ? 'bg-green-400' : 'bg-gray-500'}`} />
                    <span className={`font-black text-xs ${selectedCoach.isAvailable ? 'text-green-400' : 'text-gray-500'}`}>
                      {selectedCoach.isAvailable ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <SportIcon sport={selectedCoach.sport} size={14} color={getSportColor(selectedCoach.sport)} />
                  <p className="font-black" style={{ fontSize: 14, color: getSportColor(selectedCoach.sport) }}>
                    {selectedCoach.sport} Coach
                  </p>
                  <div className="w-1 h-1 rounded-full bg-gray-600" />
                  <div className="flex items-center gap-1">
                    <Star size={11} className="text-yellow-400" fill="currentColor" />
                    <span className="text-yellow-400 font-black" style={{ fontSize: 12 }}>
                      {coachMeta(selectedCoach.id).rating}
                    </span>
                    <span className="text-gray-600" style={{ fontSize: 11 }}>
                      ({coachMeta(selectedCoach.id).reviews} reviews)
                    </span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-[#252525] p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-gray-500 font-black mb-1" style={{ fontSize: 9, letterSpacing: 0.5 }}>RATE</p>
                    <p className="text-white font-black" style={{ fontSize: 16 }}>
                      &#8369;{selectedCoach.hourlyRate.toLocaleString()}
                    </p>
                    <p className="text-gray-600" style={{ fontSize: 10 }}>/hr</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-gray-500 font-black mb-1" style={{ fontSize: 9, letterSpacing: 0.5 }}>DAYS</p>
                    <p className="text-white font-black" style={{ fontSize: 16 }}>{selectedCoach.availableDays.length}</p>
                    <p className="text-gray-600" style={{ fontSize: 10 }}>per week</p>
                  </div>
                  <div className="bg-[#252525] p-3 rounded-xl border border-white/5 text-center">
                    <p className="text-gray-500 font-black mb-1" style={{ fontSize: 9, letterSpacing: 0.5 }}>SESSIONS</p>
                    <p className="text-white font-black" style={{ fontSize: 16 }}>{coachMeta(selectedCoach.id).reviews}</p>
                    <p className="text-gray-600" style={{ fontSize: 10 }}>completed</p>
                  </div>
                </div>

                {/* Specialties */}
                {coachMeta(selectedCoach.id).specialties.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Award size={13} className="text-gray-500" />
                      <p className="text-gray-400 font-black" style={{ fontSize: 11, letterSpacing: 0.5 }}>SPECIALTIES</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {coachMeta(selectedCoach.id).specialties.map(spec => {
                        const color = getSportColor(selectedCoach.sport);
                        return (
                          <span key={spec} className="px-3 py-1 rounded-xl font-black" style={{ fontSize: 12, background: `${color}15`, color, border: `1px solid ${color}25` }}>
                            {spec}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Schedule */}
                <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <CalendarDays size={13} className="text-gray-500" />
                    <p className="text-gray-400 font-black" style={{ fontSize: 11 }}>SCHEDULE</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {selectedCoach.availableDays.map(d => (
                      <span key={d} className="px-2 py-0.5 rounded-lg font-black" style={{ fontSize: 10, background: 'rgba(255,255,255,0.08)', color: '#ccc' }}>
                        {typeof d === 'string' && !isNaN(Date.parse(d))
                          ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : d.slice(0, 3)}
                      </span>
                    ))}
                  </div>
                  <p className="text-gray-500" style={{ fontSize: 11 }}>{selectedCoach.timeRange}</p>
                </div>

                {/* About */}
                <div className="mb-6">
                  <p className="text-gray-400 font-black mb-2" style={{ fontSize: 11 }}>ABOUT</p>
                  <p className="text-gray-400 leading-relaxed" style={{ fontSize: 13 }}>{selectedCoach.description}</p>
                </div>

                <button
                  onClick={() => {
                    setSelectedDateObj(null);
                    setTime("");
                    setMessage("");
                    setIsRequesting(true);
                  }}
                  disabled={!selectedCoach.isAvailable || (myCoachProfile?.id === selectedCoach.id)}
                  className="w-full py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 transition-all"
                  style={{
                    fontSize: 15,
                    background: (selectedCoach.isAvailable && myCoachProfile?.id !== selectedCoach.id) ? `linear-gradient(135deg,${getSportColor(selectedCoach.sport)},${getSportColor(selectedCoach.sport)}cc)` : 'rgba(255,255,255,0.06)',
                    color: (selectedCoach.isAvailable && myCoachProfile?.id !== selectedCoach.id) ? 'white' : '#444',
                    cursor: (selectedCoach.isAvailable && myCoachProfile?.id !== selectedCoach.id) ? 'pointer' : 'not-allowed',
                    boxShadow: (selectedCoach.isAvailable && myCoachProfile?.id !== selectedCoach.id) ? `0 6px 24px ${getSportColor(selectedCoach.sport)}35` : 'none',
                  }}
                >
                  <Zap size={16} />
                  {myCoachProfile?.id === selectedCoach.id 
                    ? 'This is your profile' 
                    : selectedCoach.isAvailable 
                      ? 'Request a Session' 
                      : 'Currently Unavailable'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Request Form Modal ── */}
      <AnimatePresence>
        {isRequesting && selectedCoach && !createdRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-end md:items-center justify-center bg-black/85 backdrop-blur-sm p-0 md:p-4"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-[#1E1E1F] w-full max-w-md rounded-t-3xl md:rounded-3xl border border-white/10"
              style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            >
              {showSuccess ? (
                <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                  >
                    <div className="w-20 h-20 rounded-full bg-green-500/15 border-2 border-green-500 flex items-center justify-center">
                      <CheckCircle size={40} className="text-green-400" />
                    </div>
                  </motion.div>
                  <div className="text-center">
                    <h3 className="text-white font-black" style={{ fontSize: 22 }}>Request Sent!</h3>
                    <p className="text-gray-400 mt-2" style={{ fontSize: 14 }}>
                      Your session request has been sent to{" "}
                      <span className="text-white font-black">{selectedCoach.name}</span>.
                      <br />Your coach will review it first. If accepted, My Coaching will show the manual payment instructions and ticket.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Modal header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
                        {selectedCoach.image ? (
                          <img src={selectedCoach.image} alt={selectedCoach.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                            <SportIcon sport={selectedCoach.sport} size={16} color={getSportColor(selectedCoach.sport)} />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-black" style={{ fontSize: 15 }}>{selectedCoach.name}</p>
                        <p className="text-gray-500" style={{ fontSize: 11, color: getSportColor(selectedCoach.sport) }}>
                          {selectedCoach.sport} · &#8369;{selectedCoach.hourlyRate.toLocaleString()}/hr
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsRequesting(false)}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Scrollable body */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ scrollbarWidth: 'none' }}>
                    {/* Date */}
                    <div>
                      <label className="block text-gray-400 font-black mb-2" style={{ fontSize: 11, letterSpacing: 0.5 }}>SELECT DATE</label>
                      <div className="bg-[#131313] rounded-2xl p-4 border border-white/5">
                        <CalendarPicker
                          selectedDate={selectedDateObj}
                          onSelect={setSelectedDateObj}
                          availableDays={selectedCoach.availableDays}
                        />
                      </div>
                    </div>

                    {/* Time slots */}
                    {selectedDateObj && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <label className="block text-gray-400 font-black mb-2" style={{ fontSize: 11, letterSpacing: 0.5 }}>SELECT TIME</label>
                        <div className="grid grid-cols-3 gap-2">
                          {generateTimeSlots(selectedCoach.timeRange).map(slot => (
                            <motion.button
                              key={slot}
                              type="button"
                              onClick={() => setTime(slot)}
                              whileTap={{ scale: 0.95 }}
                              className="py-2.5 rounded-xl font-black transition-all"
                              style={{
                                fontSize: 13,
                                background: time === slot
                                  ? `${getSportColor(selectedCoach.sport)}`
                                  : 'rgba(255,255,255,0.05)',
                                color: time === slot ? 'white' : '#999',
                                border: `1.5px solid ${time === slot ? getSportColor(selectedCoach.sport) : 'rgba(255,255,255,0.07)'}`,
                                boxShadow: time === slot ? `0 4px 16px ${getSportColor(selectedCoach.sport)}40` : 'none',
                              }}
                            >
                              {slot}
                            </motion.button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Duration */}
                    {time && (
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex items-center gap-1.5 mb-3">
                          <ChevronRight size={12} style={{ color: getSportColor(selectedCoach.sport) }} />
                          <label className="text-gray-400 font-black" style={{ fontSize: 11, letterSpacing: 0.5 }}>
                            SESSION DURATION
                          </label>
                        </div>
                        <CoachingDurationPicker
                          startTime={time}
                          hourlyRate={selectedCoach.hourlyRate || 0}
                          accentColor={getSportColor(selectedCoach.sport)}
                          selectedDuration={durationHours}
                          onSelect={(dur, endH) => setDurationHours(dur)}
                        />
                      </motion.div>
                    )}

                    {/* Message */}
                    <div>
                      <label className="block text-gray-400 font-black mb-2" style={{ fontSize: 11, letterSpacing: 0.5 }}>
                        MESSAGE (OPTIONAL)
                      </label>
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="What do you want to focus on? Any specific goals?"
                        className="w-full text-white border rounded-xl px-4 py-3 focus:outline-none resize-none"
                        style={{
                          fontSize: 13,
                          background: 'rgba(255,255,255,0.04)',
                          border: `1px solid ${message ? `${getSportColor(selectedCoach.sport)}40` : 'rgba(255,255,255,0.08)'}`,
                          height: 88,
                        }}
                      />
                    </div>

                    <div className="rounded-2xl p-4 border" style={{ background: "rgba(37,99,235,0.08)", borderColor: "rgba(37,99,235,0.24)" }}>
                      <p className="text-blue-300 font-black mb-2" style={{ fontSize: 12 }}>How coaching payment works</p>
                      <div className="space-y-1.5" style={{ color: "#9CA0AD", fontSize: 12, lineHeight: 1.5 }}>
                        <p>1. Send this session request to the coach.</p>
                        <p>2. The coach accepts or declines based on availability.</p>
                        <p>3. If accepted, pay manually at the front desk or via the official JRC GCash QR on site.</p>
                        <p>4. Staff verifies payment, then your coaching ticket is used for check-in.</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-5 pb-5 pt-3 border-t border-white/8 flex-shrink-0">
                    <button
                      type="button"
                      onClick={handleRequestSubmit}
                      disabled={!selectedDateObj || !time}
                      className="w-full py-3.5 rounded-2xl font-black transition-all flex items-center justify-center gap-2"
                      style={{
                        fontSize: 15,
                        background: !selectedDateObj || !time
                          ? 'rgba(255,255,255,0.06)'
                          : `linear-gradient(135deg,${getSportColor(selectedCoach.sport)},${getSportColor(selectedCoach.sport)}cc)`,
                        color: !selectedDateObj || !time ? '#444' : 'white',
                        cursor: !selectedDateObj || !time ? 'not-allowed' : 'pointer',
                        boxShadow: selectedDateObj && time ? `0 6px 24px ${getSportColor(selectedCoach.sport)}30` : 'none',
                      }}
                    >
                      <Zap size={16} />
                      Send Coaching Request
                    </button>
                    <p className="text-center text-gray-500 mt-2" style={{ fontSize: 11 }}>
                      Payment is manual and only happens after the coach accepts.
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


    </div>
  );
}
