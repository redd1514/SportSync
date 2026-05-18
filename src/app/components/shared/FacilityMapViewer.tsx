import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle, X, ZoomIn, ZoomOut, Building2, MapIcon, MapPinOff,
  CalendarDays, Clock, ChevronLeft, ChevronRight,
  Check, User, Zap, AlertCircle, Smartphone, QrCode,
  Receipt, Mail, ArrowRight, ChevronDown, CreditCard,
  Download, Shield,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getLocalDateString } from '../../utils/date';
import { apiFetch } from '../../utils/authenticatedFetch';
import { genRefCode } from '../../../shared/ticketRef';
import { downloadTicketQrPng } from '../../../shared/qrDownload';
import { useFacilityMap, getSportMapColor, resolveCourtSportColor, LiveStatus, bookingAppliesToPublishedMap } from '../../contexts/FacilityMapContext';
import type { CourtBlock } from '../../contexts/FacilityMapContext';
import { useUser, Booking } from '../../contexts/UserContext';
import { useBookingAPI } from '../../hooks/useBookingAPI';
import { useAddons } from '../../contexts/AddonsContext';
import { SPORTS_INFO, AddOn, isAddonPerHourPricing, formatAddonLinePeso } from '../sportsData';
import { SportIcon } from '../SportIcons';
import { FacilityMapCourtMarkings, FACILITY_COURT_SHEEN_GRADIENT } from './facilityMapCourtMarkings';
import { LoyaltyRewardToggle } from './loyalty/LoyaltyRewardToggle';
import { FACILITY_COURT_FILL_OPACITY, FACILITY_COURT_SHEEN_OPACITY } from '../../contexts/FacilityMapContext';
import {
  LOYALTY_REWARD_THRESHOLD,
  calcLoyaltyCourtDiscount,
  formatLoyaltyDiscountLabel,
  loyaltyRewardsAvailable,
} from '../../constants/loyalty';
import { PaymongoDownpaymentConfirm } from './PaymongoDownpaymentConfirm';

/* ─── Helpers ────────────────────────────────────────────────────── */
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const STATUS_COLORS: Record<LiveStatus, { fill: string; stroke: string; label: string }> = {
  available:   { fill: '#22c55e', stroke: '#16a34a', label: 'Available'   },
  occupied:    { fill: '#dc2626', stroke: '#b91c1c', label: 'Occupied'    },
  maintenance: { fill: '#374151', stroke: '#4b5563', label: 'Maintenance' },
};

function getCourtColors(liveStatus: LiveStatus, sportColor: string): { fill: string; stroke: string } {
  if (liveStatus === 'maintenance') return { fill: '#374151', stroke: '#4b5563' };
  if (liveStatus === 'occupied')    return { fill: '#991b1b', stroke: '#b91c1c' };
  return { fill: sportColor, stroke: sportColor };
}

const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const dayLabels  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const fmt12 = (h: number) => `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
const fmtLabel = (h: number) => `${h % 12 || 12}${h >= 12 ? 'PM' : 'AM'}`;

/* ─── Inline Calendar ────────────────────────────────────────────── */
function InlineCalendar({
  selectedDate, onDateChange, minDate, accentColor = '#FF8C00',
}: { selectedDate: string; onDateChange: (d: string) => void; minDate?: string; accentColor?: string }) {
  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) return new Date(selectedDate + 'T00:00:00');
    return new Date();
  });

  const daysInMonth = useMemo(() => {
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const days: (number | null)[] = [];
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let i = 1; i <= last.getDate(); i++) days.push(i);
    return days;
  }, [viewMonth]);

  const selectedDay  = selectedDate ? parseInt(selectedDate.split('-')[2]) : null;
  const isToday = (d: number) => {
    const t = new Date();
    return d === t.getDate() && viewMonth.getMonth() === t.getMonth() && viewMonth.getFullYear() === t.getFullYear();
  };
  const isDisabled = (d: number) => {
    if (!minDate) return false;
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return dateStr < minDate;
  };
  const handleDay = (d: number) => {
    if (isDisabled(d)) return;
    const y = viewMonth.getFullYear(), m = viewMonth.getMonth();
    onDateChange(`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  };
  const goPrev = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  const goNext = () => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));

  return (
    <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className="flex items-center justify-between mb-2">
        <button onClick={goPrev} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={14} />
        </button>
        <span className="text-white font-black" style={{ fontSize: 13 }}>
          {monthNames[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </span>
        <button onClick={goNext} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/8 text-gray-400 hover:text-white transition-colors">
          <ChevronRight size={14} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {dayLabels.map(l => (
          <div key={l} className="text-center text-gray-600 font-black" style={{ fontSize: 9 }}>{l}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {daysInMonth.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} />;
          const isSel = day === selectedDay && selectedDate.startsWith(`${viewMonth.getFullYear()}-${String(viewMonth.getMonth()+1).padStart(2,'0')}`);
          const isTod = isToday(day);
          const isDis = isDisabled(day);
          return (
            <button key={day} onClick={() => !isDis && handleDay(day)} disabled={isDis}
              className="aspect-square rounded-lg flex items-center justify-center font-black transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              style={{
                fontSize: 11,
                backgroundColor: isSel ? accentColor : isTod ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: isSel ? 'white' : isTod ? accentColor : '#aaa',
                border: isTod && !isSel ? `1px solid ${accentColor}40` : '1px solid transparent',
              }}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Time Slot Grid (flat, range-aware) ─────────────────────────── */
function TimeSlotGrid({
  accentColor, bookedRanges, disabledBefore, selectedTime, onTimeChange, pricePerHour, selectedEndHour, openingHour = 6, closingHour = 23,
}: {
  accentColor: string;
  bookedRanges: { start: number; end: number }[];
  disabledBefore: number;
  selectedTime: string;
  onTimeChange: (t: string) => void;
  pricePerHour: number;
  selectedEndHour?: number | null;
  openingHour?: number;
  closingHour?: number;
}) {
  const allHours = Array.from({ length: Math.max(0, closingHour - openingHour) }, (_, i) => i + openingHour);
  const isBooked = (h: number) => bookedRanges.some(r => h >= r.start && h < r.end);
  const isPast   = (h: number) => h < disabledBefore;
  const selHour  = selectedTime ? parseInt(selectedTime.split(':')[0]) : -1;
  const inRange  = (h: number) => selHour >= 0 && selectedEndHour != null && h > selHour && h < selectedEndHour;
  const isEnd    = (h: number) => selectedEndHour != null && h === selectedEndHour;

  return (
    <div className="grid grid-cols-3 gap-2">
      {allHours.map(h => {
        const booked   = isBooked(h);
        const past     = isPast(h);
        const sel      = h === selHour;
        const ranged   = inRange(h);
        const end      = isEnd(h);
        const disabled = booked || past;
        return (
          <motion.button
            key={h}
            disabled={disabled}
            layout
            whileTap={!disabled ? { scale: 0.94 } : {}}
            onClick={() => !disabled && onTimeChange(`${String(h).padStart(2,'0')}:00`)}
            className="flex flex-col items-center py-3 px-2 rounded-2xl relative overflow-hidden"
            style={{
              background: sel    ? accentColor
                : end    ? `${accentColor}30`
                : ranged ? `${accentColor}18`
                : booked ? 'rgba(255,255,255,0.03)'
                : past   ? 'rgba(255,255,255,0.02)'
                :          `${accentColor}10`,
              border: `1.5px solid ${
                sel    ? accentColor :
                end    ? `${accentColor}70` :
                ranged ? `${accentColor}40` :
                booked ? 'rgba(255,255,255,0.06)' :
                past   ? 'rgba(255,255,255,0.03)' :
                         `${accentColor}30`
              }`,
              boxShadow: sel ? `0 4px 20px ${accentColor}50` : 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: past ? 0.18 : 1,
              transition: 'all 0.18s ease',
            }}
          >
            <span className="font-black leading-tight" style={{
              fontSize: 13,
              color: sel ? 'white' : end ? accentColor : ranged ? accentColor : booked ? '#2a2a2a' : 'white',
              textDecoration: booked ? 'line-through' : 'none',
            }}>
              {`${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`}
            </span>
            {booked ? (
              <span style={{ fontSize: 9, fontWeight: 800, color: '#333', marginTop: 3 }}>Booked</span>
            ) : end ? (
              <span style={{ fontSize: 9, fontWeight: 800, color: accentColor, marginTop: 3 }}>End</span>
            ) : ranged ? (
              <span style={{ fontSize: 9, fontWeight: 800, color: `${accentColor}80`, marginTop: 3 }}>In session</span>
            ) : !past ? (
              <span style={{ fontSize: 9, fontWeight: 700, color: sel ? 'rgba(0,0,0,0.55)' : `${accentColor}70`, marginTop: 3 }}>
                {pricePerHour > 0 ? `\u20B1${pricePerHour}/hr` : ''}
              </span>
            ) : null}
          </motion.button>
        );
      })}
    </div>
  );
}

/* ─── Duration Picker ────────────────────────────────────────────── */
function DurationPicker({
  startTime, bookedRanges, pricePerHour, accentColor, selectedDuration, onSelect, minDuration = 1, maxDuration = 8, closingHour = 23,
}: {
  startTime: string;
  bookedRanges: { start: number; end: number }[];
  pricePerHour: number;
  accentColor: string;
  selectedDuration: number;
  onSelect: (dur: number, endH: number) => void;
  minDuration?: number;
  maxDuration?: number;
  closingHour?: number;
}) {
  const startH = parseInt(startTime.split(':')[0]);
  const nextBooked = bookedRanges.filter(r => r.start > startH).sort((a, b) => a.start - b.start)[0];
  const maxEnd = Math.min(nextBooked ? nextBooked.start : closingHour, startH + maxDuration, closingHour);
  const slots = Array.from({ length: maxEnd - startH }, (_, i) => i + 1).filter((dur) => dur >= minDuration);

  if (slots.length === 0) return (
    <div className="p-3 rounded-xl flex items-center gap-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
      <AlertCircle size={14} className="text-red-400" />
      <p className="text-red-400 font-black" style={{ fontSize: 12 }}>No duration available — fully booked after this time</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {slots.map(dur => {
        const endH = startH + dur;
        const isSelected = selectedDuration === dur;
        const price = pricePerHour * dur;
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
              <p className="text-gray-500" style={{ fontSize: 11 }}>{fmt12(startH)} &rarr; {fmt12(endH)}</p>
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
                {'\u20B1'}{price.toLocaleString()}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        );
      })}
      {nextBooked && (
        <div className="flex items-center gap-1.5 mt-1" style={{ opacity: 0.6 }}>
          <Clock size={10} className="text-amber-500" />
          <p className="text-amber-500 font-black" style={{ fontSize: 10 }}>Next booking at {fmt12(nextBooked.start)}</p>
        </div>
      )}
    </div>
  );
}

/* ─── In-Person Payment Confirmation ───────────────────────────── */
function FacilityPaymentConfirm({
  amount, onSuccess, onCancel,
}: { amount: number; onSuccess: () => void; onCancel: () => void }) {
  const [processing, setProcessing] = useState(false);

  const handleConfirm = () => {
    setProcessing(true);
    // Simulate short network delay
    setTimeout(() => {
      onSuccess();
    }, 800);
  };

  return (
    <div className="space-y-4">
      <motion.div 
        animate={{ boxShadow: ['0px 0px 0px rgba(255,140,0,0)', '0px 0px 20px rgba(255,140,0,0.3)', '0px 0px 0px rgba(255,140,0,0)'] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="rounded-3xl overflow-hidden relative" 
        style={{ background: 'linear-gradient(135deg,#FF8C00,#cc7000)', padding: '20px' }}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mt-10 -mr-10 pointer-events-none" />
        <div className="flex items-center justify-between relative z-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <p className="text-orange-100 font-black tracking-widest" style={{ fontSize: 10 }}>MANUAL CHECK-IN</p>
            </div>
            <p className="text-white font-black leading-tight" style={{ fontSize: 22 }}>Pay at Facility</p>
          </div>
          <div className="text-right bg-black/20 px-4 py-2 rounded-2xl backdrop-blur-sm border border-white/10 shadow-inner">
            <p className="text-orange-200 font-bold mb-0.5" style={{ fontSize: 9, letterSpacing: 0.5 }}>AMOUNT DUE</p>
            <p className="text-white font-black" style={{ fontSize: 22, lineHeight: 1 }}>{'\u20B1'}{amount.toLocaleString()}</p>
          </div>
        </div>
      </motion.div>

      <div className="p-4 bg-orange-500/5 rounded-2xl border border-orange-500/20 text-center flex flex-col items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shadow-inner">
          <Building2 size={18} className="text-orange-400" />
        </div>
        <p className="text-gray-300 font-medium" style={{ fontSize: 13, lineHeight: 1.5 }}>
          Your court will be instantly reserved. Please proceed to the front desk upon arrival to pay and claim your court.
        </p>
      </div>

      {processing ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-12 h-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
          <p className="text-white font-black" style={{ fontSize: 15 }}>Processing Reservation...</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-white/10 text-gray-400 font-black transition-all hover:text-white"
            style={{ fontSize: 13 }}>
            Back
          </button>
          <button onClick={handleConfirm}
            className="flex-1 py-3 rounded-xl text-white font-black transition-all"
            style={{ fontSize: 14, background: 'linear-gradient(135deg,#FF8C00,#e67e00)', boxShadow: '0 4px 16px rgba(255,140,0,0.4)' }}>
            Confirm Reservation
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Multi-step Booking Modal ───────────────────────────────────── */
interface BookingModalProps {
  courtName: string;
  sport: string;
  mode: 'customer' | 'staff';
  courtBookings: Booking[];
  onClose: () => void;
  onConfirm: (details: {
    court: string; sport: string; date: string; time: string; duration: number;
    addOns: string; paymentMethod: string; refCode: string;
    customerName?: string; customerPhone?: string; amount: number;
    addonIds: string[];
    loyaltyPointsRedeemed?: number;
    loyaltyDiscount?: number;
  }) => void | Promise<void>;
  initialDate?: string;
  initialTime?: string;
  coachingMode?: boolean;
  coachName?: string;
  coachHourlyRate?: number;
  studentName?: string;
  coachingSessionId?: string;
  coachingStudentId?: string;
  coachId?: string;
  facilityMapId?: string | null;
  onDone?: () => void;
}

function BookingModal({ courtName, sport, mode, courtBookings, onClose, onConfirm, initialDate, initialTime, coachingMode = false, coachName, coachHourlyRate = 0, studentName, coachingSessionId, coachingStudentId, coachId, facilityMapId, onDone }: BookingModalProps) {
  const { addonsBySport } = useAddons();
  const { calcCourtPrice, user, systemSettings } = useUser();
  const now = new Date();
  const accentColor = coachingMode ? '#2563EB' : mode === 'staff' ? '#0047AB' : '#FF8C00';
  const todayStr = getLocalDateString(now);

  /* Steps
     customer: Details(0) → Review(1) → Confirm(2) → Done(3)
     staff:    Walk-in(0) → Details(1) → Review(2) → Done(3)
  */
  const steps = coachingMode
    ? ['Court Slot', 'Review', 'Pay Court', 'Done']
    : mode === 'staff'
    ? ['Walk-in Info', 'Details', 'Review', 'Done']
    : ['Details', 'Review', 'Confirm', 'Done'];
  const totalSteps = steps.length;
  const [step, setStep] = useState(0);

  const detailsStep  = mode === 'staff' && !coachingMode ? 1 : 0;
  const reviewStep   = mode === 'staff' && !coachingMode ? 2 : 1;
  const paymentStep  = mode === 'customer' || coachingMode ? 2 : -1;
  const doneStep     = totalSteps - 1;

  const isDone      = step === doneStep;
  const isDetails   = step === detailsStep;
  const isReview    = step === reviewStep;
  const isConfirm   = (mode === 'customer' || coachingMode) && step === paymentStep;
  const isWalkIn    = mode === 'staff' && !coachingMode && step === 0;

  /* Form state */
  const [date, setDate]             = useState(initialDate || todayStr);
  const [time, setTime]             = useState(initialTime || '');
  const [duration, setDuration]     = useState(0);
  const [endHour, setEndHour]       = useState<number | null>(null);
  const [customerName, setCustomerName]   = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [email, setEmail]           = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [error, setError]           = useState('');
  const refCode = useRef(genRefCode());
  const [qrDownloadBusy, setQrDownloadBusy] = useState(false);
  const [useLoyaltyReward, setUseLoyaltyReward] = useState(false);
  const modalBodyRef = useRef<HTMLDivElement>(null);

  /* Derived */
  const bookedRanges = useMemo(() => courtBookings
    .filter(b => b.date === date && b.status !== 'cancelled' && b.status !== 'completed' && b.status !== 'rejected')
    .map(b => { const start = parseInt(b.time.split(':')[0]); return { start, end: start + (b.duration || 1) }; }),
  [courtBookings, date]);

  const openingHour = Math.max(0, Math.min(23, parseInt(systemSettings.businessHours.start.split(':')[0] || '6', 10)));
  const closingHour = Math.max(openingHour + 1, Math.min(24, parseInt(systemSettings.businessHours.end.split(':')[0] || '23', 10)));
  const maxBookingDuration = Math.max(systemSettings.bookingDurationMin, systemSettings.bookingDurationMax);
  const disabledBefore = date === todayStr ? Math.max(now.getHours(), openingHour) : openingHour;
  const basePrice      = time ? calcCourtPrice(sport, date, time) : 0;
  const sportAddons: AddOn[] = coachingMode ? [] : addonsBySport[sport] || [];

  const addonTotal = useMemo(() =>
    Array.from(selectedAddons).reduce((sum, id) => {
      const a = sportAddons.find(x => x.id === id);
      if (!a) return sum;
      return sum + (isAddonPerHourPricing(a) ? a.price * duration : a.price);
    }, 0),
  [selectedAddons, sportAddons, duration]);

  const coachingRate = coachingMode ? Math.max(0, Number(coachHourlyRate || 0)) : 0;
  const computedCoachingFee = coachingMode ? coachingRate * Math.max(1, duration || 1) : 0;
  const courtSubtotal = basePrice * duration;
  const loyaltyDiscountBase = courtSubtotal + addonTotal;
  const canUseLoyaltyReward =
    mode === 'customer' && loyaltyRewardsAvailable(Number(user?.loyaltyPoints || 0)) > 0 && loyaltyDiscountBase > 0;
  const loyaltyDiscount = calcLoyaltyCourtDiscount(loyaltyDiscountBase, useLoyaltyReward && canUseLoyaltyReward);
  const total = Math.max(0, courtSubtotal + addonTotal + computedCoachingFee - loyaltyDiscount);

  const fallbackPrice = sport === 'Badminton' || sport === 'Pickleball' ? 300 : sport === 'Billiards' || sport === 'Table Tennis' ? 100 : 450;

  const handleTimeChange = (t: string) => { setTime(t); setDuration(0); setEndHour(null); };
  const handleDurationSelect = (dur: number, endH: number) => { setDuration(dur); setEndHour(endH); };
  const handlePHPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    // Force "09" prefix, then limit to 11 digits total.
    let normalized = digits;
    if (normalized.startsWith('639')) normalized = '0' + normalized.slice(2); // 639xx... -> 09xx...
    if (!normalized.startsWith('09')) {
      // If user typed starting digit(s), coerce into 09XXXXXXXXX
      const tail = normalized.startsWith('9') ? normalized.slice(1) : normalized;
      normalized = '09' + tail;
    }
    normalized = normalized.slice(0, 11);
    setCustomerPhone(normalized);
  };

  const doConfirm = async () => {
    const addOnLabels = Array.from(selectedAddons).map(id => {
      const a = sportAddons.find(x => x.id === id);
      if (!a) return id;
      return formatAddonLinePeso(a, duration).left;
    }).join(' | ');
    await onConfirm({
      court: courtName, sport, date, time, duration,
      addOns: [addOnLabels, useLoyaltyReward ? `Loyalty ${formatLoyaltyDiscountLabel()} applied` : '', coachingMode ? `Coaching with ${coachName || 'coach'}` : mode === 'staff' ? 'Walk-in' : 'Online Booking'].filter(Boolean).join(' | '),
      paymentMethod: mode === 'staff' ? 'cash' : 'pay_at_facility',
      refCode: refCode.current,
      customerName: coachingMode ? (studentName || 'Student') : mode === 'staff' ? customerName : undefined,
      customerPhone: mode === 'staff' ? customerPhone : undefined,
      amount: total,
      addonIds: Array.from(selectedAddons),
      loyaltyPointsRedeemed: useLoyaltyReward ? LOYALTY_REWARD_THRESHOLD : 0,
      loyaltyDiscount,
    });
  };

  const goNext = async () => {
    setError('');
    if (isWalkIn && !customerName.trim()) { setError('Please enter the customer name.'); return; }
    if (isDetails) {
      if (!date) { setError('Please select a date.'); return; }
      if (!time) { setError('Please select a start time.'); return; }
      if (!duration) { setError('Please select a session duration.'); return; }
    }
    if (isReview && mode === 'staff') {
      try {
        await doConfirm();
      } catch (e: any) {
        setError(e?.message || 'Could not save booking.');
        return;
      }
    }
    setStep(s => s + 1);
  };
  const goPrev = () => { setError(''); setStep(s => Math.max(0, s - 1)); };

  useEffect(() => {
    window.setTimeout(() => {
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 40);
  }, [step]);

  const formatDate = (d: string) => {
    if (!d) return { label: '—', rateType: '' };
    const dt = new Date(d + 'T00:00:00');
    return {
      label: dt.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }),
      rateType: [0, 6].includes(dt.getDay()) ? 'Weekend rate' : 'Weekday rate',
    };
  };

  const color = getSportMapColor(sport);
  const dateInfo = formatDate(date);

  const priceBreakdownPanel = (
    <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2" style={{ background: `${accentColor}06` }}>
        <Receipt size={12} style={{ color: accentColor }} />
        <span className="text-white font-black" style={{ fontSize: 11 }}>PRICE BREAKDOWN</span>
      </div>
      <div className="px-4 py-3 space-y-1.5">
        <div className="flex justify-between gap-2">
          <span className="text-gray-400 flex-1 min-w-0" style={{ fontSize: 12 }}>
            Court rate ({'\u20B1'}{basePrice.toLocaleString()}/hr &times; {duration}h)
          </span>
          <span className="text-white font-black flex-shrink-0" style={{ fontSize: 12 }}>{'\u20B1'}{(basePrice * duration).toLocaleString()}</span>
        </div>
        {computedCoachingFee > 0 && (
          <div className="flex justify-between gap-2">
            <span className="text-gray-400 flex-1 min-w-0" style={{ fontSize: 12 }}>
              Coaching fee ({'\u20B1'}{coachingRate.toLocaleString()}/hr &times; {Math.max(1, duration || 1)}h)
            </span>
            <span className="text-white font-black flex-shrink-0" style={{ fontSize: 12 }}>+{'\u20B1'}{computedCoachingFee.toLocaleString()}</span>
          </div>
        )}
        {addonTotal > 0 && Array.from(selectedAddons).map(id => {
          const a = sportAddons.find(x => x.id === id);
          if (!a) return null;
          const { left, amount } = formatAddonLinePeso(a, duration);
          return (
            <div key={id} className="flex justify-between gap-2">
              <span className="text-gray-400 flex-1 min-w-0" style={{ fontSize: 12 }}>{left}</span>
              <span className="text-white font-black flex-shrink-0" style={{ fontSize: 12 }}>+{'\u20B1'}{amount.toLocaleString()}</span>
            </div>
          );
        })}
        <AnimatePresence>
          {loyaltyDiscount > 0 && (
            <motion.div
              key="loyalty-line"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex justify-between gap-2 overflow-hidden"
            >
              <span className="text-yellow-300 flex-1 min-w-0" style={{ fontSize: 12 }}>Loyalty discount</span>
              <span className="text-yellow-300 font-black flex-shrink-0" style={{ fontSize: 12 }}>-{'\u20B1'}{loyaltyDiscount.toLocaleString()}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {canUseLoyaltyReward && isReview && (
          <LoyaltyRewardToggle
            active={useLoyaltyReward}
            onToggle={() => setUseLoyaltyReward((next) => !next)}
            discountAmount={calcLoyaltyCourtDiscount(loyaltyDiscountBase, true)}
          />
        )}
        <div className="border-t border-white/8 pt-1.5 flex justify-between items-end">
          <span className="text-white font-black" style={{ fontSize: 13 }}>TOTAL</span>
          <span className="font-black" style={{ fontSize: 20, color: accentColor }}>{'\u20B1'}{total.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[900] flex items-end sm:items-center justify-center sm:p-3 bg-black/85 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="w-full max-w-[min(100%,28rem)] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl mx-auto"
        style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.1)', maxHeight: 'min(92vh,100dvh)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 flex-shrink-0"
          style={{ background: `linear-gradient(135deg,${color}18,transparent)` }}>
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}35` }}>
              <SportIcon sport={sport} size={22} color={color} strokeWidth={2} />
            </div>
            <div>
              <p className="text-white font-black" style={{ fontSize: 17 }}>{courtName}</p>
              <p style={{ fontSize: 12, color, fontWeight: 800 }}>{sport}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Stepper */}
        {!isDone && (
          <div className="flex items-center justify-center gap-2 px-5 py-3 border-b border-white/5 flex-shrink-0">
            {steps.slice(0, -1).map((label, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                    style={{ background: i < step ? '#22c55e' : i === step ? accentColor : 'rgba(255,255,255,0.08)' }}>
                    {i < step
                      ? <Check size={11} className="text-white" />
                      : <span className="text-white font-black" style={{ fontSize: 9 }}>{i + 1}</span>}
                  </div>
                  <span className="font-black" style={{ fontSize: 10, color: i === step ? 'white' : i < step ? '#22c55e' : '#444' }}>
                    {label}
                  </span>
                </div>
                {i < steps.length - 2 && (
                  <div className="w-8 h-px" style={{ background: i < step ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.08)' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Body */}
        <div ref={modalBodyRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-5" style={{ scrollbarWidth: 'none' }}>

          {/* ── Done ── */}
          {isDone && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-4 py-3 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                <div className="w-16 h-16 rounded-full bg-green-500/15 border-2 border-green-500 flex items-center justify-center">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
              </motion.div>
              <div>
                <p className="text-white font-black" style={{ fontSize: 20 }}>
                  {coachingMode ? 'Coaching Request Reserved!' : mode === 'staff' ? 'Walk-In Confirmed!' : 'Booking Reserved!'}
                </p>
                {coachingMode ? (
                  <p className="text-blue-300 mt-2 font-black" style={{ fontSize: 13 }}>Your court is reserved and the request is waiting for coach approval.</p>
                ) : mode === 'customer' && (
                  <p className="text-orange-400 mt-2 font-black" style={{ fontSize: 13 }}>Please proceed to the facility to pay in person and check in.</p>
                )}
                <p className="text-gray-400 mt-1" style={{ fontSize: 13 }}>{courtName} · {dateInfo.label}</p>
                <p className="text-gray-400" style={{ fontSize: 13 }}>
                  {time && fmt12(parseInt(time))} &ndash; {endHour ? fmt12(endHour) : ''} · {'\u20B1'}{total.toLocaleString()}
                </p>
              </div>
              {coachingMode ? (
                <div className="rounded-3xl border border-blue-400/25 bg-blue-500/10 p-5 w-full text-left">
                  <p className="text-blue-100 font-black mb-2" style={{ fontSize: 14 }}>Waiting for coach acceptance</p>
                  <p className="text-blue-100/80 leading-relaxed" style={{ fontSize: 12 }}>
                    Your court is reserved for this coaching request. The QR ticket will appear in My Coaching only after the coach accepts.
                  </p>
                </div>
              ) : (
              <div className="bg-white rounded-3xl p-5 flex flex-col items-center gap-3 w-full">
                <p className="text-gray-600 font-black" style={{ fontSize: 10, letterSpacing: 1.5 }}>SHOW AT FRONT DESK TO CHECK IN</p>
                <div style={{ background: 'white', padding: 4, borderRadius: 12 }}>
                  <QRCodeSVG value={refCode.current} size={160} level="H" includeMargin={false} />
                </div>
                <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2">
                  <QrCode size={13} className="text-gray-500" />
                  <span className="text-gray-800 font-black" style={{ fontSize: 14, letterSpacing: 1.5 }}>{refCode.current}</span>
                </div>
                <button
                  type="button"
                  disabled={qrDownloadBusy}
                  onClick={async () => {
                    setQrDownloadBusy(true);
                    try {
                      await downloadTicketQrPng({
                        value: refCode.current,
                        fileBaseName: refCode.current.replace(/\s+/g, '_'),
                        displayCode: refCode.current,
                      });
                    } catch (e) {
                      console.error(e);
                    } finally {
                      setQrDownloadBusy(false);
                    }
                  }}
                  className="w-full py-2.5 rounded-xl font-black text-gray-800 border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ fontSize: 13 }}
                >
                  <Download size={15} />
                  {qrDownloadBusy ? 'Preparing…' : 'Download QR image'}
                </button>
              </div>
              )}
              <div className="w-full bg-[#111] rounded-2xl border border-white/8 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2" style={{ background: `${accentColor}08` }}>
                  <Receipt size={13} style={{ color: accentColor }} />
                  <span className="text-white font-black" style={{ fontSize: 12 }}>BOOKING RECEIPT</span>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {coachingMode && (
                    <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>For student</span><span className="text-white font-black" style={{ fontSize: 12 }}>{studentName || 'Student'}</span></div>
                  )}
                  {mode === 'staff' && !coachingMode && customerName && (
                    <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Customer</span><span className="text-white font-black" style={{ fontSize: 12 }}>{customerName}</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Court</span><span className="text-white font-black" style={{ fontSize: 12 }}>{courtName}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Date</span><span className="text-white font-black" style={{ fontSize: 12 }}>{dateInfo.label}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Time</span><span className="text-white font-black" style={{ fontSize: 12 }}>{time && fmt12(parseInt(time))} &ndash; {endHour ? fmt12(endHour) : ''}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Duration</span><span className="text-white font-black" style={{ fontSize: 12 }}>{duration}h</span></div>
                  <div className="flex justify-between"><span className="text-gray-500" style={{ fontSize: 12 }}>Rate</span><span className="text-white font-black" style={{ fontSize: 12 }}>{'\u20B1'}{basePrice.toLocaleString()}/hr &times; {duration}h</span></div>
                  {addonTotal > 0 && Array.from(selectedAddons).map(id => {
                    const a = sportAddons.find(x => x.id === id);
                    if (!a) return null;
                    const { left, amount } = formatAddonLinePeso(a, duration);
                    return (
                      <div key={id} className="flex justify-between gap-2">
                        <span className="text-gray-500" style={{ fontSize: 12 }}>{left}</span>
                        <span className="text-white font-black flex-shrink-0" style={{ fontSize: 12 }}>+{'\u20B1'}{amount.toLocaleString()}</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-white/8 pt-2 flex justify-between">
                    <span className="text-white font-black" style={{ fontSize: 13 }}>{coachingMode ? 'TOTAL DUE' : 'TOTAL PAID'}</span>
                    <span className="font-black" style={{ fontSize: 18, color: accentColor }}>{'\u20B1'}{total.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500" style={{ fontSize: 11 }}>Payment</span>
                    <span className="font-black" style={{ fontSize: 11, color: coachingMode ? '#60a5fa' : mode === 'staff' ? '#60a5fa' : '#FF8C00' }}>{coachingMode ? 'Pay at front desk after coach accepts' : mode === 'staff' ? 'Cash (Walk-in)' : 'Pay at Facility'}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => { onClose(); onDone?.(); }} className="w-full py-3.5 rounded-2xl text-white font-black transition-all"
                style={{ fontSize: 15, background: `linear-gradient(135deg,${accentColor},${accentColor}cc)` }}>
                {coachingMode ? 'Done - My Coaching' : 'Done - Close'}
              </button>
            </motion.div>
          )}

          {/* ── Walk-in Info ── */}
          {!isDone && isWalkIn && (
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 block mb-1.5" style={{ fontSize: 12, fontWeight: 700 }}>CUSTOMER NAME *</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full name"
                  className="w-full rounded-xl px-4 py-3 text-white focus:outline-none"
                  style={{ fontSize: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div>
                <label className="text-gray-400 block mb-1.5" style={{ fontSize: 12, fontWeight: 700 }}>PHONE NUMBER</label>
                <input value={customerPhone} onChange={e => handlePHPhone(e.target.value)} placeholder="09XX XXX XXXX" type="tel" maxLength={11}
                  className="w-full rounded-xl px-4 py-3 text-white focus:outline-none"
                  style={{ fontSize: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(0,71,171,0.08)', border: '1px solid rgba(0,71,171,0.2)' }}>
                <Zap size={13} className="text-[#60a5fa] flex-shrink-0" />
                <span className="text-gray-400" style={{ fontSize: 12 }}>Walk-in bookings are confirmed immediately. Cash collected on-site.</span>
              </div>
            </div>
          )}

          {/* ── Details ── */}
          {!isDone && isDetails && (
            <AnimatePresence mode="wait">
              <motion.div key="details" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <CalendarDays size={12} style={{ color: accentColor }} />
                    <label className="text-gray-400 font-black" style={{ fontSize: 11, letterSpacing: 0.5 }}>SELECT DATE</label>
                  </div>
                  <InlineCalendar
                    selectedDate={date}
                    onDateChange={d => { setDate(d); setTime(''); setDuration(0); setEndHour(null); }}
                    minDate={todayStr}
                    accentColor={accentColor}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <Clock size={12} style={{ color: accentColor }} />
                    <label className="text-gray-400 font-black" style={{ fontSize: 11, letterSpacing: 0.5 }}>SELECT START TIME</label>
                  </div>
                  <TimeSlotGrid
                    accentColor={accentColor}
                    bookedRanges={bookedRanges}
                    disabledBefore={disabledBefore}
                    selectedTime={time}
                    onTimeChange={handleTimeChange}
                    pricePerHour={basePrice || fallbackPrice}
                    selectedEndHour={endHour}
                    openingHour={openingHour}
                    closingHour={closingHour}
                  />
                </div>
                {time && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <ChevronDown size={12} style={{ color: accentColor }} />
                      <label className="text-gray-400 font-black" style={{ fontSize: 11, letterSpacing: 0.5 }}>SESSION DURATION</label>
                    </div>
                    <DurationPicker
                      startTime={time}
                      bookedRanges={bookedRanges}
                      pricePerHour={basePrice || fallbackPrice}
                      accentColor={accentColor}
                      selectedDuration={duration}
                      onSelect={handleDurationSelect}
                      minDuration={systemSettings.bookingDurationMin}
                      maxDuration={maxBookingDuration}
                      closingHour={closingHour}
                    />
                  </motion.div>
                )}
                {time && duration > 0 && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl gap-3"
                    style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}30` }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock size={14} style={{ color: accentColor }} className="flex-shrink-0" />
                      <span className="text-white font-black truncate" style={{ fontSize: 13 }}>
                        {fmt12(parseInt(time))} &rarr; {endHour ? fmt12(endHour) : ''}
                      </span>
                    </div>
                    <AnimatePresence mode="wait">
                      <motion.div key={total} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                        className="text-right flex-shrink-0">
                        {addonTotal > 0 && (
                          <p className="text-gray-500 font-black mb-0.5" style={{ fontSize: 9 }}>
                            Court {'\u20B1'}{(basePrice * duration).toLocaleString()} + coaching {'\u20B1'}{computedCoachingFee.toLocaleString()} + add-ons {'\u20B1'}{addonTotal.toLocaleString()}
                          </p>
                        )}
                        <span className="font-black block" style={{ fontSize: 16, color: accentColor }}>
                          {'\u20B1'}{total.toLocaleString()}
                        </span>
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ── Review ── */}
          {!isDone && isReview && (
            <AnimatePresence mode="wait">
              <motion.div key="review" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                {/* Summary card */}
                <div className="rounded-2xl overflow-hidden" style={{ background: `linear-gradient(135deg,${color}20,${accentColor}10)`, border: `1px solid ${color}30` }}>
                  <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}25`, border: `1px solid ${color}40` }}>
                      <SportIcon sport={sport} size={24} color={color} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black" style={{ fontSize: 16 }}>{courtName}</p>
                      <p style={{ fontSize: 12, color, fontWeight: 700 }}>{sport}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black" style={{ fontSize: 26, color: accentColor, lineHeight: 1 }}>{'\u20B1'}{total.toLocaleString()}</p>
                    <p className="text-gray-500" style={{ fontSize: 10 }}>{coachingMode ? 'court + coach' : 'total'}</p>
                    </div>
                  </div>
                  <div className="mx-4 mb-4 p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-gray-500 font-black" style={{ fontSize: 9, letterSpacing: 0.5 }}>START</p>
                        <p className="text-white font-black" style={{ fontSize: 15 }}>{time ? fmt12(parseInt(time)) : '—'}</p>
                      </div>
                      <div className="flex-1 mx-3 flex items-center gap-1">
                        <div className="flex-1 h-px" style={{ background: `${accentColor}40` }} />
                        <div className="px-2 py-0.5 rounded-full font-black" style={{ fontSize: 9, background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}30` }}>{duration}h</div>
                        <div className="flex-1 h-px" style={{ background: `${accentColor}40` }} />
                      </div>
                      <div className="text-center">
                        <p className="text-gray-500 font-black" style={{ fontSize: 9, letterSpacing: 0.5 }}>END</p>
                        <p className="text-white font-black" style={{ fontSize: 15 }}>{endHour ? fmt12(endHour) : '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-gray-500" style={{ fontSize: 10 }}>{dateInfo.label}</span>
                      <span className="font-black" style={{ fontSize: 10, color: accentColor }}>{dateInfo.rateType}</span>
                    </div>
                  </div>
                </div>

                {priceBreakdownPanel}

                {/* Add-ons */}
                {!coachingMode && sportAddons.length > 0 && (
                  <div>
                    <p className="text-gray-400 font-black mb-3" style={{ fontSize: 11, letterSpacing: 0.5 }}>OPTIONAL ADD-ONS</p>
                    <div className="space-y-2">
                      {sportAddons.map(addon => {
                        const isChecked = selectedAddons.has(addon.id);
                        const addonCost = isAddonPerHourPricing(addon) ? addon.price * duration : addon.price;
                        return (
                          <button key={addon.id}
                            onClick={() => setSelectedAddons(prev => { const n = new Set(prev); if (n.has(addon.id)) n.delete(addon.id); else n.add(addon.id); return n; })}
                            className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-all text-left"
                            style={{ background: isChecked ? `${accentColor}12` : 'rgba(255,255,255,0.03)', borderColor: isChecked ? `${accentColor}50` : 'rgba(255,255,255,0.08)' }}>
                            <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all"
                                style={{ borderColor: isChecked ? accentColor : '#555', background: isChecked ? accentColor : 'transparent' }}>
                                {isChecked && <Check size={12} className="text-white" />}
                              </div>
                              <div>
                                <p className="text-white font-black" style={{ fontSize: 14 }}>{addon.label}</p>
                                <p className="text-gray-500" style={{ fontSize: 11 }}>
                                  {isAddonPerHourPricing(addon)
                                    ? `${'\u20B1'}${addon.price.toLocaleString()}/hr × ${duration}h = ${'\u20B1'}${addonCost.toLocaleString()}`
                                    : (addon.note || `Flat ${'\u20B1'}${addon.price.toLocaleString()}`)}
                                </p>
                              </div>
                            </div>
                            <span className="font-black" style={{ fontSize: 14, color: accentColor }}>+{'\u20B1'}{addonCost.toLocaleString()}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Email (customer only) */}
                {mode === 'customer' && !coachingMode && (
                  <div>
                    <label className="text-gray-400 block mb-1.5" style={{ fontSize: 11, fontWeight: 700 }}>EMAIL FOR CONFIRMATION (optional)</label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" type="email"
                        className="w-full rounded-xl pl-9 pr-4 py-3 text-white focus:outline-none"
                        style={{ fontSize: 13, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* ── Confirm (customer only, step 2) ── */}
          {!isDone && isConfirm && (
            <AnimatePresence mode="wait">
              <motion.div key="confirm" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                {/* Mini summary */}
                <div className="flex items-center justify-between p-3 rounded-2xl" style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}25` }}>
                  <div className="flex items-center gap-2">
                    <Clock size={15} style={{ color: accentColor }} />
                    <div>
                      <p className="text-white font-black" style={{ fontSize: 13 }}>{courtName}</p>
                      <p className="text-gray-500" style={{ fontSize: 11 }}>{time && fmt12(parseInt(time))} &ndash; {endHour && fmt12(endHour)}</p>
                    </div>
                  </div>
                  <p className="font-black" style={{ fontSize: 20, color: accentColor }}>{'\u20B1'}{total.toLocaleString()}</p>
                </div>
                {priceBreakdownPanel}
                <PaymongoDownpaymentConfirm
                  totalAmount={total}
                  downpaymentPercentage={systemSettings.downpaymentPercentage}
                  bookingPayload={{
                    court: courtName,
                    sport,
                    booking_date: date,
                    start_time: time,
                    duration_hours: duration,
                    total_price: total,
                    customer_name: coachingMode ? (studentName || user?.name) : user?.name,
                    add_ons: [
                      Array.from(selectedAddons).map(id => {
                        const a = sportAddons.find(x => x.id === id);
                        return a ? formatAddonLinePeso(a, duration).left : id;
                      }).join(' | '),
                      useLoyaltyReward ? `Loyalty ${formatLoyaltyDiscountLabel()} applied` : '',
                      coachingMode ? `Coaching with ${coachName || 'coach'}` : 'Online Booking',
                    ].filter(Boolean).join(' | '),
                    ref_code: refCode.current,
                    facility_map_id: facilityMapId ?? undefined,
                    user_id: user?.id,
                    loyalty_points_redeemed: useLoyaltyReward ? LOYALTY_REWARD_THRESHOLD : 0,
                    loyalty_discount: loyaltyDiscount,
                  }}
                  onCancel={goPrev}
                  pendingCoachingLink={
                    coachingSessionId || coachId
                      ? {
                          coachingSessionId,
                          coachId,
                          coachingStudentId: coachingStudentId || user?.id,
                          coachName,
                          coachHourlyRate,
                          duration,
                          sessionDate: date,
                          startTime: time,
                          courtAmount: courtSubtotal + addonTotal - loyaltyDiscount,
                          coachFee: computedCoachingFee,
                          totalDue: total,
                          refCode: refCode.current,
                          acceptedBy: user?.name || coachName,
                        }
                      : undefined
                  }
                />
              </motion.div>
            </AnimatePresence>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-red-400 font-black" style={{ fontSize: 13 }}>{error}</p>
            </div>
          )}
        </div>

        {/* Footer — hidden on Done and Confirm steps (they have their own buttons) */}
        {!isDone && !isConfirm && (
          <div className="px-5 pb-5 pt-3 flex gap-2.5 border-t border-white/5 flex-shrink-0">
            <button onClick={step === 0 ? onClose : goPrev}
              className="flex-1 py-3 rounded-xl font-black border border-white/10 text-gray-400 hover:text-white transition-colors"
              style={{ fontSize: 14 }}>
              {step === 0 ? 'Cancel' : 'Back'}
            </button>
            <button onClick={goNext}
              className="flex-1 py-3 rounded-xl text-white font-black transition-all flex items-center justify-center gap-2"
              style={{ fontSize: 14, background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`, boxShadow: `0 4px 16px ${accentColor}35` }}>
              {isReview
                ? mode === 'customer'
                  ? <><CreditCard size={16} /> Proceed to Payment</>
                  : <><Check size={16} /> Confirm Walk-In</>
                : <>{isWalkIn ? 'Next' : 'Continue'} <ArrowRight size={15} /></>
              }
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/* ─── Map Time Selector (popup grid, works on all screen sizes) ──── */
function MapTimeSelector({
  selectedTime, onSelect, accentColor = '#FF8C00',
}: { selectedTime: string; onSelect: (t: string) => void; accentColor?: string }) {
  const [open, setOpen] = useState(false);
  const hours   = Array.from({ length: 17 }, (_, i) => i + 6);
  const selHour = parseInt(selectedTime.split(':')[0]) || 7;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-black flex-shrink-0 transition-all"
        style={{ fontSize: 11, background: `${accentColor}15`, color: accentColor, border: `1px solid ${accentColor}40` }}
      >
        <Clock size={11} className="flex-shrink-0" />
        <span>{fmtLabel(selHour)}</span>
        <ChevronDown size={10} />
      </button>

      {/* Bottom-sheet time picker — works on all screen sizes */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[60]" onClick={() => setOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl"
              style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none', maxHeight: '60vh' }}>
              <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-white/20" /></div>
              <div className="flex items-center justify-between px-5 pb-3">
                <p className="text-white font-black" style={{ fontSize: 14 }}>Select View Time</p>
                <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8">
                  <X size={14} />
                </button>
              </div>
              <div className="px-4 pb-6 grid grid-cols-4 gap-2 overflow-y-auto" style={{ maxHeight: '45vh' }}>
                {hours.map(h => {
                  const tStr   = `${String(h).padStart(2,'0')}:00`;
                  const active = tStr === selectedTime;
                  return (
                    <button key={h} onClick={() => { onSelect(tStr); setOpen(false); }}
                      className="py-3 rounded-2xl font-black transition-all"
                      style={{ fontSize: 12, background: active ? accentColor : 'rgba(255,255,255,0.06)', color: active ? 'white' : '#888', boxShadow: active ? `0 4px 14px ${accentColor}50` : 'none', border: `1px solid ${active ? accentColor : 'transparent'}` }}>
                      {fmtLabel(h)}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ─── Main Viewer ─────────────────────────────────────────────────── */
interface FacilityMapViewerProps {
  mode: 'customer' | 'staff';
  compact?: boolean;
  prefill?: {
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
  };
  selectedMapId?: string | null;
  onMapChange?: (mapId: string | null) => void;
  onExitCoachingReservation?: () => void;
}

export function FacilityMapViewer({ mode, compact = false, prefill, selectedMapId, onMapChange, onExitCoachingReservation }: FacilityMapViewerProps) {
  const { maps, getCourtLiveStatus, isLoading: mapsLoading } = useFacilityMap();
  const { customSports } = useAddons();
  const { createDeskBooking } = useBookingAPI();
  const { bookings, addBooking, user, calcCourtPrice, refreshBookingsFromApi, updateUser } = useUser();

  const publishedMaps = maps.filter(m => m.isPublished);
  const [selectedMapIdx, setSelectedMapIdx] = useState(0);
  const activeMap = publishedMaps[selectedMapIdx] ?? null;

  const isControlledMap = selectedMapId !== undefined;

  useEffect(() => {
    if (!isControlledMap) return;
    if (!selectedMapId) {
      if (selectedMapIdx !== 0) setSelectedMapIdx(0);
      return;
    }
    const idx = publishedMaps.findIndex(m => m.id === selectedMapId);
    if (idx >= 0 && idx !== selectedMapIdx) setSelectedMapIdx(idx);
  }, [isControlledMap, selectedMapId, publishedMaps, selectedMapIdx]);

  useEffect(() => {
    if (selectedMapIdx >= publishedMaps.length && publishedMaps.length > 0) setSelectedMapIdx(0);
  }, [publishedMaps.length]);

  const containerRef = useRef<HTMLDivElement>(null);
  const now = new Date();
  const todayStr = getLocalDateString(now);

  const [selectedDate, setSelectedDate] = useState(prefill?.date || todayStr);
  const [selectedTime, setSelectedTime] = useState(prefill?.time || `${String(now.getHours()).padStart(2,'0')}:00`);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const selectedHour = parseInt(selectedTime.split(':')[0]) || 7;
  const isCoachReservation = !!(prefill?.coachingSessionId || prefill?.coachId);
  const accentMap = isCoachReservation ? '#2563EB' : mode === 'staff' ? '#0047AB' : '#FF8C00';

  const [hoveredId,    setHoveredId]    = useState<string | null>(null);
  const [bookingCourt, setBookingCourt] = useState<{ name: string; sport: string } | null>(null);
  const [successFlash, setSuccessFlash] = useState<string | null>(null);
  const [showCoachExitModal, setShowCoachExitModal] = useState(false);

  const processedPrefill = useRef<string | null>(null);

  useEffect(() => {
    if (prefill && publishedMaps.length > 0) {
      const sig = `${prefill.sport}-${prefill.date}-${prefill.time}-${prefill.coachingSessionId || prefill.coachId || ''}`;
      if (processedPrefill.current !== sig) {
        processedPrefill.current = sig;
        if (prefill.date) setSelectedDate(prefill.date);
        if (prefill.time) setSelectedTime(prefill.time);
        if (prefill.sport && !bookingCourt) {
          let foundMapIdx = selectedMapIdx;
          let court = activeMap?.blocks.find(b => b.sport === prefill.sport);
          
          if (!court) {
            for (let i = 0; i < publishedMaps.length; i++) {
              const c = publishedMaps[i].blocks.find(b => b.sport === prefill.sport);
              if (c) {
                foundMapIdx = i;
                court = c;
                break;
              }
            }
          }
          
          if (foundMapIdx !== selectedMapIdx) setSelectedMapIdx(foundMapIdx);
          // We do not auto-open the booking modal here so the user can choose which court to click on.
        }
      }
    }
  }, [prefill, publishedMaps, activeMap, bookingCourt, selectedMapIdx]);

  /* Zoom / pan */
  const [zoom, setZoom]         = useState(1);
  const [pan, setPan]           = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, px: 0, py: 0 });
  const lastPinchDist = useRef(0);

  const publishedLayout = activeMap?.blocks ?? [];
  const canvasW = activeMap?.canvasW ?? 960;
  const canvasH = activeMap?.canvasH ?? 450;

  const fitView = useCallback(() => {
    const el = containerRef.current;
    if (!el || !activeMap) return;
    const { width: cw, height: ch } = el.getBoundingClientRect();
    if (!cw || !ch) return;
    const pad = 16;
    const nz = clamp(Math.min((cw - pad*2)/canvasW, (ch - pad*2)/canvasH), MIN_ZOOM, MAX_ZOOM);
    setZoom(nz);
    setPan({ x: (cw - canvasW*nz)/2, y: (ch - canvasH*nz)/2 });
  }, [activeMap, canvasW, canvasH]);

  useEffect(() => { const t = setTimeout(() => requestAnimationFrame(fitView), 80); return () => clearTimeout(t); }, [selectedMapIdx, fitView]);

  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const f = e.deltaY < 0 ? 1.1 : 1/1.1;
      setZoom(z => { const nz = clamp(z*f, MIN_ZOOM, MAX_ZOOM); setPan(p => ({ x: mx-(mx-p.x)*(nz/z), y: my-(my-p.y)*(nz/z) })); return nz; });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [selectedMapIdx]);

  const handleMouseDown = (e: React.MouseEvent) => { if (e.button !== 0) return; setIsDragging(true); setDragStart({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }); };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging) return; setPan({ x: dragStart.px+(e.clientX-dragStart.x), y: dragStart.py+(e.clientY-dragStart.y) }); };
  const handleMouseUp = () => setIsDragging(false);

  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { if (e.touches.length === 1) lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const t = e.touches;
      const dx = t[0].clientX-t[1].clientX, dy = t[0].clientY-t[1].clientY;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if (lastPinchDist.current > 0) {
        const f = dist/lastPinchDist.current;
        const mx = (t[0].clientX+t[1].clientX)/2, my = (t[0].clientY+t[1].clientY)/2;
        const r = containerRef.current!.getBoundingClientRect();
        const lx = mx-r.left, ly = my-r.top;
        setZoom(z => { const nz = clamp(z*f, MIN_ZOOM, MAX_ZOOM); setPan(p => ({ x: lx-(lx-p.x)*(nz/z), y: ly-(ly-p.y)*(nz/z) })); return nz; });
      }
      lastPinchDist.current = dist;
    } else if (e.touches.length === 1 && lastTouchRef.current) {
      const dx = e.touches[0].clientX-lastTouchRef.current.x, dy = e.touches[0].clientY-lastTouchRef.current.y;
      setPan(p => ({ x: p.x+dx, y: p.y+dy }));
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchEnd = () => { lastPinchDist.current = 0; lastTouchRef.current = null; };

  const courtStatuses = useMemo(() => {
    const map: Record<string, LiveStatus> = {};
    publishedLayout.forEach(b => { map[b.id] = getCourtLiveStatus(b.name, selectedHour, bookings, activeMap?.id, selectedDate); });
    return map;
  }, [publishedLayout, getCourtLiveStatus, selectedHour, selectedDate, bookings, activeMap?.id]);

  const stats = useMemo(() => {
    const relevantIds = isCoachReservation
      ? publishedLayout.filter((b) => b.sport === prefill?.sport).map((b) => b.id)
      : publishedLayout.map((b) => b.id);
    const statuses = relevantIds.map((id) => courtStatuses[id]).filter(Boolean);
    return {
      available: statuses.filter(s => s === 'available').length,
      occupied: statuses.filter(s => s === 'occupied').length,
      maintenance: statuses.filter(s => s === 'maintenance').length,
    };
  }, [courtStatuses, isCoachReservation, prefill?.sport, publishedLayout]);

  const hoveredBlock  = publishedLayout.find(b => b.id === hoveredId) ?? null;
  const hoveredStatus = hoveredId
    ? (isCoachReservation && hoveredBlock?.sport !== prefill?.sport ? 'maintenance' : courtStatuses[hoveredId])
    : null;

  const tooltipPos = useMemo(() => {
    if (!hoveredBlock || !containerRef.current) return null;
    const { width: cw, height: ch } = containerRef.current.getBoundingClientRect();
    if (!cw || !ch) return null;
    const cx = pan.x + hoveredBlock.x*zoom, cy = pan.y + hoveredBlock.y*zoom;
    const cw2 = hoveredBlock.width*zoom, ch2 = hoveredBlock.height*zoom;
    const tipW = 220, tipH = 185;
    let tx = cx+cw2+10; if (tx+tipW > cw-4) tx = cx-tipW-10;
    tx = Math.max(4, Math.min(cw-tipW-4, tx));
    let ty = cy+ch2/2-tipH/2;
    ty = Math.max(4, Math.min(ch-tipH-4, ty));
    return { x: tx, y: ty };
  }, [hoveredBlock, pan.x, pan.y, zoom]);

  const hoveredBookingInfo = useMemo<Booking | null>(() => {
    if (!hoveredBlock || !hoveredId) return null;
    const matching = bookings.filter(b => {
      if (b.date !== selectedDate || b.status === 'cancelled' || b.status === 'completed' || b.status === 'rejected') return false;
      return bookingAppliesToPublishedMap(b, hoveredBlock.name, activeMap?.id, publishedMaps);
    });
    return matching.find(b => { const bH = parseInt(b.time.split(':')[0]); return selectedHour >= bH && selectedHour < bH+(b.duration||1); }) || null;
  }, [hoveredBlock, hoveredId, bookings, selectedDate, selectedHour, activeMap?.id, publishedMaps]);

  const getCourtBookings = (courtName: string): Booking[] =>
    bookings.filter(b => {
      if (b.status === 'cancelled' || b.status === 'rejected' || b.status === 'completed') return false;
      return bookingAppliesToPublishedMap(b, courtName, activeMap?.id, publishedMaps);
    });

  const handleConfirmBooking = async (details: {
    court: string; sport: string; date: string; time: string; duration: number;
    addOns: string; paymentMethod: string; refCode: string;
    customerName?: string; customerPhone?: string; amount: number;
    addonIds?: string[];
    loyaltyPointsRedeemed?: number;
    loyaltyDiscount?: number;
  }) => {
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const staffId = user?.id && uuidRe.test(user.id) ? user.id : undefined;
    const payload = {
      court: details.court,
      sport: details.sport,
      booking_date: details.date,
      start_time: details.time,
      duration_hours: details.duration,
      total_price: details.amount,
      customer_name: details.customerName || prefill?.coachingStudentName || user?.name || 'Customer',
      customer_phone: details.customerPhone,
      payment_method: details.paymentMethod === 'gcash' ? 'gcash' : 'cash',
      source: isCoachReservation ? 'map_coaching_request' : mode === 'staff' ? 'map_staff' : 'map_customer',
      ref_code: details.refCode,
      add_ons: details.addOns,
      staff_id: staffId,
      user_id: mode !== 'staff' ? user?.id : undefined,
      loyalty_points_redeemed: details.loyaltyPointsRedeemed || 0,
      loyalty_discount: details.loyaltyDiscount || 0,
      ...(activeMap?.id ? { facility_map_id: activeMap.id } : {}),
    };
    try {
      const out = await createDeskBooking(payload);
      addBooking(out.booking as unknown as Booking);
      if (user?.id && (details.loyaltyPointsRedeemed || 0) > 0) {
        updateUser(user.id, { loyaltyPoints: Math.max(0, Number(user.loyaltyPoints || 0) - Number(details.loyaltyPointsRedeemed || 0)) });
      }
      if (prefill?.coachingSessionId) {
        try {
          const coachFee = Math.max(0, Number(prefill.coachHourlyRate || 0)) * Math.max(1, Number(prefill.durationHours || details.duration || 1));
          const courtAmount = Math.max(0, Number(details.amount || 0));
          const totalDue = details.amount;
          const acceptanceDetails = {
            linkedBookingId: out.booking?.id,
            court: details.court,
            courtAmount,
            coachFee,
            totalDue,
            courtPaidBy: 'student',
            coachCourtQr: details.refCode,
            acceptedBy: user?.name || prefill.coachName || 'Coach',
          };
          await apiFetch(`/api/coaching-sessions/${encodeURIComponent(prefill.coachingSessionId)}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'confirmed',
              admin_notes: `COACHING_ACCEPTANCE:${JSON.stringify(acceptanceDetails)}`,
            }),
          });
          window.dispatchEvent(new Event('sportsync:coaching-refresh'));
          window.dispatchEvent(new Event('sportsync:notifications-refresh'));
        } catch (linkErr) {
          console.error('[FacilityMapViewer] coaching session link failed', linkErr);
        }
      } else if (prefill?.coachId) {
        try {
          const startHour = parseInt(details.time.split(':')[0], 10);
          const endTime = `${String(startHour + details.duration).padStart(2, '0')}:00:00`;
          await apiFetch('/api/coaching-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              coach_id: prefill.coachId,
              user_id: prefill.coachingStudentId || user?.id,
              session_date: details.date,
              start_time: `${details.time}:00`,
              end_time: endTime,
              status: 'pending',
              linked_booking_id: out.booking?.id,
              payment_proof_url: `COACHING_BOOKING:${JSON.stringify({
                linkedBookingId: out.booking?.id,
                court: details.court,
                courtAmount: Math.max(0, Number(details.amount || 0) - Math.max(0, Number(prefill.coachHourlyRate || 0)) * Math.max(1, Number(details.duration || 1))),
                coachFee: Math.max(0, Number(prefill.coachHourlyRate || 0)) * Math.max(1, Number(details.duration || 1)),
                totalDue: details.amount,
                paidBy: 'student',
                bookingQr: details.refCode,
              })}`,
            }),
          });
          window.dispatchEvent(new Event('sportsync:coaching-refresh'));
          window.dispatchEvent(new Event('sportsync:notifications-refresh'));
        } catch (linkErr) {
          console.error('[FacilityMapViewer] coaching request creation failed', linkErr);
          throw linkErr;
        }
      }
      await refreshBookingsFromApi();
    } catch (err) {
      console.error('[FacilityMapViewer] desk booking failed, using local copy', err);
      addBooking({
        id: `BK${Date.now()}`,
        sport: details.sport,
        date: details.date,
        time: details.time,
        duration: details.duration,
        court: details.court,
        status: mode === 'staff' ? 'checked_in' : 'pending_payment',
        amount: details.amount,
        paymentStatus: mode === 'staff' ? 'paid' : 'pending',
        createdAt: new Date().toISOString(),
        customerName: details.customerName || user?.name || 'Customer',
        customerPhone: details.customerPhone,
        addOns: details.addOns,
        refCode: details.refCode,
        checkInStatus: mode === 'staff' ? 'checked_in' : 'none',
        facilityMapId: activeMap?.id,
        userId: mode === 'customer' ? user?.id : undefined,
      });
    }
    setSuccessFlash(isCoachReservation ? `${details.court} reserved for coaching!` : `${details.court} booked!`);
    setTimeout(() => setSuccessFlash(null), 4000);
  };

  const dateChips = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate()+i);
    const dateStr = getLocalDateString(d);
    const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { dateStr, label };
  });

  if (mapsLoading && maps.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#0D0D0D] items-center justify-center gap-4 p-8">
        <div className="animate-spin rounded-full h-12 w-12 border border-orange-500 border-t-transparent" />
        <p className="text-gray-400 font-black" style={{ fontSize: 12 }}>Loading facility maps...</p>
      </div>
    );
  }

  if (publishedMaps.length === 0) {
    return (
      <div className="flex flex-col h-full bg-[#0D0D0D] items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.15)' }}>
          <MapPinOff size={28} style={{ color: '#FF8C00' }} />
        </div>
        <div className="text-center">
          <p className="text-white font-black" style={{ fontSize: 16 }}>No Facility Maps Published</p>
          <p className="text-gray-500 mt-1" style={{ fontSize: 13 }}>An admin needs to create and publish a facility map first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#0D0D0D]" style={{ height: '100%', overflow: 'hidden' }}>

      {/* Multi-map selector */}
      {publishedMaps.length > 1 && (
        <div className="flex items-center gap-1 px-3 py-2 bg-[#111] border-b border-white/8 flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <Building2 size={11} className="text-gray-600 flex-shrink-0 mr-1" />
          {publishedMaps.map((m, i) => (
            <button key={m.id} onClick={() => {
              setSelectedMapIdx(i);
              onMapChange?.(m.id);
            }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg font-black flex-shrink-0 transition-all"
              style={{
                fontSize: 11,
                background: selectedMapIdx === i ? (mode === 'staff' ? 'rgba(0,71,171,0.15)' : 'rgba(255,140,0,0.12)') : 'transparent',
                color: selectedMapIdx === i ? (mode === 'staff' ? '#60a5fa' : '#FF8C00') : '#555',
                border: selectedMapIdx === i ? `1px solid ${mode === 'staff' ? 'rgba(0,71,171,0.3)' : 'rgba(255,140,0,0.25)'}` : '1px solid transparent',
              }}>
              <MapIcon size={10} /><span>{m.name}</span>
              <span className="text-gray-600" style={{ fontSize: 9 }}>· {m.branch}</span>
            </button>
          ))}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#111] border-b border-white/8 flex-shrink-0 flex-wrap">
        {activeMap && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MapIcon size={12} className="text-gray-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-white font-black truncate" style={{ fontSize: 12 }}>{activeMap.name}</p>
              <p className="text-gray-600 truncate" style={{ fontSize: 10 }}>{activeMap.location}</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          {[
            { v: stats.available,   color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'Avail'  },
            { v: stats.occupied,    color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Busy'   },
            { v: stats.maintenance, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Maint'  },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1 px-2 py-1 rounded-lg border" style={{ background: s.bg, borderColor: `${s.color}30` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
              <span className="font-black" style={{ fontSize: 10, color: s.color }}>{s.v}</span>
              <span className="text-gray-600" style={{ fontSize: 9 }}>{s.label}</span>
            </div>
          ))}
        </div>
        {isCoachReservation ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2563EB]/15 border border-[#2563EB]/30">
            <SportIcon sport={prefill?.sport || 'Sports'} size={10} color="#93c5fd" strokeWidth={2.4} />
            <span className="font-black text-[#93c5fd]" style={{ fontSize: 10 }}>COACH RESERVATION{prefill?.sport ? ` · ${prefill.sport}` : ''}</span>
          </div>
        ) : mode === 'staff' ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0047AB]/20 border border-[#0047AB]/30">
            <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="font-black text-[#60a5fa]" style={{ fontSize: 10 }}>LIVE OPS</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF8C00]/10 border border-[#FF8C00]/20">
            <CalendarDays size={10} className="text-[#FF8C00]" />
            <span className="font-black text-[#FF8C00]" style={{ fontSize: 10 }}>BOOKING MAP</span>
          </div>
        )}
      </div>

      {isCoachReservation && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-3 py-2 border-b border-[#2563EB]/20 flex-shrink-0"
          style={{ background: 'rgba(37,99,235,0.08)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.18)' }}>
              <Shield size={14} className="text-[#93c5fd]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-black truncate" style={{ fontSize: 12 }}>Coaching Session Booking for {prefill?.coachingStudentName || 'student'}</p>
              <p className="text-[#93c5fd] truncate" style={{ fontSize: 10 }}>Only {prefill?.sport || 'matching sport'} courts are available in this view.</p>
            </div>
            {onExitCoachingReservation && (
              <button
                type="button"
                onClick={() => setShowCoachExitModal(true)}
                className="px-3 py-2 rounded-xl font-black text-[#93c5fd] flex-shrink-0 hover:bg-white/8 transition-all"
                style={{ fontSize: 11, border: '1px solid rgba(147,197,253,0.25)' }}
              >
                Exit
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Date + Time - two pill buttons, never overflow on any screen size */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#0D0D0D] border-b border-white/5 flex-shrink-0">
        {/* Date pill — opens bottom-sheet calendar */}
        <button onClick={() => setShowDatePicker(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-black transition-all flex-1 min-w-0"
          style={{ fontSize: 11, background: `${accentMap}15`, color: accentMap, border: `1px solid ${accentMap}40` }}>
          <CalendarDays size={11} className="flex-shrink-0" />
          <span className="truncate">
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <ChevronDown size={10} className="ml-auto flex-shrink-0" />
        </button>

        {/* Time pill */}
        <MapTimeSelector selectedTime={selectedTime} onSelect={setSelectedTime} accentColor={accentMap} />
      </div>

      {/* MAP */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 z-[30] flex flex-col items-center gap-1">
          <button onClick={() => setZoom(z => clamp(z*1.2, MIN_ZOOM, MAX_ZOOM))}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
            style={{ background: 'rgba(18,18,18,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}><ZoomIn size={13} /></button>
          <button onClick={() => requestAnimationFrame(fitView)}
            className="w-8 rounded-xl py-1 text-center font-black hover:text-white transition-all"
            style={{ fontSize: 9, color: '#555', background: 'rgba(18,18,18,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}>FIT</button>
          <button onClick={() => setZoom(z => clamp(z/1.2, MIN_ZOOM, MAX_ZOOM))}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all"
            style={{ background: 'rgba(18,18,18,0.95)', border: '1px solid rgba(255,255,255,0.12)' }}><ZoomOut size={13} /></button>
          <div className="w-8 rounded-xl py-0.5 text-center pointer-events-none" style={{ fontSize: 9, color: '#444', background: 'rgba(14,14,14,0.7)' }}>{Math.round(zoom*100)}%</div>
        </div>

        {/* Success flash */}
        <AnimatePresence>
          {successFlash && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-green-500 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none">
              <CheckCircle size={15} />
              <span className="font-black" style={{ fontSize: 12 }}>{successFlash}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Court hover tooltip */}
        <AnimatePresence>
          {hoveredBlock && hoveredStatus && tooltipPos && (
            <motion.div key={hoveredBlock.id}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="absolute z-10 rounded-2xl p-3.5 pointer-events-none"
              style={{ left: tooltipPos.x, top: tooltipPos.y, background: 'rgba(20,20,20,0.97)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 28px rgba(0,0,0,0.6)', width: 220 }}>
              {(() => {
                const hoveredColor = resolveCourtSportColor(hoveredBlock, customSports);
                return (
              <>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${hoveredColor}20` }}>
                  <SportIcon sport={hoveredBlock.sport} size={16} color={hoveredColor} strokeWidth={2} />
                </div>
                <div>
                  <span className="text-white font-black" style={{ fontSize: 13 }}>{hoveredBlock.name}</span>
                  <p style={{ fontSize: 10, color: hoveredColor, fontWeight: 700 }}>{hoveredBlock.sport}</p>
                </div>
                <div className="ml-auto">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[hoveredStatus].fill}20` }}>
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_COLORS[hoveredStatus].fill }} />
                    <span className="font-black" style={{ fontSize: 9, color: STATUS_COLORS[hoveredStatus].fill }}>{STATUS_COLORS[hoveredStatus].label}</span>
                  </div>
                </div>
              </div>
              {mode === 'staff' && hoveredStatus === 'occupied' && hoveredBookingInfo && (
                <div className="mt-1 pt-2 border-t border-white/8 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <User size={10} className="text-gray-500" />
                    <span className="text-white font-black" style={{ fontSize: 11 }}>{hoveredBookingInfo.customerName || 'Customer'}</span>
                    {hoveredBookingInfo.checkInStatus === 'checked_in' && <span className="text-green-400 font-black" style={{ fontSize: 9 }}>Checked In</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={10} className="text-gray-500" />
                    <span className="text-gray-300" style={{ fontSize: 10 }}>
                      {(() => { const [bH] = hoveredBookingInfo.time.split(':').map(Number); return `${fmt12(bH)} – ${fmt12(bH+(hoveredBookingInfo.duration||1))}`; })()}
                    </span>
                  </div>
                  {hoveredBookingInfo.refCode && (
                    <div className="flex items-center gap-1.5"><QrCode size={10} className="text-gray-500" /><span className="text-gray-500" style={{ fontSize: 9 }}>{hoveredBookingInfo.refCode}</span></div>
                  )}
                </div>
              )}
              {hoveredStatus === 'available' && (
                <div className="flex items-center gap-1.5 mt-2">
                  <ArrowRight size={10} style={{ color: '#22c55e' }} />
                  <p className="text-green-400 font-black" style={{ fontSize: 10 }}>{isCoachReservation ? 'Tap to reserve for coaching' : mode === 'customer' ? 'Tap to book this court' : 'Tap to add walk-in'}</p>
                </div>
              )}
              <p className="text-gray-600 mt-1" style={{ fontSize: 9 }}>{SPORTS_INFO.find(s => s.name === hoveredBlock.sport)?.priceLabel || 'Custom rate'}</p>
              </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* SVG canvas */}
        <div ref={containerRef} className="w-full h-full"
          style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none', overflow: 'hidden' }}
          onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <svg width="100%" height="100%" style={{ display: 'block', userSelect: 'none' }}>
            {publishedLayout.length === 0 && (console.log('[SVG] publishedLayout is EMPTY! activeMap:', activeMap?.name, 'blocks:', activeMap?.blocks), null)}
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              <rect width={canvasW} height={canvasH} fill="#111111" />
              <defs>
                <pattern id="vgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="40" cy="40" r="0.6" fill="#1e1e1e" />
                </pattern>
                {FACILITY_COURT_SHEEN_GRADIENT}
              </defs>
              <rect width={canvasW} height={canvasH} fill="url(#vgrid)" />
              <rect x="2" y="2" width={canvasW-4} height={canvasH-4} fill="none" stroke="#2a2a2a" strokeWidth="2" rx="4" strokeDasharray="8 4" />

              {publishedLayout.map(b => {
                const sportLocked = isCoachReservation && b.sport !== prefill?.sport;
                const liveStatus = sportLocked ? 'maintenance' : courtStatuses[b.id] || 'available';
                const sportColor = resolveCourtSportColor(b, customSports);
                const courtColors = sportLocked ? { fill: '#374151', stroke: '#4b5563', label: 'Unavailable' } : getCourtColors(liveStatus, sportColor);
                const isHovered   = hoveredId === b.id;
                const isClickable = liveStatus === 'available' && !sportLocked;
                const clipId = `court-clip-${String(b.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                return (
                  <g key={b.id}
                    style={{ cursor: isClickable ? 'pointer' : liveStatus === 'maintenance' ? 'not-allowed' : 'default' }}
                    onMouseEnter={e => { e.stopPropagation(); setHoveredId(b.id); }}
                    onMouseLeave={e => { e.stopPropagation(); setHoveredId(null); }}
                    onClick={e => { e.stopPropagation(); if (!isClickable) return; setBookingCourt({ name: b.name, sport: b.sport }); }}>
                    {isHovered && isClickable && (
                      <rect x={b.x-6} y={b.y-6} width={b.width+12} height={b.height+12}
                        fill={`${courtColors.fill}25`} stroke={courtColors.fill} strokeWidth="1.5" rx="13" opacity="0.7" />
                    )}
                    <rect x={b.x} y={b.y} width={b.width} height={b.height}
                      fill={courtColors.fill}
                      opacity={liveStatus === 'maintenance' ? 0.22 : liveStatus === 'occupied' ? 0.82 : isHovered ? 0.92 : FACILITY_COURT_FILL_OPACITY}
                      stroke={courtColors.stroke} strokeWidth={isHovered ? 2.5 : 1.5} rx="8" />
                    <clipPath id={clipId}>
                      <rect x={b.x} y={b.y} width={b.width} height={b.height} rx="8" />
                    </clipPath>
                    <g clipPath={`url(#${clipId})`}>
                      <rect x={b.x} y={b.y} width={b.width} height={b.height} fill="url(#facilityCourtSheen)" opacity={liveStatus === 'maintenance' ? 0.2 : FACILITY_COURT_SHEEN_OPACITY} />
                      {liveStatus !== 'maintenance' && (
                        <FacilityMapCourtMarkings block={b} locked={sportLocked} />
                      )}
                    </g>
                    {isHovered && isClickable && (
                      <rect x={b.x + 4} y={b.y + 4} width={b.width - 8} height={b.height - 8} fill="none" stroke="white" strokeWidth="1" rx="6" opacity="0.25" strokeDasharray="6 5" />
                    )}
                    {b.width >= 50 && b.height >= 36 && (
                      <text x={b.x+b.width/2} y={b.y+b.height/2-(b.height>70?8:0)}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="white" fontSize={b.width>150?12:9} fontWeight="800" opacity="0.95"
                        pointerEvents="none" style={{ userSelect: 'none' }}>{b.name}</text>
                    )}
                    {b.height > 65 && b.width >= 50 && (
                      <text x={b.x+b.width/2} y={b.y+b.height/2+10}
                        textAnchor="middle" dominantBaseline="middle"
                        fill="white" fontSize={b.width>150?9:7} opacity="0.6"
                        pointerEvents="none" style={{ userSelect: 'none' }}>
                        {sportLocked ? 'SPORT LOCKED' : liveStatus === 'maintenance' ? 'MAINT.' : liveStatus === 'occupied' ? 'OCCUPIED' : 'AVAIL.'}
                      </text>
                    )}
                    {mode === 'staff' && liveStatus === 'occupied' && (
                      <rect x={b.x+3} y={b.y+3} width={b.width-6} height={b.height-6}
                        fill="none" stroke="#ef4444" strokeWidth="2" rx="6" opacity="0.5">
                        <animate attributeName="opacity" values="0.5;0.9;0.5" dur="1.8s" repeatCount="indefinite" />
                      </rect>
                    )}
                    {mode === 'customer' && isHovered && isClickable && (
                      <g>
                        <circle cx={b.x+b.width-13} cy={b.y+13} r="10" fill="#22c55e" opacity="0.95" />
                        <text x={b.x+b.width-13} y={b.y+13} textAnchor="middle" dominantBaseline="middle"
                          fill="white" fontSize="13" fontWeight="800" pointerEvents="none">+</text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#111] border-t border-white/8 flex-shrink-0 flex-wrap">
        <span className="text-gray-700 font-black" style={{ fontSize: 9 }}>Court markings + colors = sport type</span>
        <div className="w-px h-3 bg-white/8 flex-shrink-0" />
        {[
          { color: '#22c55e', label: isCoachReservation ? 'Matching sport available' : mode === 'customer' ? 'Available - tap to book' : 'Available' },
          { color: '#dc2626', label: 'Occupied' },
          { color: '#4b5563', label: isCoachReservation ? 'Other sports unavailable' : 'Maintenance' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
            <span className="text-gray-500" style={{ fontSize: 10 }}>{l.label}</span>
          </div>
        ))}
        <div className="ml-auto text-gray-700 hidden sm:block" style={{ fontSize: 9 }}>Scroll to zoom · Drag to pan</div>
        <div className="ml-auto text-gray-700 sm:hidden" style={{ fontSize: 9 }}>Pinch to zoom · Drag to pan</div>
        {mode === 'staff' && (
          <div className="flex items-center gap-1.5">
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-gray-500" style={{ fontSize: 9 }}>Live</span>
          </div>
        )}
      </div>

      {/* Full date picker overlay */}
      <AnimatePresence>
        {showDatePicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-end sm:items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setShowDatePicker(false); }}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="bg-[#1A1A1A] rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl border border-white/10 w-full sm:w-80 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white font-black" style={{ fontSize: 14 }}>Pick a Date</p>
                <button onClick={() => setShowDatePicker(false)} className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/8"><X size={14} /></button>
              </div>
              <InlineCalendar selectedDate={selectedDate} onDateChange={d => { setSelectedDate(d); setShowDatePicker(false); }} minDate={todayStr} accentColor={accentMap} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Booking Modal */}
      <AnimatePresence>
        {showCoachExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[80] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowCoachExitModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-white/10 p-5"
              style={{ background: '#181818' }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(37,99,235,0.16)' }}>
                <Shield size={22} className="text-[#93c5fd]" />
              </div>
              <p className="text-white font-black" style={{ fontSize: 18 }}>Exit coach reservation?</p>
              <p className="text-gray-400 mt-2" style={{ fontSize: 13, lineHeight: 1.55 }}>
                This will leave the sport-locked court view and return you to My Coaching. Your pending request will still be waiting there.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-5">
                <button
                  onClick={() => setShowCoachExitModal(false)}
                  className="py-3 rounded-2xl text-gray-300 font-black"
                  style={{ background: 'rgba(255,255,255,0.07)', fontSize: 13 }}
                >
                  Stay
                </button>
                <button
                  onClick={() => {
                    setShowCoachExitModal(false);
                    onExitCoachingReservation?.();
                  }}
                  className="py-3 rounded-2xl text-white font-black"
                  style={{ background: 'linear-gradient(135deg,#2563EB,#1d4ed8)', fontSize: 13 }}
                >
                  Exit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {bookingCourt && (
          <BookingModal
            courtName={bookingCourt.name}
            sport={bookingCourt.sport}
            mode={mode}
            courtBookings={getCourtBookings(bookingCourt.name)}
            onClose={() => setBookingCourt(null)}
            onConfirm={handleConfirmBooking}
            initialDate={selectedDate}
            initialTime={selectedTime}
            coachingMode={isCoachReservation}
            coachName={prefill?.coachName || user?.name}
            coachHourlyRate={prefill?.coachHourlyRate}
            studentName={prefill?.coachingStudentName}
            coachingSessionId={prefill?.coachingSessionId}
            coachingStudentId={prefill?.coachingStudentId}
            coachId={prefill?.coachId}
            facilityMapId={activeMap?.id ?? null}
            onDone={isCoachReservation ? onExitCoachingReservation : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
