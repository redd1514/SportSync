import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";
import {
  LogOut, User, CalendarDays, Trophy, ChevronRight, ChevronLeft, Shield, Bell,
  HelpCircle, MapPin, Star, CheckCircle, Clock, XCircle, Settings,
  X, Phone, Mail, QrCode, RefreshCw, AlertTriangle,
} from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { SportIcon, getSportColor } from "../SportIcons";
import { QRCodeSVG } from "qrcode.react";

interface MobileProfileScreenProps {
  onLogout: () => void;
}

const statusConfig = {
  upcoming: { color: "#3b82f6", bg: "#3b82f620", label: "Upcoming", icon: Clock },
  confirmed: { color: "#FF8C00", bg: "#FF8C0020", label: "Confirmed", icon: CheckCircle },
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
  booking: { id: string; sport: string; court: string; date: string; time: string };
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
}) {
  const todayStr = new Date().toISOString().split('T')[0];
  const [newDate, setNewDate] = useState(booking.date > todayStr ? booking.date : todayStr);
  const [newTime, setNewTime] = useState(booking.time);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parseInt(booking.time) >= 12 ? 'PM' : 'AM');

  const amHours = [6, 7, 8, 9, 10, 11];
  const pmHours = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
  const hours = period === 'AM' ? amHours : pmHours;
  const fmt12 = (h: number) => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;

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
            return (
              <button key={h} onClick={() => setNewTime(tStr)}
                className="py-3 rounded-xl font-black transition-all"
                style={{ fontSize: 15, background: isSelected ? '#FF8C00' : 'rgba(255,255,255,0.06)', color: isSelected ? 'white' : '#bbb', border: `1px solid ${isSelected ? '#FF8C00' : 'rgba(255,255,255,0.08)'}`, boxShadow: isSelected ? '0 4px 12px rgba(255,140,0,0.3)' : 'none' }}>
                {h % 12 || 12}
              </button>
            );
          })}
        </div>

        {newDate && newTime && (
          <p className="text-center font-black mb-4" style={{ fontSize: 13, color: '#FF8C00' }}>
            New slot: {new Date(newDate + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })} at {fmt12(parseInt(newTime))}
          </p>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-black text-gray-400 border border-white/10" style={{ fontSize: 14 }}>Cancel</button>
          <button onClick={() => onConfirm(newDate, newTime)} disabled={!newDate || !newTime}
            className="flex-1 py-3 rounded-xl text-white font-black transition-all disabled:opacity-40"
            style={{ fontSize: 14, background: 'linear-gradient(135deg,#FF8C00,#e67e00)' }}>
            Confirm Reschedule
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── QR Ticket Viewer ── */
function QRTicketDialog({ booking, onClose }: {
  booking: { refCode?: string; sport: string; court: string; date: string; time: string; duration: number; amount: number };
  onClose: () => void;
}) {
  const fmt12 = (t: string) => { const h = parseInt(t); return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`; };
  const endH = parseInt(booking.time) + (booking.duration || 1);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.88, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.88, y: 24 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xs rounded-3xl overflow-hidden"
        style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="p-5 flex flex-col items-center gap-4">
          <div className="flex items-center justify-between w-full">
            <p className="text-white font-black" style={{ fontSize: 16 }}>Your QR Ticket</p>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center"><X size={14} className="text-gray-400" /></button>
          </div>
          <div className="bg-white rounded-2xl p-4 flex flex-col items-center gap-2">
            <QRCodeSVG value={JSON.stringify({ ref: booking.refCode, court: booking.court, date: booking.date })} size={160} level="H" />
          </div>
          <p className="font-black text-white tracking-widest" style={{ fontSize: 16 }}>{booking.refCode || 'NO CODE'}</p>
          <p className="text-gray-400 text-center" style={{ fontSize: 12 }}>Show this at the front desk to check in</p>
          <div className="w-full bg-[#111] rounded-xl p-3 space-y-1.5 border border-white/5">
            <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Sport</span><span className="text-white font-black" style={{ fontSize: 12 }}>{booking.sport}</span></div>
            <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Court</span><span className="text-white font-black" style={{ fontSize: 12 }}>{booking.court}</span></div>
            <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Date</span><span className="text-white font-black" style={{ fontSize: 12 }}>{new Date(booking.date + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
            <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Time</span><span className="text-white font-black" style={{ fontSize: 12 }}>{fmt12(booking.time)} – {fmt12(String(endH))}</span></div>
            <div className="flex justify-between border-t border-white/8 pt-1.5"><span className="text-gray-500" style={{ fontSize: 12 }}>Amount</span><span className="text-[#FF8C00] font-black" style={{ fontSize: 14 }}>₱{booking.amount.toLocaleString()}</span></div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function MobileProfileScreen({ onLogout }: MobileProfileScreenProps) {
  const { user, bookings, logout, updateBooking, addCancellationRequest } = useUser();
  const [activeTab, setActiveTab] = useState<"upcoming" | "completed">("upcoming");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<typeof bookings[0] | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<typeof bookings[0] | null>(null);
  const [qrTarget, setQrTarget] = useState<typeof bookings[0] | null>(null);

  const isAdmin = user?.email === "admin@jrc.com";

  const userBookings = bookings.filter(b => 
    b.customerName === user?.name || (b as any).userId === user?.id
  );

  const filteredBookings = userBookings.filter((b) =>
    activeTab === "upcoming"
      ? ["confirmed", "pending_payment", "pending_verification", "rescheduled"].includes(b.status)
      : (b.status === "completed" || b.status === "cancelled")
  );

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  if (!user) return null;

  return (
    <div className="h-full overflow-y-auto bg-[#111111] scrollbar-hide">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#FF8C00]/20 to-transparent" />
        <div className="relative px-5 pt-6 pb-5">
          <div className="flex items-start justify-between mb-5">
            <h2 className="text-white" style={{ fontSize: 22, fontWeight: 900 }}>Profile</h2>
            <button
              onClick={() => setActiveModal("settings")}
              className="w-10 h-10 rounded-xl bg-[#1E1E1E] border border-white/10 flex items-center justify-center"
            >
              <Settings size={17} className="text-gray-400" />
            </button>
          </div>

          {/* User card */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FF8C00] to-[#e67e00] flex items-center justify-center shadow-lg shadow-orange-500/30">
                <span className="text-white font-black" style={{ fontSize: 26 }}>
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              {isAdmin && (
                <div className="absolute -top-1.5 -right-1.5 bg-[#FFD700] rounded-full p-1">
                  <Shield size={10} className="text-black" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h3 className="text-white font-black" style={{ fontSize: 18 }}>{user.name}</h3>
                {isAdmin && (
                  <span
                    className="rounded-full px-2 py-0.5"
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      backgroundColor: "#FFD70020",
                      color: "#FFD700",
                    }}
                  >
                    ADMIN
                  </span>
                )}
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
      <div className="px-5 mb-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: CalendarDays, label: "Bookings", value: userBookings.length, color: "#FF8C00" },
            { icon: Trophy, label: "Points", value: user.loyaltyPoints, color: "#FFD700" },
            { icon: Star, label: "Sports", value: user.favoriteSports.length, color: "#0047AB" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#1A1A1A] rounded-2xl p-3.5 border border-white/5 flex flex-col items-center gap-1"
            >
              <stat.icon size={19} style={{ color: stat.color }} />
              <span className="text-white font-black" style={{ fontSize: 22 }}>{stat.value}</span>
              <span className="text-gray-500" style={{ fontSize: 11 }}>{stat.label}</span>
            </div>
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
          <div className="w-full h-2.5 bg-[#252525] rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((user.loyaltyPoints / 10) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-[#FFD700] to-[#FF8C00] rounded-full"
            />
          </div>
          <p className="text-gray-500" style={{ fontSize: 12 }}>
            {user.loyaltyPoints >= 10
              ? "You're eligible for a FREE booking!"
              : `${10 - user.loyaltyPoints} more bookings for a free session`}
          </p>
        </div>
      </div>

      {/* Booking History */}
      <div className="px-5 mb-5">
        <h3 className="text-white mb-3" style={{ fontSize: 16, fontWeight: 900 }}>Booking History</h3>

        {/* Tabs */}
        <div className="flex bg-[#1A1A1A] rounded-xl p-1 mb-4">
          {(["upcoming", "completed"] as const).map((tab) => (
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
        <div className="space-y-3">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-8 text-gray-500" style={{ fontSize: 14 }}>
              No {activeTab} bookings yet
            </div>
          ) : (
            filteredBookings.map((booking) => {
              const status = (statusConfig as any)[booking.status] || statusConfig.completed;
              const StatusIcon = status.icon;
              const sportColor = getSportColor(booking.sport);
              const isUpcoming = ["confirmed", "pending_payment", "pending_verification", "rescheduled"].includes(booking.status);
              const fmt12 = (t: string) => { const h = parseInt(t); return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`; };
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

      {/* Contact Info */}
      <div className="px-5 mb-5">
        <h3 className="text-white mb-3" style={{ fontSize: 16, fontWeight: 900 }}>Contact Info</h3>
        <div className="bg-[#1A1A1A] rounded-2xl p-4 border border-white/5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#FF8C00]/20 flex items-center justify-center flex-shrink-0">
              <Phone size={15} className="text-[#FF8C00]" />
            </div>
            <div>
              <p className="text-gray-500" style={{ fontSize: 11 }}>Phone</p>
              <p className="text-white font-black" style={{ fontSize: 14 }}>{user.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0047AB]/20 flex items-center justify-center flex-shrink-0">
              <Mail size={15} className="text-[#0047AB]" />
            </div>
            <div>
              <p className="text-gray-500" style={{ fontSize: 11 }}>Email</p>
              <p className="text-white font-black" style={{ fontSize: 14 }}>{user.email}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Menu */}
      <div className="px-5 mb-5">
        <h3 className="text-white mb-3" style={{ fontSize: 16, fontWeight: 900 }}>Account</h3>
        <div className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
          {[
            { icon: Bell, label: "Notifications", color: "#0047AB", key: "notifications" },
            { icon: MapPin, label: "Saved Locations", color: "#22c55e", key: "locations" },
            { icon: HelpCircle, label: "Help & Support", color: "#a855f7", key: "help" },
            { icon: Shield, label: "Privacy Policy", color: "#06b6d4", key: "privacy" },
          ].map((item) => (
            <button
              key={item.label}
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
            </button>
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
          <SettingsModal title="Account Settings" onClose={() => setActiveModal(null)}>
            <div className="space-y-3">
              <div>
                <label className="text-gray-500 block mb-1" style={{ fontSize: 12, fontWeight: 700 }}>Display Name</label>
                <div className="bg-[#252525] rounded-xl px-4 py-3 border border-white/10">
                  <p className="text-white font-black" style={{ fontSize: 14 }}>{user.name}</p>
                </div>
              </div>
              <div>
                <label className="text-gray-500 block mb-1" style={{ fontSize: 12, fontWeight: 700 }}>Email</label>
                <div className="bg-[#252525] rounded-xl px-4 py-3 border border-white/10">
                  <p className="text-white font-black" style={{ fontSize: 14 }}>{user.email}</p>
                </div>
              </div>
              <p className="text-gray-500 text-center pt-2" style={{ fontSize: 12 }}>
                Contact support to update your profile details.
              </p>
            </div>
          </SettingsModal>
        )}
        {activeModal === "notifications" && (
          <SettingsModal title="Notifications" onClose={() => setActiveModal(null)}>
            <div className="space-y-3">
              {[
                { label: "Booking Reminders", desc: "1 hour before your session", enabled: true },
                { label: "Promotions & Deals", desc: "Weekly offers and discounts", enabled: false },
                { label: "Loyalty Rewards", desc: "When you earn points", enabled: true },
              ].map((notif) => (
                <div key={notif.label} className="flex items-center justify-between py-3 border-b border-white/5">
                  <div>
                    <p className="text-white font-black" style={{ fontSize: 14 }}>{notif.label}</p>
                    <p className="text-gray-500" style={{ fontSize: 12 }}>{notif.desc}</p>
                  </div>
                  <div
                    className="w-12 h-6 rounded-full flex items-center px-1 transition-all"
                    style={{ backgroundColor: notif.enabled ? "#FF8C00" : "#333" }}
                  >
                    <div
                      className="w-4 h-4 bg-white rounded-full shadow transition-transform"
                      style={{ transform: notif.enabled ? "translateX(24px)" : "translateX(0)" }}
                    />
                  </div>
                </div>
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
        {activeModal === "locations" && (
          <SettingsModal title="Saved Locations" onClose={() => setActiveModal(null)}>
            <div className="space-y-3">
              <div className="bg-[#252525] rounded-xl p-4 border border-[#FF8C00]/20 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#FF8C00]/20 flex items-center justify-center">
                  <MapPin size={16} className="text-[#FF8C00]" />
                </div>
                <div>
                  <p className="text-white font-black" style={{ fontSize: 14 }}>JRC Ballpark Complex</p>
                  <p className="text-gray-500" style={{ fontSize: 12 }}>106 McArthur Hwy, Valenzuela City</p>
                </div>
                <CheckCircle size={16} className="text-green-400 ml-auto" />
              </div>
              <p className="text-gray-500 text-center" style={{ fontSize: 12 }}>Your default facility is set.</p>
            </div>
          </SettingsModal>
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
          <QRTicketDialog booking={qrTarget} onClose={() => setQrTarget(null)} />
        )}
      </AnimatePresence>
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
      className="absolute inset-0 bg-black/70 backdrop-blur-sm z-[55] flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 300 }}
        animate={{ y: 0 }}
        exit={{ y: 300 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        onClick={e => e.stopPropagation()}
        className="w-full rounded-t-3xl p-6 border-t border-white/10"
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