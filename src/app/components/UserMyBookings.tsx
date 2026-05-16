import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { resolveBookingTicketToken } from '../../shared/ticketRef';
import { BookingTicketModal } from './shared/BookingTicketModal';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, X, AlertCircle, CheckCircle, RefreshCw, Loader2, CreditCard, RotateCcw, Trash2, Filter, ChevronDown } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useBookingAPI } from '../hooks/useBookingAPI';
import { useRealtimeBookingAPI } from '../hooks/useRealtimeAPI';
import { ConnectionStatus } from './shared/ConnectionStatus';
import { SportIcon, getSportColor } from './SportIcons';
import { toast } from 'sonner';
import { CustomDateTimePicker } from './shared/CustomDateTimePicker';
import { formatManilaDateLabel, getManilaDateKey } from '../utils/manilaDate';
import {
  displayRefCode,
  formatTimeAMPM,
  isTerminalBookingStatus,
  isUpcomingBooking,
  mergeBookingRows,
  normalizeBookingForDisplay,
} from '../utils/bookingDisplay';

// Helper functions
const getSportFromCourtId = (courtId: string): string => {
  const courtMap: Record<string, string> = {
    'basketball1': 'Basketball', 'basketball2': 'Basketball',
    'volleyball1': 'Volleyball', 'volleyball2': 'Volleyball',
    'badminton1': 'Badminton', 'badminton2': 'Badminton', 'badminton3': 'Badminton',
    'pickleball1': 'Pickleball', 'pickleball2': 'Pickleball', 'pickleball3': 'Pickleball',
    'billiards1': 'Billiards', 'billiards2': 'Billiards', 'billiards3': 'Billiards', 'billiards4': 'Billiards',
    'tabletennnis1': 'Table Tennis', 'tabletennnis2': 'Table Tennis', 'tabletennnis3': 'Table Tennis', 'tabletennnis4': 'Table Tennis',
    'court1': 'Basketball', 'court2': 'Volleyball', 'court3': 'Badminton',
  };
  return courtMap[courtId.toLowerCase()] || 'Sports';
};

const calculateDuration = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startTotal = startHour * 60 + startMin;
  const endTotal = endHour * 60 + endMin;
  return Math.round((endTotal - startTotal) / 60);
};

function QrTicketModal({
  token,
  booking,
  onClose,
}: {
  token: string;
  booking: Record<string, unknown>;
  onClose: () => void;
}) {
  const displayToken = displayRefCode(token, booking.id);
  const color = getSportColor(String(booking.sport || 'Sports'));
  const ticketId = 'jrc-ticket-canvas';
  const qrValue = String(token || booking.refCode || booking.id || '');

  const downloadTicket = async () => {
    const ticketEl = document.getElementById(ticketId);
    if (!ticketEl) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(ticketEl, { scale: 3, backgroundColor: null, useCORS: true });
      const a = document.createElement('a');
      a.download = `${displayToken}-JRC-Ticket.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast.success('Ticket downloaded!');
    } catch {
      const svg = ticketEl.querySelector('svg');
      if (!svg) return;
      const svgData = new XMLSerializer().serializeToString(svg);
      const a = document.createElement('a');
      a.download = `${displayToken}-Ticket.svg`;
      a.href = 'data:image/svg+xml;base64,' + btoa(svgData);
      a.click();
      toast.success('QR downloaded!');
    }
  };

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      onClick={(e) => e.stopPropagation()}
      className="flex flex-col items-center gap-4 w-full max-w-xs"
    >
      <motion.div
        id={ticketId}
        className="w-full rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)]"
        style={{ background: '#111' }}
      >
        <div
          className="px-6 pt-6 pb-4"
          style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)`, borderBottom: `1px solid ${color}30` }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}
            >
              <SportIcon sport={String(booking.sport || 'Sports')} size={20} color={color} strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-white font-black" style={{ fontSize: 18 }}>{String(booking.sport || 'Court Booking')}</p>
              <p className="text-gray-400 font-medium" style={{ fontSize: 12 }}>{String(booking.court || 'Court')} · JRC Facility</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
            <span className="font-black uppercase" style={{ fontSize: 9, letterSpacing: 1, color }}>
              {String(booking.status || 'confirmed').toUpperCase()}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 space-y-3 border-b border-white/5">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5 }}>Date</span>
            <span className="text-white font-black" style={{ fontSize: 13 }}>
              {booking.date ? formatManilaDateLabel(booking.date) : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5 }}>Time</span>
            <span className="text-white font-black" style={{ fontSize: 13 }}>
              {booking.time ? `${formatTimeAMPM(booking.time)} · ${booking.duration || 1}hr` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5 }}>Amount</span>
            <span className="font-black" style={{ fontSize: 13, color: '#FF8C00' }}>
              ₱{Number(booking.amount ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        <div className="relative flex items-center px-0 py-0">
          <div className="w-6 h-6 rounded-full bg-black/95 -ml-3 flex-shrink-0" />
          <div className="flex-1 border-t-2 border-dashed border-white/10" />
          <div className="w-6 h-6 rounded-full bg-black/95 -mr-3 flex-shrink-0" />
        </div>

        <div className="px-6 pt-4 pb-6 flex flex-col items-center">
          <div className="p-3 bg-white rounded-2xl shadow-lg mb-3">
            <QRCodeSVG value={qrValue} size={140} />
          </div>
          <p className="text-gray-500 font-bold uppercase mb-1" style={{ fontSize: 9, letterSpacing: 1 }}>Show at front desk</p>
          <p className="text-white font-black" style={{ fontSize: 15, letterSpacing: 1 }}>{displayToken}</p>
        </div>

        <div className="px-6 py-3 text-center" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-gray-700 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 1.5 }}>JRC Sports Complex · Valenzuela City</p>
        </div>
      </motion.div>

      <div className="flex gap-3 w-full">
        <button
          onClick={downloadTicket}
          className="flex-1 bg-white text-black py-3.5 rounded-2xl font-black text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
        >
          Download Ticket
        </button>
        <button
          onClick={onClose}
          className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
        >
          <X size={20} />
        </button>
      </div>
    </motion.div>
  );
}

const FACILITY_OPEN_HOUR = 7;
const FACILITY_CLOSE_HOUR = 23;

const addHoursToTime = (time: string, hours: number): string => {
  const [h = 0, m = 0] = time.split(':').map(Number);
  const total = h * 60 + m + Math.round(hours * 60);
  const nextHour = Math.floor(total / 60);
  const nextMinute = total % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
};

function FilterMenu({
  value,
  options,
  onChange,
  accent = '#FF8C00',
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.value === value) || options[0];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((next) => !next)}
        className="h-9 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-white font-black outline-none flex items-center gap-2 min-w-[120px] justify-between"
        style={{ fontSize: 12 }}
      >
        <span>{selected?.label}</span>
        <ChevronDown size={13} style={{ color: accent }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="absolute left-0 top-full mt-2 z-40 min-w-full overflow-hidden rounded-xl border border-white/10 bg-[#121212] shadow-2xl"
          >
            {options.map((item) => {
              const active = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2.5 text-left font-black transition-colors hover:bg-white/8"
                  style={{ fontSize: 12, color: active ? accent : '#f5f5f5', background: active ? `${accent}18` : 'transparent' }}
                >
                  {item.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function UserMyBookings() {
  const { user } = useUser();
  const { loading, error: apiError, requestBookingCancellation, requestBookingReschedule, checkAvailability } = useBookingAPI();
  const { bookings, isConnected, fetchBookings } = useRealtimeBookingAPI(user?.id || '', {
    autoFetch: true,
  });
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [checkingTimes, setCheckingTimes] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localPendingRequests, setLocalPendingRequests] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('jrc_localPendingRequests') || '[]');
    } catch {
      return [];
    }
  });
  
  const [activeTab, setActiveTab] = useState<'upcoming' | 'pending' | 'past'>('upcoming');
  const [ticketBooking, setTicketBooking] = useState<any | null>(null);
  const [sportFilter, setSportFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'next7'>('all');
  const [dateSort, setDateSort] = useState<'newest' | 'oldest'>('newest');
  const [showClearModal, setShowClearModal] = useState(false);
  const [showClearCompletedModal, setShowClearCompletedModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hiddenCompletedIds, setHiddenCompletedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('jrc_hiddenCompletedIds') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('jrc_localPendingRequests', JSON.stringify(localPendingRequests));
  }, [localPendingRequests]);

  useEffect(() => {
    localStorage.setItem('jrc_hiddenCompletedIds', JSON.stringify(hiddenCompletedIds));
  }, [hiddenCompletedIds]);

  // Show ALL bookings (upcoming + past + cancelled) for history.

  const userBookings = React.useMemo(() => {
    const byId = new Map<string, ReturnType<typeof normalizeBookingForDisplay>>();
    const add = (raw: Record<string, unknown>) => {
      if (!raw?.id) return;
      const id = String(raw.id);
      const normalized = normalizeBookingForDisplay(raw);
      const merged = mergeBookingRows(byId.get(id), {
        ...normalized,
        court: normalized.court || String(raw.court || ''),
      });
      byId.set(id, merged);
    };
    (Array.isArray(contextBookings) ? contextBookings : []).forEach((b) => {
      if (!user?.id || !b.userId || b.userId === user.id) {
        add(b as unknown as Record<string, unknown>);
      }
    });
    (Array.isArray(bookings) ? bookings : []).forEach((b) => add(b as Record<string, unknown>));
    return Array.from(byId.values());
  }, [bookings]);

  const selectedBookingRecord = useMemo(
    () => userBookings.find((b) => b.id === selectedBooking) || null,
    [selectedBooking, userBookings]
  );

  const selectedBookingDuration = useMemo(() => {
    if (!selectedBookingRecord) return 1;
    const explicit = Number(selectedBookingRecord.duration);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    if (selectedBookingRecord.time && selectedBookingRecord.endTime) {
      return Math.max(1, calculateDuration(selectedBookingRecord.time, selectedBookingRecord.endTime));
    }
    return 1;
  }, [selectedBookingRecord]);

  useEffect(() => {
    let isMounted = true;
    const bookingCourtId = selectedBookingRecord?.courtId;
    if (!rescheduleDate || !selectedBooking || !bookingCourtId) {
      setAvailableTimes([]);
      return;
    }

    const fetchTimes = async () => {
      setCheckingTimes(true);
      const latestStartHour = FACILITY_CLOSE_HOUR - selectedBookingDuration;
      const startHours = Array.from(
        { length: Math.max(0, Math.floor(latestStartHour) - FACILITY_OPEN_HOUR + 1) },
        (_, i) => i + FACILITY_OPEN_HOUR
      );
      const promises = startHours.map(async hour => {
        const timeStr = `${String(hour).padStart(2, '0')}:00`;
        const endStr = addHoursToTime(timeStr, selectedBookingDuration);
        const isAvail = await checkAvailability(bookingCourtId, rescheduleDate, timeStr, endStr, selectedBooking);
        return isAvail ? timeStr : null;
      });

      const results = await Promise.all(promises);
      if (isMounted) {
        setAvailableTimes(results.filter((t): t is string => t !== null));
        setCheckingTimes(false);
      }
    };
    fetchTimes();

    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rescheduleDate, selectedBooking, selectedBookingDuration, selectedBookingRecord?.courtId]);

  
  const todayKey = getManilaDateKey();

  const allSports = useMemo(() => {
    return ['all', 'Basketball', 'Badminton', 'Volleyball', 'Pickleball', 'Table Tennis', 'Billiards'];
  }, []);

  const filterBySport = (arr: any[]) =>
    sportFilter === 'all' ? arr : arr.filter(b => b.sport === sportFilter);

  const applyDateControls = (arr: any[]) => {
    const todayKey = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekKey = nextWeek.toISOString().split('T')[0];

    return [...arr]
      .filter((b) => {
        if (dateFilter === 'today') return b.date === todayKey;
        if (dateFilter === 'next7') return b.date >= todayKey && b.date <= nextWeekKey;
        return true;
      })
      .sort((a, b) => {
        const at = new Date(`${a.date || '1970-01-01'}T${a.time || '00:00'}`).getTime();
        const bt = new Date(`${b.date || '1970-01-01'}T${b.time || '00:00'}`).getTime();
        return dateSort === 'newest' ? bt - at : at - bt;
      });
  };

  const filterVisibleBookings = (arr: any[]) => applyDateControls(filterBySport(arr));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    const latest = await fetchBookings();
    const stillPending = new Set(
      latest
        .filter((b: any) => b.cancellationRequested || b.cancellation_requested)
        .map((b: any) => String(b.id))
    );
    setLocalPendingRequests(prev => prev.filter(id => stillPending.has(String(id))));
    setIsRefreshing(false);
    toast.success('Bookings refreshed!');
  };

  const handleClearCompleted = () => {
    const ids = pastBookings.filter(b => b.status === 'completed').map((b: any) => b.id);
    setHiddenCompletedIds(prev => [...new Set([...prev, ...ids])]);
    setShowClearCompletedModal(false);
    toast.success(`Cleared ${ids.length} completed booking(s) from view.`);
  };

  const handleClearPendingRequests = () => {
    setLocalPendingRequests([]);
    setShowClearModal(false);
    toast.success('Local pending markers cleared.');
  };

  const upcomingBookings = userBookings.filter((b) => {
    const isPendingReq = b.cancellationRequested || localPendingRequests.includes(b.id);
    if (b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected') return false;
    if (isPendingReq) return false;
    return isUpcomingBooking(b, todayKey);
  });

  const pendingBookings = userBookings.filter((b) => {
    const isPendingReq = b.cancellationRequested || localPendingRequests.includes(b.id);
    if (isTerminalBookingStatus(b.status)) return false;
    return isPendingReq;
  });

  const pastBookings = userBookings.filter((b) => {
    if (hiddenCompletedIds.includes(b.id)) return false;
    const isPendingReq = b.cancellationRequested || localPendingRequests.includes(b.id);
    if (isPendingReq) return false;
    return !isUpcomingBooking(b, todayKey);
    return b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected';
  });

  const handleCancelRequest = async () => {
    if (!selectedBooking || !cancellationReason) return;
    setIsSubmitting(true);
    try {
      if (!user?.id) throw new Error('Please sign in again.');
      await requestBookingCancellation(selectedBooking, user.id, cancellationReason);
      const latest = await fetchBookings();
      const serverHasPending = latest.some((b: any) => String(b.id) === String(selectedBooking) && (b.cancellationRequested || b.cancellation_requested || b.pendingChangeRequest));
      if (!serverHasPending) setLocalPendingRequests(prev => [...prev, selectedBooking]);
      setShowCancelModal(false);
      setSelectedBooking(null);
      setCancellationReason('');
      
      toast.success('Cancellation request submitted! Admin will review your request.');
    } catch (e: any) {
      toast.error(`Failed to cancel: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedBooking || !rescheduleDate || !rescheduleTime) return;
    const requestedEnd = addHoursToTime(rescheduleTime, selectedBookingDuration);
    if (requestedEnd > `${FACILITY_CLOSE_HOUR}:00`) {
      toast.error(`This ${selectedBookingDuration}-hour booking would end after closing. Please choose an earlier time.`);
      return;
    }
    setIsSubmitting(true);
    try {
      if (!user?.id) throw new Error('Please sign in again.');
      await requestBookingReschedule(selectedBooking, user.id, rescheduleReason.trim() || 'No reason provided', rescheduleDate, rescheduleTime);

      const latest = await fetchBookings();
      const serverHasPending = latest.some((b: any) => String(b.id) === String(selectedBooking) && (b.cancellationRequested || b.cancellation_requested || b.pendingChangeRequest));
      if (!serverHasPending) setLocalPendingRequests(prev => [...prev, selectedBooking]);
      setShowRescheduleModal(false);
      setSelectedBooking(null);
      setRescheduleDate('');
      setRescheduleTime('');
      setRescheduleReason('');
      
      toast.success('Reschedule request submitted! Admin will review your request.');
    } catch (e: any) {
      toast.error(`Failed to reschedule: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const BookingGridSkeleton = ({ count = 6 }: { count?: number }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-[#141414] rounded-3xl border border-white/5 p-6 animate-pulse">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-white/8 rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="w-28 h-5 bg-white/8 rounded-lg" />
              <div className="w-40 h-3 bg-white/5 rounded" />
            </div>
            <div className="w-16 h-5 bg-white/5 rounded-full" />
          </div>
          <div className="flex gap-6">
            <div className="flex-1 space-y-4">
              {[0, 1, 2].map(j => (
                <div key={j} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-white/5 rounded-xl flex-shrink-0" />
                  <div className="space-y-1">
                    <div className="w-10 h-2 bg-white/5 rounded" />
                    <div className="w-24 h-4 bg-white/8 rounded" />
                  </div>
                </div>
              ))}
            </div>
            <div className="w-28 h-28 bg-white/5 rounded-2xl flex-shrink-0" />
          </div>
          <div className="border-t border-white/5 mt-5 pt-5 flex gap-3">
            <div className="flex-1 h-10 bg-white/5 rounded-xl" />
            <div className="flex-1 h-10 bg-white/5 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );

  const StatusBadge = ({ booking, pendingOverride = false }: { booking: any; pendingOverride?: boolean }) => {
    let label = 'PENDING';
    let bg = 'bg-gray-500/15';
    let text = 'text-gray-400';
    let border = 'border-gray-500/30';
    let dot = 'bg-gray-400';

    const isCheckedIn = booking.checkInStatus === 'checked_in' || booking.status === 'checked_in';

    if (pendingOverride) {
      label = 'PENDING';
      bg = 'bg-yellow-500/10';
      text = 'text-yellow-400';
      border = 'border-yellow-500/25';
      dot = 'bg-yellow-400';
    } else if (isCheckedIn) {
      label = 'ONGOING';
      bg = 'bg-emerald-500/10';
      text = 'text-emerald-400';
      border = 'border-emerald-500/20';
      dot = 'bg-emerald-400';
    } else if (booking.status === 'confirmed') {
      label = 'RESERVED';
      bg = 'bg-[#FF8C00]/10';
      text = 'text-[#FF8C00]';
      border = 'border-[#FF8C00]/20';
      dot = 'bg-[#FF8C00]';
    } else if (booking.status === 'pending_payment' || booking.status === 'pending') {
      label = 'PENDING';
      bg = 'bg-[#FF8C00]/10';
      text = 'text-[#FF8C00]';
      border = 'border-[#FF8C00]/20';
      dot = 'bg-[#FF8C00]';
    } else if (booking.status === 'pending_verification') {
      label = 'VERIFYING';
      bg = 'bg-yellow-500/10';
      text = 'text-yellow-400';
      border = 'border-yellow-500/20';
      dot = 'bg-yellow-400';
    } else if (booking.status === 'rescheduled') {
      label = 'RESCHEDULED';
      bg = 'bg-blue-500/10';
      text = 'text-blue-400';
      border = 'border-blue-500/20';
      dot = 'bg-blue-400';
    } else if (booking.status === 'completed') {
      label = 'COMPLETED';
      bg = 'bg-gray-500/10';
      text = 'text-gray-400';
      border = 'border-gray-500/20';
      dot = 'bg-gray-400';
    } else if (booking.status === 'cancelled') {
      label = 'CANCELLED';
      bg = 'bg-red-500/10';
      text = 'text-red-400';
      border = 'border-red-500/20';
      dot = 'bg-red-400';
    }

    return (
      <div className={`px-2.5 py-1 rounded-full border ${border} ${bg} flex items-center gap-1.5`}>
        <div className={`w-1.5 h-1.5 rounded-full ${dot} ${label === 'PENDING' ? 'animate-pulse' : ''}`} />
        <span className={`${text} font-black uppercase`} style={{ fontSize: 9, letterSpacing: 0.5 }}>{label}</span>
      </div>
    );
  };

  const formatTimeAMPM = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  const formatDateShort = (date: string) => (
    date?.includes('-') ? format(parseBookingDate(date), 'MMM d, yyyy') : date
  );

  const BookingCard = ({ booking }: { booking: any }) => {
    const color = getSportColor(booking.sport);
    const isPast = booking.status === 'completed' || booking.status === 'cancelled';
    const isPendingReq = booking.cancellationRequested || localPendingRequests.includes(booking.id) || !!booking.pendingChangeRequest;
    const canModify = !isPast && !isPendingReq && booking.status !== 'pending' && booking.status !== 'pending_verification' && booking.status !== 'checked_in';
    const pendingReq = booking.pendingChangeRequest;

    const { scanValue, displayCode } = resolveBookingTicketToken(booking.refCode, booking.id);

    return (
      <motion.div 
        whileHover={{ y: -4, borderColor: `${color}50` }}
        transition={{ duration: 0.2 }}
        className="bg-[#141414] rounded-3xl border border-white/5 overflow-hidden flex flex-col h-full relative min-w-0"
      >
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] opacity-20 pointer-events-none" style={{ backgroundColor: color, transform: 'translate(30%, -30%)' }} />
        
        <div className="p-5 sm:p-6 flex flex-col flex-1 relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner border border-white/5"
                style={{ backgroundColor: `${color}15` }}
              >
                <SportIcon sport={booking.sport} size={24} color={color} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="text-white font-black leading-tight" style={{ fontSize: 18 }}>
                  {booking.sport}
                </h3>
                <p className="text-gray-400 font-medium" style={{ fontSize: 13 }}>
                  {booking.court} • JRC Facility
                </p>
              </div>
            </div>
            <StatusBadge booking={booking} pendingOverride={isPendingReq} />
          </div>

          <div className="flex flex-col sm:flex-row gap-6 mb-6 flex-1">
            <div className="space-y-4 flex-1">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                  <Calendar size={14} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-500 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5 }}>Date</p>
                  <p className="text-gray-200 font-black" style={{ fontSize: 13 }}>
                    {formatManilaDateLabel(booking.date)}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                  <Clock size={14} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-500 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5 }}>Time</p>
                  <p className="text-gray-200 font-black" style={{ fontSize: 13 }}>
                    {formatTimeAMPM(booking.time)} · {booking.duration} hr
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/5">
                  <CreditCard size={14} className="text-gray-400" />
                </div>
                <div>
                  <p className="text-gray-500 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5 }}>Amount</p>
                  <p className="text-[#FF8C00] font-black" style={{ fontSize: 14 }}>
                    ₱{booking.amount?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </div>

            {/* QR Code Section */}
            {scanValue && (
              <div 
                className="flex flex-col items-center justify-center bg-black/30 rounded-2xl p-4 border border-white/5 sm:w-36 flex-shrink-0 h-fit self-center sm:self-start mt-2 sm:mt-0 relative z-20 cursor-pointer hover:bg-black/40 transition-colors"
                onClick={() => setTicketBooking(booking)}
                title="Click to view full screen QR"
              >
                <div className="p-2 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] mb-3 relative group">
                  <QRCodeSVG value={scanValue} size={72} level="H" />
                  <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-[10px] font-black">VIEW</span>
                  </div>
                </div>
                <div className="w-full text-center max-w-[110px] overflow-hidden">
                  <p className="text-gray-400 font-black truncate px-1" style={{ fontSize: 10, letterSpacing: 0.5 }}>{displayCode}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-white/5 pt-5">
            {isPendingReq && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-yellow-400 flex-shrink-0" />
                  <p className="text-yellow-400 font-bold" style={{ fontSize: 11 }}>
                    {pendingReq?.type === 'reschedule' ? 'Reschedule request pending review' : 'Change request pending review by Admin'}
                  </p>
                </div>
                {pendingReq?.type === 'reschedule' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                    <div className="rounded-lg border border-white/8 bg-black/20 p-2.5">
                      <p className="text-gray-500 font-black uppercase" style={{ fontSize: 8 }}>Before</p>
                      <p className="text-gray-200 font-black mt-1" style={{ fontSize: 11 }}>
                        {formatDateShort(booking.date)} · {formatTimeAMPM(booking.time)}
                      </p>
                    </div>
                    <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-2.5">
                      <p className="text-yellow-200 font-black uppercase" style={{ fontSize: 8 }}>Requested</p>
                      <p className="text-white font-black mt-1" style={{ fontSize: 11 }}>
                        {pendingReq.requestedDate ? formatDateShort(pendingReq.requestedDate) : 'Date missing'} · {pendingReq.requestedStartTime ? formatTimeAMPM(pendingReq.requestedStartTime) : 'Time missing'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {canModify && (
              <div className="flex gap-3 relative z-30 pointer-events-auto mt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedBooking(booking.id);
                    setShowRescheduleModal(true);
                  }}
                  className="flex-1 bg-[#0047AB]/10 border border-[#0047AB]/30 text-[#0047AB] py-3 rounded-xl hover:bg-[#0047AB]/20 transition-all font-black flex items-center justify-center cursor-pointer relative z-40"
                  style={{ fontSize: 12 }}
                >
                  <RefreshCw size={14} className="mr-1.5" />
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedBooking(booking.id);
                    setShowCancelModal(true);
                  }}
                  className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 py-3 rounded-xl hover:bg-red-500/20 transition-all font-black flex items-center justify-center cursor-pointer relative z-40"
                  style={{ fontSize: 12 }}
                >
                  <X size={14} className="mr-1.5" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-full bg-[#0D0D0D] p-4 md:p-8 pb-8 md:pb-10">
      <div className="max-w-[1600px] mx-auto w-full">
        {/* Header */}
        <div className="mb-6 flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-white mb-1" style={{ fontSize: 28, fontWeight: 900 }}>
              My Bookings
            </h1>
            <p className="text-gray-500" style={{ fontSize: 14 }}>
              View and manage your court reservations ({userBookings.length} bookings)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ConnectionStatus isConnected={isConnected} showLabel={true} size="md" />
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 bg-white/5 border border-white/10 text-gray-300 px-4 py-2 rounded-xl hover:bg-white/10 transition-colors font-black disabled:opacity-50"
              style={{ fontSize: 13 }}
            >
              <RotateCcw size={14} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </motion.button>
            {localPendingRequests.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setShowClearModal(true)}
                className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl hover:bg-red-500/20 transition-colors font-black"
                style={{ fontSize: 13 }}
              >
                <Trash2 size={14} />
                Clear Local
              </motion.button>
            )}
          </div>
        </div>
        {apiError && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-300 text-sm">
            Booking sync warning: {apiError}
          </div>
        )}

        {/* Sport/date filter controls */}
        {allSports.length > 1 && (
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#151515] px-3 py-3 shadow-[0_14px_35px_rgba(0,0,0,0.18)]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <Filter size={14} className="text-[#FF8C00] flex-shrink-0" />
                <span className="text-gray-400 font-black uppercase" style={{ fontSize: 10 }}>Filters</span>
              </div>
              <FilterMenu
                value={sportFilter}
                options={allSports.map((sport) => ({ value: sport, label: sport === 'all' ? 'All Sports' : sport }))}
                onChange={setSportFilter}
              />
              {[
                { id: 'all' as const, label: 'All Dates' },
                { id: 'today' as const, label: 'Today' },
                { id: 'next7' as const, label: 'Next 7 Days' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateFilter(item.id)}
                  className={`h-9 px-3 rounded-xl font-black border transition-colors ${
                    dateFilter === item.id
                      ? 'bg-blue-500/15 border-blue-500/35 text-blue-200'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}
                  style={{ fontSize: 12 }}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDateSort(prev => prev === 'newest' ? 'oldest' : 'newest')}
                className="h-9 px-3 rounded-xl font-black border bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
                style={{ fontSize: 12 }}
              >
                Sort: {dateSort === 'newest' ? 'Newest first' : 'Oldest first'}
              </button>
            </div>
          </div>
        )}
        {(isRefreshing || loading) ? (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[0,1,2].map(i => (
                <div key={i} className="bg-[#1A1A1A] rounded-2xl p-5 border border-white/5 animate-pulse">
                  <div className="w-6 h-6 bg-white/8 rounded-xl mb-3" />
                  <div className="w-10 h-7 bg-white/8 rounded-lg mb-2" />
                  <div className="w-16 h-3 bg-white/5 rounded" />
                </div>
              ))}
            </div>
            <BookingGridSkeleton />
          </div>
        ) : userBookings.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-black mb-2" style={{ fontSize: 18 }}>
              No bookings yet
            </h3>
            <p className="text-gray-500" style={{ fontSize: 14 }}>
              Start by booking a court to see your reservations here
            </p>
          </div>
        ) : (
          <>
            {/* Tabs & Summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
              <button 
                onClick={() => setActiveTab('upcoming')}
                className={`rounded-2xl p-3 sm:p-5 border flex flex-col items-center sm:items-start text-center sm:text-left transition-all ${activeTab === 'upcoming' ? 'bg-[#FF8C00]/10 border-[#FF8C00]/30 shadow-[0_0_20px_rgba(255,140,0,0.1)]' : 'bg-[#1A1A1A] border-white/5 hover:bg-white/5'}`}
              >
                <Calendar size={20} className={`${activeTab === 'upcoming' ? 'text-[#FF8C00]' : 'text-gray-500'} mb-1 sm:mb-2 transition-colors`} />
                <p className="text-white font-black" style={{ fontSize: 20 }}>
                  {upcomingBookings.length}
                </p>
                <p className={`${activeTab === 'upcoming' ? 'text-[#FF8C00]' : 'text-gray-400'} transition-colors`} style={{ fontSize: 11 }}>Upcoming</p>
              </button>

              <button 
                onClick={() => setActiveTab('pending')}
                className={`rounded-2xl p-3 sm:p-5 border flex flex-col items-center sm:items-start text-center sm:text-left transition-all ${activeTab === 'pending' ? 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.1)]' : 'bg-[#1A1A1A] border-white/5 hover:bg-white/5'}`}
              >
                <AlertCircle size={20} className={`${activeTab === 'pending' ? 'text-yellow-400' : 'text-gray-500'} mb-1 sm:mb-2 transition-colors`} />
                <p className="text-white font-black" style={{ fontSize: 20 }}>
                  {pendingBookings.length}
                </p>
                <p className={`${activeTab === 'pending' ? 'text-yellow-400' : 'text-gray-400'} transition-colors`} style={{ fontSize: 11 }}>Pending / Review</p>
              </button>

              <button 
                onClick={() => setActiveTab('past')}
                className={`rounded-2xl p-3 sm:p-5 border flex flex-col items-center sm:items-start text-center sm:text-left transition-all ${activeTab === 'past' ? 'bg-gray-500/20 border-gray-500/40 shadow-[0_0_20px_rgba(107,114,128,0.1)]' : 'bg-[#1A1A1A] border-white/5 hover:bg-white/5'}`}
              >
                <CheckCircle size={20} className={`${activeTab === 'past' ? 'text-gray-300' : 'text-gray-500'} mb-1 sm:mb-2 transition-colors`} />
                <p className="text-white font-black" style={{ fontSize: 20 }}>
                  {pastBookings.length}
                </p>
                <p className={`${activeTab === 'past' ? 'text-gray-300' : 'text-gray-400'} transition-colors`} style={{ fontSize: 11 }}>Completed / Cancelled</p>
              </button>
            </div>

            {/* Clear completed row */}
            {activeTab === 'past' && pastBookings.some(b => b.status === 'completed') && (
              <div className="flex justify-end mb-4">
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => setShowClearCompletedModal(true)}
                  className="flex items-center gap-2 bg-gray-500/10 border border-gray-500/20 text-gray-400 px-4 py-2 rounded-xl hover:bg-gray-500/20 transition-colors font-black"
                  style={{ fontSize: 12 }}
                >
                  <Trash2 size={13} />
                  Clear Completed
                </motion.button>
              </div>
            )}

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + sportFilter}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5"
              >
                {activeTab === 'upcoming' && (
                  filterVisibleBookings(upcomingBookings).length > 0 ? (
                    filterVisibleBookings(upcomingBookings).map(booking => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <Calendar size={36} className="text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No upcoming bookings</p>
                    </div>
                  )
                )}

                {activeTab === 'pending' && (
                  filterVisibleBookings(pendingBookings).length > 0 ? (
                    filterVisibleBookings(pendingBookings).map(booking => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <AlertCircle size={36} className="text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No pending requests</p>
                    </div>
                  )
                )}

                {activeTab === 'past' && (
                  filterVisibleBookings(pastBookings).length > 0 ? (
                    filterVisibleBookings(pastBookings).map(booking => (
                      <BookingCard key={booking.id} booking={booking} />
                    ))
                  ) : (
                    <div className="col-span-full text-center py-12">
                      <CheckCircle size={36} className="text-gray-700 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No past bookings</p>
                    </div>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          </>
        )}

      </div>

      {/* Clear Local Pending Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1A1A1A] rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-[0_0_40px_rgba(239,68,68,0.15)]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <h3 className="text-white font-black" style={{ fontSize: 17 }}>Clear Local Markers?</h3>
            </div>
            <p className="text-gray-400 mb-6" style={{ fontSize: 13 }}>
              This clears your locally-tracked pending markers so bookings reappear in Upcoming. Actual requests submitted to admin remain active.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearModal(false)}
                className="flex-1 bg-gray-500/20 text-gray-400 px-4 py-2.5 rounded-xl hover:bg-gray-500/30 transition-colors font-black"
                style={{ fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearPendingRequests}
                className="flex-1 bg-red-500 text-white px-4 py-2.5 rounded-xl hover:bg-red-600 transition-colors font-black"
                style={{ fontSize: 14 }}
              >
                Clear
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-[#1A1A1A] rounded-2xl p-5 sm:p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto scrollbar-hide shadow-[0_0_40px_rgba(255,140,0,0.15)]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-black" style={{ fontSize: 18 }}>
                Request Cancellation
              </h3>
              <button 
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedBooking(null);
                  setCancellationReason('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-400" style={{ fontSize: 13 }}>
                  Your cancellation request will be reviewed by admin. Refunds are subject to approval based on our cancellation policy.
                </p>
              </div>
            </div>

            <div className="mb-5">
              <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>
                Reason for Cancellation
              </label>
              <textarea
                value={cancellationReason}
                onChange={e => setCancellationReason(e.target.value)}
                placeholder="Please provide a reason for cancellation..."
                rows={4}
                className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#FF8C00]"
                style={{ fontSize: 13 }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedBooking(null);
                  setCancellationReason('');
                }}
                className="flex-1 bg-gray-500/20 text-gray-400 px-4 py-2.5 rounded-xl hover:bg-gray-500/30 transition-colors font-black"
                style={{ fontSize: 14 }}
              >
                Go Back
              </button>
              <button
                onClick={handleCancelRequest}
                disabled={!cancellationReason.trim() || isSubmitting}
                className="flex-1 bg-red-500 text-white px-4 py-2.5 rounded-xl hover:bg-red-600 transition-colors font-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                style={{ fontSize: 14 }}
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-[#1A1A1A] rounded-2xl p-5 sm:p-6 max-w-md w-full border border-white/10 shadow-[0_0_40px_rgba(0,71,171,0.15)] relative" style={{ overflow: 'visible' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-black" style={{ fontSize: 18 }}>
                Reschedule Booking
              </h3>
              <button 
                onClick={() => {
                  setShowRescheduleModal(false);
                  setSelectedBooking(null);
                  setRescheduleDate('');
                  setRescheduleTime('');
                  setRescheduleReason('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-3">
                <RefreshCw size={18} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-blue-400" style={{ fontSize: 13 }}>
                  Select a new date and time for your booking. The system will check for availability automatically.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              {checkingTimes && rescheduleDate ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={24} className="text-[#0047AB] animate-spin mb-2" />
                  <p className="text-gray-400 text-sm font-black ml-3">Checking availability...</p>
                </div>
              ) : (
                <CustomDateTimePicker
                  selectedDate={rescheduleDate}
                  selectedTime={rescheduleTime}
                  onDateChange={(d) => { setRescheduleDate(d); setRescheduleTime(''); }}
                  onTimeChange={setRescheduleTime}
                  minDate={new Date().toISOString().split('T')[0]}
                  accentColor="#0047AB"
                  availableTimes={availableTimes}
                  startHour={FACILITY_OPEN_HOUR}
                  endHour={FACILITY_CLOSE_HOUR}
                  sessionDurationHours={selectedBookingDuration}
                />
              )}
              <div>
                <label className="text-gray-400 block mb-2" style={{ fontSize: 13 }}>
                  Reason for reschedule <span className="text-gray-600">(optional)</span>
                </label>
                <textarea
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  placeholder="Add context for the front desk..."
                  rows={3}
                  className="w-full bg-[#252525] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-[#0047AB]"
                  style={{ fontSize: 13, lineHeight: 1.5 }}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setSelectedBooking(null);
                  setRescheduleDate('');
                  setRescheduleTime('');
                  setRescheduleReason('');
                }}
                className="flex-1 bg-gray-500/20 text-gray-400 px-4 py-2.5 rounded-xl hover:bg-gray-500/30 transition-colors font-black"
                style={{ fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={handleReschedule}
                disabled={!rescheduleDate || !rescheduleTime || isSubmitting}
                className="flex-1 bg-[#0047AB] text-white px-4 py-2.5 rounded-xl hover:bg-[#003a8c] transition-colors font-black disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                style={{ fontSize: 14 }}
              >
                {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
        {ticketBooking && (
          <BookingTicketModal booking={ticketBooking} onClose={() => setTicketBooking(null)} />
        )}
      </AnimatePresence>

      {/* Clear Completed Modal */}
      {showClearCompletedModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-[#1A1A1A] rounded-2xl p-6 max-w-sm w-full border border-white/10 shadow-[0_0_40px_rgba(107,114,128,0.15)]"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gray-500/15 border border-gray-500/20 flex items-center justify-center">
                <CheckCircle size={18} className="text-gray-400" />
              </div>
              <h3 className="text-white font-black" style={{ fontSize: 17 }}>Clear Completed?</h3>
            </div>
            <p className="text-gray-400 mb-6" style={{ fontSize: 13 }}>
              This will hide all completed bookings from this view. They remain in your booking history under Account & Activity.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearCompletedModal(false)}
                className="flex-1 bg-gray-500/20 text-gray-400 px-4 py-2.5 rounded-xl hover:bg-gray-500/30 transition-colors font-black"
                style={{ fontSize: 14 }}
              >
                Cancel
              </button>
              <button
                onClick={handleClearCompleted}
                className="flex-1 bg-gray-500/40 text-white px-4 py-2.5 rounded-xl hover:bg-gray-500/50 transition-colors font-black"
                style={{ fontSize: 14 }}
              >
                Clear
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
