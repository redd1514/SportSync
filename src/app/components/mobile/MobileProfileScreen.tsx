import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";
import {
  LogOut, User, CalendarDays, Trophy, ChevronRight, ChevronLeft, Shield, Bell,
  HelpCircle, Star, CheckCircle, Clock, XCircle,
  X, QrCode, RefreshCw, AlertTriangle, Download, Camera,
} from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { useCoaching } from "../../contexts/CoachingContext";
import { useUserAPI } from "../../hooks/useUserAPI";
import { useBookingAPI } from "../../hooks/useBookingAPI";
import { useRealtimeBookingAPI } from "../../hooks/useRealtimeAPI";
import { SportIcon, getSportColor } from "../SportIcons";
import { QRCodeSVG } from "qrcode.react";
import { BookingTicketModal } from "../shared/BookingTicketModal";
import { toast } from "sonner";
import { PhotoAvatar, PhotoCropperModal, loadProfilePhoto, saveProfilePhoto } from "../shared/ProfilePhotoPicker";
import { LoyaltyProgressBar } from "../shared/loyalty/LoyaltyProgressBar";
import { LoyaltyCelebrationModal } from "../shared/loyalty/LoyaltyCelebrationModal";
import { useLoyaltyMilestone } from "../../hooks/useLoyaltyMilestone";
import { getLoyaltyCelebrationsEnabled, setLoyaltyCelebrationsEnabled } from "../../utils/loyaltyPreferences";
import {
  LOYALTY_DISCOUNT_PERCENT,
  LOYALTY_REWARD_THRESHOLD,
  loyaltyPointsToNextReward,
  loyaltyRewardsAvailable,
} from "../../constants/loyalty";
import { getManilaDateKey, isManilaDateBefore } from "../../utils/manilaDate";

interface MobileProfileScreenProps {
  onLogout: () => void;
}

const statusConfig = {
  upcoming: { color: "#3b82f6", bg: "#3b82f620", label: "Upcoming", icon: Clock },
  pending: { color: "#FF8C00", bg: "#FF8C0020", label: "Pending", icon: Clock },
  pending_payment: { color: "#FF8C00", bg: "#FF8C0020", label: "Pending", icon: Clock },
  pending_verification: { color: "#eab308", bg: "#eab30820", label: "Review", icon: AlertTriangle },
  confirmed: { color: "#FF8C00", bg: "#FF8C0020", label: "Reserved", icon: Clock },
  checked_in: { color: "#22c55e", bg: "#22c55e20", label: "Ongoing", icon: CheckCircle },
  rescheduled: { color: "#3b82f6", bg: "#3b82f620", label: "Rescheduled", icon: RefreshCw },
  completed: { color: "#22c55e", bg: "#22c55e20", label: "Done", icon: CheckCircle },
  cancelled: { color: "#ef4444", bg: "#ef444420", label: "Cancelled", icon: XCircle },
};

const CANCEL_REASONS = [
  "Change of plans",
  "Schedule conflict",
  "Weather conditions",
  "Court not suitable",
  "Found a better time",
  "Medical / health reason",
  "Other",
];

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function playBuddyChime() {
  if (typeof window === "undefined") return;
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtor) return;

  try {
    const ctx = new AudioCtor();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + index * 0.075);
      gain.gain.setValueAtTime(0, now + index * 0.075);
      gain.gain.linearRampToValueAtTime(0.055, now + index * 0.075 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.075 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + index * 0.075);
      osc.stop(now + index * 0.075 + 0.2);
    });
    window.setTimeout(() => void ctx.close().catch(() => undefined), 520);
  } catch {
    /* Sound is a bonus; keep the interaction working if the browser blocks it. */
  }
}

function playBuddyTalkBlip(step: number) {
  if (typeof window === "undefined" || step % 3 !== 0) return;
  const AudioCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtor) return;

  try {
    const ctx = new AudioCtor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(420 + ((step % 7) * 38), ctx.currentTime);
    gain.gain.setValueAtTime(0.025, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
    window.setTimeout(() => void ctx.close().catch(() => undefined), 90);
  } catch {
    /* Browser may block very short speech blips. */
  }
}

function ProfileCourtBuddy({
  userName,
  loyaltyPoints,
  bookingCount,
  rewardsReady,
}: {
  userName: string;
  loyaltyPoints: number;
  bookingCount: number;
  rewardsReady: number;
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [isTalking, setIsTalking] = useState(false);
  const [isTypingText, setIsTypingText] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const hideTimerRef = useRef<number | null>(null);
  const firstName = userName.split(" ")[0] || "there";
  const pointsIntoReward = loyaltyPoints % LOYALTY_REWARD_THRESHOLD;
  const pointsNeeded = pointsIntoReward === 0 && loyaltyPoints > 0
    ? LOYALTY_REWARD_THRESHOLD
    : LOYALTY_REWARD_THRESHOLD - pointsIntoReward;
  const messages = [
    `Hi ${firstName}! Tap My Bookings before your visit so your QR ticket is ready.`,
    rewardsReady > 0
      ? `You have ${rewardsReady} loyalty reward${rewardsReady > 1 ? "s" : ""} ready. Nice shot.`
      : `${pointsNeeded} point${pointsNeeded === 1 ? "" : "s"} until your next discount.`,
    bookingCount > 0
      ? `You have ${bookingCount} booking${bookingCount === 1 ? "" : "s"} in your activity history.`
      : "Book your first court and I will cheer from here.",
    "Tip: completed bookings earn loyalty points after check-in and checkout.",
  ];
  useEffect(() => {
    if (!isTalking) return;
    const fullText = messages[messageIndex];
    let cursor = 0;
    setDisplayedText("");
    setIsTypingText(true);
    const interval = window.setInterval(() => {
      cursor += 1;
      setDisplayedText(fullText.slice(0, cursor));
      playBuddyTalkBlip(cursor);
      if (cursor >= fullText.length) {
        setIsTypingText(false);
        window.clearInterval(interval);
      }
    }, 32);
    return () => window.clearInterval(interval);
  }, [isTalking, messageIndex]);

  useEffect(() => () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
  }, []);

  const speak = () => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    setMessageIndex((current) => (current + 1) % messages.length);
    setIsTalking(true);
    playBuddyChime();
    hideTimerRef.current = window.setTimeout(() => setIsTalking(false), 7000);
  };

  return (
    <div className="pointer-events-none absolute -top-9 right-[calc(16.666%-40px)] h-24 w-24 z-20">
      <motion.div
        className="absolute inset-x-2 bottom-3 h-3 rounded-full bg-black/35 blur-sm"
        animate={{ opacity: [0.25, 0.55, 0.25] }}
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.button
        type="button"
        aria-label="Ask Court Buddy for a tip"
        onClick={speak}
        whileTap={{ scale: 0.94 }}
        className="pointer-events-auto absolute left-1/2 -translate-x-1/2 bottom-0 w-20 h-20 rounded-3xl focus:outline-none"
      >
        <motion.div
          className="absolute inset-x-2 bottom-0 h-3 rounded-full bg-black/35 blur-sm"
          animate={{ scaleX: [0.86, 1.08, 0.86], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
          <motion.div
            className="absolute left-2 top-1 w-16 h-16 rounded-full overflow-hidden shadow-xl shadow-black/30"
            style={{ background: "radial-gradient(circle at 32% 25%, #ffd08a 0 13%, #ff9f1c 28%, #e66b00 100%)" }}
          animate={{ y: [0, -5, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-y-0 left-1/2 w-0.5 bg-black/28 -translate-x-1/2" />
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-black/28 -translate-y-1/2" />
          <div className="absolute -left-5 top-1/2 w-12 h-12 rounded-full border-2 border-black/25 -translate-y-1/2" />
          <div className="absolute -right-5 top-1/2 w-12 h-12 rounded-full border-2 border-black/25 -translate-y-1/2" />
          <div className="absolute left-5 top-6 w-2 h-2 rounded-full bg-[#151515]" />
          <div className="absolute right-5 top-6 w-2 h-2 rounded-full bg-[#151515]" />
          <motion.div
            className="absolute left-1/2 top-9 h-1 rounded-full bg-[#151515] -translate-x-1/2"
            animate={{ width: isTypingText ? [9, 16, 9] : 10 }}
            transition={{ duration: 0.22, repeat: isTypingText ? Infinity : 0 }}
          />
        </motion.div>
        <motion.div className="absolute left-4 bottom-2 w-5 h-2 rounded-full bg-white/80" animate={{ y: [0, -1, 0] }} transition={{ duration: 2.4, repeat: Infinity }} />
        <motion.div className="absolute right-4 bottom-2 w-5 h-2 rounded-full bg-white/80" animate={{ y: [0, -1, 0] }} transition={{ duration: 2.4, repeat: Infinity, delay: 0.12 }} />
      </motion.button>



      <AnimatePresence mode="wait">
        {isTalking && (
          <motion.div
            key={messageIndex}
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            className="pointer-events-none absolute right-[-32px] bottom-[96px] w-[min(78vw,300px)] rounded-2xl bg-white text-[#171717] px-4 py-3 shadow-2xl shadow-black/30"
            style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.45 }}
          >
            <div className="absolute right-8 bottom-[-7px] w-3.5 h-3.5 bg-white rotate-45" />
            {displayedText}
            {isTypingText && (
              <motion.span
                className="inline-block w-1.5 h-4 ml-1 align-[-2px] rounded-full bg-[#171717]"
                animate={{ opacity: [0.15, 1, 0.15] }}
                transition={{ duration: 0.7, repeat: Infinity }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Mini inline calendar for reschedule ── */
function MiniCalendar({ selectedDate, onSelect, minDate }: { selectedDate: string; onSelect: (d: string) => void; minDate: string }) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) return new Date(selectedDate + "T00:00:00");
    return new Date();
  });
  const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
  const first = new Date(y, m, 1).getDay();
  const last = new Date(y, m + 1, 0).getDate();
  const days: (number | null)[] = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let i = 1; i <= last; i++) days.push(i);

  const selDay = selectedDate.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)
    ? parseInt(selectedDate.split("-")[2]) : null;
  const isDisabled = (d: number) => {
    const s = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return s < minDate;
  };
  const handleDay = (d: number) => {
    if (isDisabled(d)) return;
    onSelect(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  };

  return (
    <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setViewMonth(new Date(y, m - 1, 1))} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 text-gray-400"><ChevronLeft size={13} /></button>
        <span className="text-white font-black" style={{ fontSize: 12 }}>{monthNames[m]} {y}</span>
        <button onClick={() => setViewMonth(new Date(y, m + 1, 1))} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 text-gray-400"><ChevronRight size={13} /></button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayLabels.map(l => <div key={l} className="text-center text-gray-600 font-black" style={{ fontSize: 8 }}>{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const isSel = day === selDay;
          const isDis = isDisabled(day);
          return (
            <button key={day} disabled={isDis} onClick={() => handleDay(day)}
              className="aspect-square rounded-md flex items-center justify-center font-black disabled:opacity-20 disabled:cursor-not-allowed transition-all"
              style={{ fontSize: 10, background: isSel ? "#FF8C00" : "transparent", color: isSel ? "white" : "#aaa", border: `1px solid ${isSel ? "#FF8C00" : "transparent"}` }}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Cancel Dialog ── */
function CancelDialog({ booking, onClose, onConfirm }: {
  booking: { id: string; sport: string; court: string; date: string; time: string };
  onClose: () => void;
  onConfirm: (reason: string, note: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const fmt12 = (t: string) => { const h = parseInt(t); return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`; };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end"
      onClick={onClose}>
      <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="w-full rounded-t-3xl p-6 border-t border-white/10"
        style={{ background: '#1A1A1A', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-black" style={{ fontSize: 18 }}>Cancel Booking</h3>
            <p className="text-gray-500" style={{ fontSize: 12 }}>{booking.sport} · {booking.court} · {fmt12(booking.time)}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center"><X size={15} className="text-gray-400" /></button>
        </div>

        <div className="p-3 rounded-xl mb-4 flex items-start gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <AlertTriangle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300" style={{ fontSize: 12 }}>Cancellations are subject to our policy. A staff member will review your request within 24 hours.</p>
        </div>

        <p className="text-gray-400 font-black mb-3" style={{ fontSize: 12 }}>WHY ARE YOU CANCELLING?</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {CANCEL_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)}
              className="px-3 py-1.5 rounded-full font-black transition-all"
              style={{ fontSize: 12, background: reason === r ? 'rgba(255,140,0,0.2)' : 'rgba(255,255,255,0.06)', color: reason === r ? '#FF8C00' : '#777', border: `1px solid ${reason === r ? 'rgba(255,140,0,0.4)' : 'rgba(255,255,255,0.08)'}` }}>
              {r}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <p className="text-gray-500 mb-2" style={{ fontSize: 12 }}>Additional note (optional)</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="Any other details for our staff..."
            className="w-full rounded-xl px-4 py-3 text-white focus:outline-none resize-none"
            style={{ fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-black text-gray-400 border border-white/10" style={{ fontSize: 14 }}>Keep Booking</button>
          <button onClick={() => reason && onConfirm(reason, note)} disabled={!reason}
            className="flex-1 py-3 rounded-xl text-white font-black transition-all disabled:opacity-40"
            style={{ fontSize: 14, background: reason ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'rgba(220,38,38,0.3)' }}>
            Submit Request
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Reschedule Dialog ── */
function RescheduleDialog({ booking, onClose, onConfirm }: {
  booking: { id: string; sport: string; court: string; date: string; time: string; duration?: number; courtId?: string; court_id?: string };
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
}) {
  const { checkAvailability } = useBookingAPI();
  const todayStr = new Date().toISOString().split('T')[0];
  const [newDate, setNewDate] = useState(booking.date > todayStr ? booking.date : todayStr);
  const [newTime, setNewTime] = useState(booking.time);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parseInt(booking.time) >= 12 ? 'PM' : 'AM');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [checkingTimes, setCheckingTimes] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const amHours = [6, 7, 8, 9, 10, 11];
  const pmHours = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const hours = period === 'AM' ? amHours : pmHours;
  const fmt12 = (h: number) => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
  const durationHours = Math.max(1, Number(booking.duration || 1));
  const courtId = String(booking.courtId || booking.court_id || booking.court || '');
  const addHoursToTime = (time: string, hoursToAdd: number) => {
    const [h = 0, m = 0] = time.split(':').map(Number);
    return `${String(h + hoursToAdd).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  useEffect(() => {
    let active = true;
    const loadAvailableTimes = async () => {
      if (!newDate || !courtId) {
        setAvailableTimes([]);
        setAvailabilityError('Unable to verify this court. Please reschedule from My Bookings.');
        return;
      }

      setCheckingTimes(true);
      setAvailabilityError('');
      const allHours = [...amHours, ...pmHours].filter((h) => h + durationHours <= 23);
      try {
        const checked = await Promise.all(allHours.map(async (h) => {
          const start = `${String(h).padStart(2, '0')}:00`;
          const end = addHoursToTime(start, durationHours);
          const available = await checkAvailability(courtId, newDate, start, end, booking.id);
          return available ? start : null;
        }));
        if (!active) return;
        const next = checked.filter(Boolean) as string[];
        setAvailableTimes(next);
        if (newTime && !next.includes(newTime)) setAvailabilityError('That time is already booked or reserved.');
      } catch {
        if (active) {
          setAvailableTimes([]);
          setAvailabilityError('Unable to verify availability right now.');
        }
      } finally {
        if (active) setCheckingTimes(false);
      }
    };

    void loadAvailableTimes();
    return () => { active = false; };
  }, [newDate, courtId, durationHours, booking.id]);

  const selectedTimeAvailable = !!newTime && availableTimes.includes(newTime);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end"
      onClick={onClose}>
      <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="w-full rounded-t-3xl p-6 border-t border-white/10"
        style={{ background: '#1A1A1A', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-black" style={{ fontSize: 18 }}>Reschedule</h3>
            <p className="text-gray-500" style={{ fontSize: 12 }}>{booking.sport} · {booking.court}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center"><X size={15} className="text-gray-400" /></button>
        </div>

        <p className="text-gray-400 font-black mb-2" style={{ fontSize: 12 }}>PICK A NEW DATE</p>
        <MiniCalendar selectedDate={newDate} onSelect={setNewDate} minDate={todayStr} />

        <p className="text-gray-400 font-black mt-4 mb-2" style={{ fontSize: 12 }}>PICK A NEW START TIME</p>
        <div className="flex gap-1.5 p-1 rounded-xl mb-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {(['AM', 'PM'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className="flex-1 py-2 rounded-lg font-black transition-all"
              style={{ fontSize: 13, background: period === p ? '#FF8C00' : 'transparent', color: period === p ? 'white' : '#666' }}>
              {p === 'AM' ? '🌤 AM' : '🌙 PM'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {hours.map(h => {
            const tStr = `${String(h).padStart(2,'0')}:00`;
            const isSelected = tStr === newTime;
            const isAvailable = availableTimes.includes(tStr);
            return (
              <button key={h} onClick={() => isAvailable && setNewTime(tStr)} disabled={checkingTimes || !isAvailable}
                className="py-3 rounded-xl font-black transition-all disabled:cursor-not-allowed"
                style={{ fontSize: 15, background: isSelected ? '#FF8C00' : isAvailable ? 'rgba(255,255,255,0.06)' : 'rgba(239,68,68,0.08)', color: isSelected ? 'white' : isAvailable ? '#bbb' : '#7f1d1d', border: `1px solid ${isSelected ? '#FF8C00' : isAvailable ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.22)'}`, boxShadow: isSelected ? '0 4px 12px rgba(255,140,0,0.3)' : 'none', opacity: checkingTimes || !isAvailable ? 0.55 : 1 }}>
                {h % 12 || 12}
              </button>
            );
          })}
        </div>

        {(checkingTimes || availabilityError) && (
          <p className="text-center font-black mb-3" style={{ fontSize: 12, color: checkingTimes ? '#94a3b8' : '#f87171' }}>
            {checkingTimes ? 'Checking booked and reserved slots...' : availabilityError}
          </p>
        )}

        {newDate && newTime && (
          <p className="text-center font-black mb-4" style={{ fontSize: 13, color: '#FF8C00' }}>
            New slot: {new Date(newDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} at {fmt12(parseInt(newTime))} - {fmt12(parseInt(addHoursToTime(newTime, durationHours)))}
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-black text-gray-400 border border-white/10" style={{ fontSize: 14 }}>Cancel</button>
          <button onClick={() => selectedTimeAvailable && onConfirm(newDate, newTime)} disabled={!newDate || !newTime || checkingTimes || !selectedTimeAvailable}
            className="flex-1 py-3 rounded-xl text-white font-black transition-all disabled:opacity-40"
            style={{ fontSize: 14, background: 'linear-gradient(135deg,#FF8C00,#e67e00)' }}>
            Confirm Reschedule
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function MobileProfileScreen({ onLogout }: MobileProfileScreenProps) {
  const { user, bookings, logout, updateBooking, addCancellationRequest, updateUser } = useUser();
  const { bookings: liveUserBookings } = useRealtimeBookingAPI(user?.id || "", { autoFetch: true });
  const { findCoachByEmail } = useCoaching();
  const { getUserProfile, getUserLoyaltyPoints, updateUserProfile } = useUserAPI();
  const [activeTab, setActiveTab] = useState<"upcoming" | "pending" | "completed">("upcoming");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<typeof bookings[0] | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<typeof bookings[0] | null>(null);
  const [qrTarget, setQrTarget] = useState<any | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loyaltyData, setLoyaltyData] = useState<any>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(() => loadProfilePhoto(user?.id));
  const [profilePhotoSource, setProfilePhotoSource] = useState("");
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [accountName, setAccountName] = useState(user?.name || "");
  const [accountPhone, setAccountPhone] = useState(user?.phone || "");
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [celebrationsEnabled, setCelebrationsEnabled] = useState(() =>
    getLoyaltyCelebrationsEnabled(user?.id)
  );
  const { celebrationOpen, closeCelebration, rewardsUnlocked } = useLoyaltyMilestone(
    user?.id,
    user?.loyaltyPoints || 0
  );

  useEffect(() => {
    if (user?.id) setCelebrationsEnabled(getLoyaltyCelebrationsEnabled(user.id));
  }, [user?.id]);

  const isAdmin = user?.email === "admin@jrc.com";
  const coachProfile = user?.email ? findCoachByEmail(user.email) : undefined;
  const isCoachRole = !!coachProfile;
  const roleLabel = isCoachRole ? "COACH" : isAdmin ? "ADMIN" : "USER";
  const roleColor = isCoachRole ? "#2563EB" : isAdmin ? "#FFD700" : "#22c55e";

  // Fetch profile data from API on mount
  const loadProfileData = async () => {
    if (!user?.id) return;
    setIsLoadingProfile(true);
    try {
      const profile = await getUserProfile(user.id);
      setProfileData(profile);
      if (profile?.profile_picture_url && !loadProfilePhoto(user.id)) {
        saveProfilePhoto(user.id, profile.profile_picture_url);
        setProfilePhoto(profile.profile_picture_url);
      }
      const loyalty = await getUserLoyaltyPoints(user.id);
      setLoyaltyData(loyalty);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const fetchProfileOnMount = async () => {
    if (user?.id) {
      await loadProfileData();
    }
  };

  useEffect(() => {
    fetchProfileOnMount();
  }, [user?.id]);

  useEffect(() => {
    setProfilePhoto(loadProfilePhoto(user?.id));
    setAccountName(user?.name || "");
    setAccountPhone(user?.phone || "");
  }, [user?.id]);

  const userBookings = liveUserBookings.length > 0 ? liveUserBookings : bookings;

  const localPendingRequests = (() => {
    try {
      return JSON.parse(localStorage.getItem('jrc_localPendingRequests') || '[]');
    } catch {
      return [];
    }
  })();

  const [hiddenCompletedIds, setHiddenCompletedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('jrc_hiddenCompletedIds') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const refreshHiddenCompletedIds = () => {
      try {
        setHiddenCompletedIds(JSON.parse(localStorage.getItem('jrc_hiddenCompletedIds') || '[]'));
      } catch {
        setHiddenCompletedIds([]);
      }
    };
    window.addEventListener('storage', refreshHiddenCompletedIds);
    window.addEventListener('sportsync:hidden-completed-bookings-changed', refreshHiddenCompletedIds);
    window.addEventListener('focus', refreshHiddenCompletedIds);
    return () => {
      window.removeEventListener('storage', refreshHiddenCompletedIds);
      window.removeEventListener('sportsync:hidden-completed-bookings-changed', refreshHiddenCompletedIds);
      window.removeEventListener('focus', refreshHiddenCompletedIds);
    };
  }, []);

  const todayKey = getManilaDateKey();

  const filteredBookings = userBookings.filter((b) => {
    const isPastDate = isManilaDateBefore(b.date, todayKey);
    const isPendingReq = b.cancellationRequested || localPendingRequests.includes(b.id);
    
    if (activeTab === "upcoming") {
      if (b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected') return false;
      if (isPendingReq) return false;
      return true;
    } else if (activeTab === "pending") {
      if (b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected') return false;
      return isPendingReq;
    } else {
      if (hiddenCompletedIds.includes(b.id)) return false;
      return b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected';
    }
  });

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  const handlePhotoFile = (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setProfilePhotoSource(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleSaveProfilePhoto = async (dataUrl: string) => {
    setIsSavingPhoto(true);
    saveProfilePhoto(user?.id, dataUrl);
    setProfilePhoto(dataUrl);
    try {
      await updateUserProfile(user?.id || "", { profile_picture_url: dataUrl });
    } catch {
      /* The local preview is still saved for demo/offline accounts. */
    } finally {
      setIsSavingPhoto(false);
    }
  };

  const handleSaveAccount = async () => {
    if (!user?.id) return;
    const nextName = accountName.trim() || user.name;
    const nextPhone = accountPhone.trim();
    setIsSavingAccount(true);
    try {
      await updateUserProfile(user.id, { full_name: nextName, phone: nextPhone });
      updateUser(user.id, { name: nextName, phone: nextPhone });
      toast.success("Account info updated");
      setIsEditingAccount(false);
      setActiveModal(null);
    } catch (error) {
      console.error(error);
      toast.error("Could not update account info");
    } finally {
      setIsSavingAccount(false);
    }
  };

  if (!user) return null;

  return (
    <div className="h-full overflow-y-auto bg-[#111111] scrollbar-hide">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF8C00]/20 to-transparent" />
        <div className="relative px-5 pt-6 pb-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-white" style={{ fontSize: 22, fontWeight: 900 }}>Account & Activity</h2>
              <p className="text-gray-500" style={{ fontSize: 12 }}>Profile, bookings, rewards, and support</p>
            </div>
            <button
              onClick={() => setActiveModal("settings")}
              className="w-10 h-10 rounded-xl bg-[#1E1E1E] border border-white/10 flex items-center justify-center"
            >
              <User size={17} className="text-gray-400" />
            </button>
          </div>

          {/* User card */}
          <div className="flex items-center gap-4">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handlePhotoFile(event.target.files?.[0])}
            />
            <button type="button" className="relative cursor-pointer" onClick={() => photoInputRef.current?.click()}>
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-orange-500/20 border-2 border-white/10 hover:border-[#FF8C00]/60 transition-colors">
                <PhotoAvatar src={profilePhoto} name={user.name} size={64} rounded={16} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#FF8C00] flex items-center justify-center">
                <Camera size={10} className="text-white" />
              </div>
              {isAdmin && (
                <div className="absolute -top-1.5 -right-1.5 bg-[#FFD700] rounded-full p-1">
                  <Shield size={10} className="text-black" />
                </div>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-white font-black truncate" style={{ fontSize: 18 }}>{user.name}</h3>
                <motion.span
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="rounded-full px-2 py-0.5 flex-shrink-0"
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    backgroundColor: `${roleColor}20`,
                    color: roleColor,
                  }}
                >
                  {roleLabel}
                </motion.span>
              </div>
              <p className="text-gray-400" style={{ fontSize: 13 }}>{user.email}</p>
              <p className="text-gray-500" style={{ fontSize: 12, marginTop: 2 }}>
                Member since {new Date(user.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-5 mb-5 pt-12 relative">
        <ProfileCourtBuddy
          userName={user.name}
          loyaltyPoints={user.loyaltyPoints}
          bookingCount={userBookings.length}
          rewardsReady={loyaltyRewardsAvailable(user.loyaltyPoints)}
        />
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: CalendarDays, label: "Bookings", value: userBookings.length, color: "#FF8C00" },
            { icon: Trophy, label: "Points", value: user.loyaltyPoints, color: "#FFD700" },
            { icon: Star, label: "Sports", value: user.favoriteSports.length, color: "#0047AB" },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-[#1A1A1A] rounded-2xl p-3.5 border border-white/5 flex flex-col items-center gap-1"
            >
              <stat.icon size={19} style={{ color: stat.color }} />
              <span className="text-white font-black" style={{ fontSize: 22 }}>{stat.value}</span>
              <span className="text-gray-500" style={{ fontSize: 11 }}>{stat.label}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Loyalty Bar */}
      <div className="px-5 mb-5">
        <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-[#FFD700]" />
              <span className="text-white font-black" style={{ fontSize: 14 }}>Loyalty Rewards</span>
            </div>
            <span className="text-[#FFD700] font-black" style={{ fontSize: 13 }}>{user.loyaltyPoints}/10 pts</span>
          </div>
          <LoyaltyProgressBar points={user.loyaltyPoints} height={10} className="mb-2" />
          <p className="text-gray-500" style={{ fontSize: 12 }}>
            {loyaltyRewardsAvailable(user.loyaltyPoints) > 0
              ? `${loyaltyRewardsAvailable(user.loyaltyPoints)} reward ready — ${LOYALTY_DISCOUNT_PERCENT}% off court fees`
              : `${loyaltyPointsToNextReward(user.loyaltyPoints)} more completed booking(s) for ${LOYALTY_DISCOUNT_PERCENT}% off`}
          </p>
        </div>
      </div>

      {/* Booking History */}
      <div className="px-5 mb-5">
        <h3 className="text-white mb-3" style={{ fontSize: 16, fontWeight: 900 }}>Booking History</h3>

        {/* Tabs */}
        <div className="flex bg-[#1A1A1A] rounded-xl p-1 mb-4">
          {(["upcoming", "pending", "completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2.5 rounded-lg capitalize transition-all font-black"
              style={{
                fontSize: 13,
                backgroundColor: activeTab === tab ? "#FF8C00" : "transparent",
                color: activeTab === tab ? "white" : "#9ca3af",
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Booking list */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1 pb-10">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500" style={{ fontSize: 14 }}>
              No {activeTab} bookings yet
            </div>
          ) : (
            filteredBookings.map((booking) => {
              const normalizedStatus = booking.checkInStatus === 'checked_in' || booking.status === 'checked_in' ? 'checked_in' : booking.status;
              const isPendingReq = booking.cancellationRequested || localPendingRequests.includes(booking.id);
              const status = isPendingReq ? statusConfig.pending_verification : ((statusConfig as any)[normalizedStatus] || statusConfig.pending_payment);
              const StatusIcon = status.icon;
              const sportColor = getSportColor(booking.sport);
              const isUpcoming = ["confirmed", "pending", "pending_payment", "pending_verification", "rescheduled", "checked_in"].includes(normalizedStatus);
              const fmt12 = (t: string) => { const h = parseInt(t); return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`; };
              const pendingReq = (booking as any).pendingChangeRequest;
              const endH = parseInt(booking.time) + (booking.duration || 1);
              return (
                <motion.div
                  key={booking.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden"
                >
                  <div className="flex items-start gap-3 p-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${sportColor}15` }}>
                      <SportIcon sport={booking.sport} size={24} color={sportColor} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-white font-black" style={{ fontSize: 16 }}>{booking.sport}</p>
                        <span className="rounded-full px-2.5 py-1 flex items-center gap-1.5 flex-shrink-0"
                          style={{ fontSize: 11, fontWeight: 800, backgroundColor: status.bg, color: status.color }}>
                          <StatusIcon size={11} />{status.label}
                        </span>
                      </div>
                      <p className="text-gray-400" style={{ fontSize: 13 }}>{booking.court}</p>
                      <p className="text-gray-500" style={{ fontSize: 12 }}>
                        {new Date(booking.date + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}
                        {' · '}
                        {fmt12(booking.time)} – {fmt12(String(endH))}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        {booking.refCode && (
                          <p className="text-gray-600 font-black" style={{ fontSize: 11 }}>#{booking.refCode}</p>
                        )}
                        <p className="text-[#FF8C00] font-black ml-auto" style={{ fontSize: 15 }}>₱{booking.amount.toLocaleString()}</p>
                      </div>
                      {isPendingReq && pendingReq?.type === 'reschedule' && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <div className="rounded-xl border border-white/8 bg-black/20 p-2">
                            <p className="text-gray-500 font-black uppercase" style={{ fontSize: 8 }}>Before</p>
                            <p className="text-gray-300 font-black mt-0.5" style={{ fontSize: 10 }}>
                              {new Date(booking.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })} · {fmt12(booking.time)}
                            </p>
                          </div>
                          <div className="rounded-xl border border-yellow-400/20 bg-yellow-400/10 p-2">
                            <p className="text-yellow-200 font-black uppercase" style={{ fontSize: 8 }}>Requested</p>
                            <p className="text-white font-black mt-0.5" style={{ fontSize: 10 }}>
                              {pendingReq.requestedDate ? new Date(pendingReq.requestedDate + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : 'Date missing'} · {pendingReq.requestedStartTime ? fmt12(pendingReq.requestedStartTime) : 'Time missing'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons for confirmed/upcoming - QR TICKET ONLY; go to My Bookings for other actions */}
                  {isUpcoming && (
                    <div className="border-t border-white/5 flex items-center justify-between px-4 py-2.5 gap-2">
                      {booking.refCode ? (
                        <button onClick={() => setQrTarget(booking)}
                          className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-blue-400 bg-blue-500/10 hover:bg-blue-500/15 transition-all"
                          style={{ fontSize: 12, fontWeight: 700 }}>
                          <QrCode size={13} /> View QR Ticket
                        </button>
                      ) : <div />}
                      <p className="text-gray-600 italic text-right" style={{ fontSize: 10 }}>
                        Go to Facility Map → My Bookings to manage
                      </p>
                    </div>
                  )}
                  {booking.checkInStatus === 'checked_in' && (
                    <div className="flex items-center justify-center gap-1.5 py-2 border-t border-white/5"
                      style={{ background: 'rgba(34,197,94,0.06)' }}>
                      <CheckCircle size={12} className="text-green-400" />
                      <span className="text-green-400 font-black" style={{ fontSize: 11 }}>Checked In</span>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Account Menu */}
      <div className="px-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white" style={{ fontSize: 16, fontWeight: 900 }}>Account</h3>
        </div>
        <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
          {[
            { icon: Bell, label: "Notifications", color: "#0047AB", key: "notifications" },
            { icon: HelpCircle, label: "Help & Support", color: "#a855f7", key: "help" },
            { icon: Shield, label: "Privacy Policy", color: "#06b6d4", key: "privacy" },
          ].map((item, index) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => setActiveModal(item.key)}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/3 transition-all active:bg-white/5"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${item.color}20` }}
              >
                <item.icon size={16} style={{ color: item.color }} />
              </div>
              <span className="flex-1 text-left text-gray-300 font-bold" style={{ fontSize: 14 }}>
                {item.label}
              </span>
              <ChevronRight size={15} className="text-gray-600" />
            </motion.button>
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="px-5 pb-6">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl py-4"
          style={{ fontSize: 15, fontWeight: 800 }}
        >
          <LogOut size={17} />
          Sign Out
        </motion.button>
        <p className="text-center text-gray-600 mt-3" style={{ fontSize: 12 }}>
          JRC SportSync v1.0.0 · © 2026 JRC Ballpark
        </p>
      </div>

      {/* Logout Confirm Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm z-30 flex items-center justify-center px-6"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1A1A1A] rounded-3xl p-6 w-full border border-white/10"
            >
              <h3 className="text-white font-black text-center mb-2" style={{ fontSize: 20 }}>Sign Out?</h3>
              <p className="text-gray-400 text-center mb-6" style={{ fontSize: 14 }}>
                You'll need to sign back in to access your bookings and profile.
              </p>
              <div className="space-y-3">
                <button
                  onClick={handleLogout}
                  className="w-full bg-red-500 text-white font-black rounded-xl py-4"
                  style={{ fontSize: 15 }}
                >
                  Yes, Sign Out
                </button>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-full bg-[#252525] text-gray-300 font-black rounded-xl py-4"
                  style={{ fontSize: 15 }}
                >
                  Stay Logged In
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {activeModal === "settings" && (
          <SettingsModal title="Account Info" onClose={() => { setIsEditingAccount(false); setActiveModal(null); }}>
            <div className="space-y-4">
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: `${roleColor}10`, border: `1px solid ${roleColor}25` }}>
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: `${roleColor}18` }}>
                  {isCoachRole ? <Trophy size={18} style={{ color: roleColor }} /> : <User size={18} style={{ color: roleColor }} />}
                </div>
                <div>
                  <p className="text-white font-black" style={{ fontSize: 14 }}>{roleLabel === "COACH" ? "Coach account" : "User account"}</p>
                  <p className="text-gray-500" style={{ fontSize: 12 }}>{isCoachRole ? `${coachProfile?.sport || "Coach"} profile active` : "Standard JRC member access"}</p>
                </div>
              </div>
              <div>
                <label className="text-gray-500 block mb-1.5" style={{ fontSize: 12, fontWeight: 800 }}>Display Name</label>
                <input
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                  disabled={!isEditingAccount}
                  className="w-full bg-[#252525] rounded-xl px-4 py-3 border border-white/10 text-white font-black outline-none focus:border-[#FF8C00]/50 disabled:opacity-80"
                  style={{ fontSize: 14 }}
                />
              </div>
              <div>
                <label className="text-gray-500 block mb-1.5" style={{ fontSize: 12, fontWeight: 800 }}>Phone</label>
                <input
                  value={accountPhone}
                  onChange={(event) => setAccountPhone(event.target.value)}
                  disabled={!isEditingAccount}
                  className="w-full bg-[#252525] rounded-xl px-4 py-3 border border-white/10 text-white font-black outline-none focus:border-[#FF8C00]/50 disabled:opacity-80"
                  style={{ fontSize: 14 }}
                  placeholder="09XX XXX XXXX"
                />
              </div>
              <div>
                <label className="text-gray-500 block mb-1.5" style={{ fontSize: 12, fontWeight: 800 }}>Email</label>
                <div className="bg-[#202020] rounded-xl px-4 py-3 border border-white/8">
                  <p className="text-gray-300 font-black" style={{ fontSize: 14 }}>{user.email}</p>
                </div>
                <p className="text-gray-500 mt-1.5" style={{ fontSize: 11 }}>Email cannot be changed here. Please contact front desk support for email updates.</p>
              </div>
              {isEditingAccount ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setAccountName(user.name || "");
                      setAccountPhone(user.phone || "");
                      setIsEditingAccount(false);
                    }}
                    className="py-3.5 rounded-2xl text-gray-300 font-black"
                    style={{ background: "rgba(255,255,255,0.07)", fontSize: 14 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveAccount}
                    disabled={isSavingAccount}
                    className="py-3.5 rounded-2xl text-white font-black disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg,#FF8C00,#EA580C)", fontSize: 14 }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditingAccount(true)}
                  className="w-full py-3.5 rounded-2xl text-white font-black"
                  style={{ background: "linear-gradient(135deg,#FF8C00,#EA580C)", fontSize: 14 }}
                >
                  Edit Account Info
                </button>
              )}
            </div>
          </SettingsModal>
        )}
        {activeModal === "notifications" && (
          <SettingsModal title="Notifications" onClose={() => setActiveModal(null)}>
            <div className="space-y-3">
              {[
                { label: "Booking Reminders", desc: "1 hour before your session", enabled: true },
                { label: "Promotions & Deals", desc: "Weekly offers and discounts", enabled: false },
                {
                  label: "Loyalty level-up celebration",
                  desc: `Full-screen reward popup at ${LOYALTY_REWARD_THRESHOLD} points`,
                  enabled: celebrationsEnabled,
                  onToggle: user?.id
                    ? () => {
                        const next = !celebrationsEnabled;
                        setCelebrationsEnabled(next);
                        setLoyaltyCelebrationsEnabled(user.id, next);
                      }
                    : undefined,
                },
              ].map((notif) => (
                <button
                  key={notif.label}
                  type="button"
                  disabled={!("onToggle" in notif) || !notif.onToggle}
                  onClick={"onToggle" in notif ? notif.onToggle : undefined}
                  className="w-full flex items-center justify-between py-3 border-b border-white/5 text-left disabled:cursor-default"
                >
                  <div>
                    <p className="text-white font-black" style={{ fontSize: 14 }}>{notif.label}</p>
                    <p className="text-gray-500" style={{ fontSize: 12 }}>{notif.desc}</p>
                  </div>
                  <div
                    className="w-12 h-6 rounded-full flex items-center px-1 transition-all flex-shrink-0"
                    style={{ backgroundColor: notif.enabled ? "#FF8C00" : "#333" }}
                  >
                    <motion.div
                      className="w-4 h-4 bg-white rounded-full shadow transition-transform"
                      style={{ transform: notif.enabled ? "translateX(24px)" : "translateX(0)" }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </SettingsModal>
        )}
        {activeModal === "help" && (
          <SettingsModal title="Help & Support" onClose={() => setActiveModal(null)}>
            <div className="space-y-3">
              <div className="bg-[#252525] rounded-xl p-4 border border-white/5">
                <p className="text-white font-black mb-1" style={{ fontSize: 14 }}>Call Us</p>
                <p className="text-[#FF8C00] font-black" style={{ fontSize: 15 }}>0976 259 1190</p>
                <p className="text-gray-500" style={{ fontSize: 12 }}>Mon–Sun, 6AM–11PM</p>
              </div>
              <div className="bg-[#252525] rounded-xl p-4 border border-white/5">
                <p className="text-white font-black mb-1" style={{ fontSize: 14 }}>Email Us</p>
                <p className="text-[#0047AB] font-black" style={{ fontSize: 14 }}>contact@jrcsportsync.com</p>
              </div>
              <div className="bg-[#252525] rounded-xl p-4 border border-white/5">
                <p className="text-white font-black mb-1" style={{ fontSize: 14 }}>Visit Us</p>
                <p className="text-gray-400" style={{ fontSize: 13 }}>106 McArthur Hwy, Dalandanan, Valenzuela City</p>
              </div>
            </div>
          </SettingsModal>
        )}
        {activeModal === "privacy" && (
          <SettingsModal title="Privacy Policy" onClose={() => setActiveModal(null)}>
            <div className="space-y-3 text-gray-400" style={{ fontSize: 13 }}>
              <p>JRC SportSync collects minimal data to provide our booking service. Your data is never sold or shared with third parties.</p>
              <p>We store your booking history to help you manage your sessions and earn loyalty rewards.</p>
              <p>For questions about your data, contact us at <span className="text-[#FF8C00] font-black">contact@jrcsportsync.com</span>.</p>
              <p className="text-gray-600" style={{ fontSize: 12 }}>Last updated: March 2026</p>
            </div>
          </SettingsModal>
        )}
      </AnimatePresence>

      {/* Profile Photo Cropper */}
      <AnimatePresence>
        {profilePhotoSource && (
          <PhotoCropperModal
            source={profilePhotoSource}
            title="Profile Picture"
            accentColor="#FF8C00"
            saveLabel="Save Profile Picture"
            onClose={() => {
              setProfilePhotoSource("");
              if (photoInputRef.current) photoInputRef.current.value = "";
            }}
            onSave={async (dataUrl) => {
              await handleSaveProfilePhoto(dataUrl);
              if (photoInputRef.current) photoInputRef.current.value = "";
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(isSavingPhoto || isSavingAccount) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1001] bg-black/80 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="rounded-3xl px-8 py-7 border border-white/10 bg-[#181819] shadow-2xl">
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-6 h-6 rounded-full border-2"
                  style={{ borderColor: "rgba(255,140,0,0.25)", borderTopColor: "#FF8C00" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                />
                <p className="text-white font-black" style={{ fontSize: 14 }}>{isSavingAccount ? "Saving account info..." : "Saving profile picture..."}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cancel / Reschedule / QR dialogs */}
      <AnimatePresence>
        {cancelTarget && (
          <CancelDialog booking={cancelTarget} onClose={() => setCancelTarget(null)}
            onConfirm={(reason, note) => {
              addCancellationRequest({ id: `CR${Date.now()}`, bookingId: cancelTarget.id, customerId: user?.id || '', customerName: user?.name || '', sport: cancelTarget.sport, court: cancelTarget.court, date: cancelTarget.date, time: cancelTarget.time, reason: `${reason}${note ? ` — ${note}` : ''}`, status: 'pending', createdAt: new Date().toISOString() });
              setCancelTarget(null);
            }} />
        )}
        {rescheduleTarget && (
          <RescheduleDialog booking={rescheduleTarget} onClose={() => setRescheduleTarget(null)}
            onConfirm={(newDate, newTime) => {
              updateBooking(rescheduleTarget.id, { date: newDate, time: newTime });
              setRescheduleTarget(null);
            }} />
        )}
        {qrTarget && (
          <BookingTicketModal booking={qrTarget} onClose={() => setQrTarget(null)} />
        )}
      </AnimatePresence>

      <LoyaltyCelebrationModal
        open={celebrationOpen}
        onClose={closeCelebration}
        rewardsUnlocked={rewardsUnlocked}
      />
    </div>
  );
}

function SettingsModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[55] flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 300, opacity: 0.8, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 300, opacity: 0.8, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 border-t sm:border border-white/10"
        style={{ background: '#1A1A1A', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-white font-black" style={{ fontSize: 18 }}>{title}</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/8 flex items-center justify-center"><X size={15} className="text-gray-400" /></button>
        </div>

        {children}
      </motion.div>
    </motion.div>
  );
}
