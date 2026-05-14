import { useState, useEffect, useRef, Fragment, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  format, startOfToday, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameDay,
  isSameMonth, isBefore, addMonths, subMonths, parseISO
} from "date-fns";
import {
  CheckCircle, Loader2, ChevronLeft, ChevronRight,
  Clock, User, CreditCard, CalendarDays, Info, AlertTriangle,
  ArrowRight, Check, X, Building2
} from "lucide-react";
import { useUser } from "../../contexts/UserContext";
import { useCoaching } from "../../contexts/CoachingContext";
import { useAddons } from "../../contexts/AddonsContext";
import { useBookingAPI } from "../../hooks/useBookingAPI";
import { SportIcon, getSportColor } from "../SportIcons";
import { getDynamicPrice, RATE_CARD, SPORTS_INFO, type AddOn } from "../sportsData";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

const SPORTS = [
  { name: "Basketball" },
  { name: "Volleyball" },
  { name: "Badminton" },
  { name: "Pickleball" },
  { name: "Billiards" },
  { name: "Table Tennis" },
];

// 7AM – 11PM = 17 slots (each slot = 1 hr block starting at that time)
const TIME_SLOTS = [
  "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM",
  "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM",
  "08:00 PM", "09:00 PM", "10:00 PM",
];

// The "leave at" label one step after each slot (for displaying end time)
const END_TIME_LABELS = [
  ...TIME_SLOTS.slice(1), "12:00 MN",
];

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5628f883`;

const generateDemoBookings = (dateStr: string, sport: string): string[] => {
  let hash = 0;
  const str = dateStr + sport + "jrc_demo_v1";
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  const slots: string[] = [];
  const numSlots = (Math.abs(hash) % 4) + 2;
  let currentHash = Math.abs(hash);
  for (let i = 0; i < numSlots; i++) {
    const index = currentHash % TIME_SLOTS.length;
    slots.push(TIME_SLOTS[index]);
    currentHash = (currentHash * 1664525 + 1013904223) % 4294967296;
  }
  return slots;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Given a selected start slot + booked slots, compute valid end time options.
// End time = the moment you LEAVE (so occupying d slots = startIdx → startIdx+d-1).
// Stops before the first booked slot after start.
function getEndTimeOptions(
  startSlot: string,
  bookedSlots: string[],
  sport: string,
  date: Date,
  timeSlots: string[] = TIME_SLOTS
) {
  const startIdx = timeSlots.indexOf(startSlot);
  if (startIdx === -1) return [];

  const options: {
    endTimeLabel: string;
    duration: number;
    totalPrice: number;
    lastSlotIdx: number;
  }[] = [];

  for (let d = 1; startIdx + d <= timeSlots.length; d++) {
    const lastSlotIdx = startIdx + d - 1;
    // d > 1: check whether the additional slot is booked
    if (d > 1 && bookedSlots.includes(timeSlots[lastSlotIdx])) break;
    
    // Compute end time string assuming 1 hr duration per slot
    const parse = (t: string) => {
      const [time, period] = t.split(' ');
      if (!time || !period) return 0;
      let [h, m] = time.split(':').map(Number);
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + m;
    };
    const startMins = parse(timeSlots[lastSlotIdx]);
    const endMins = startMins + 60;
    
    let endH = Math.floor(endMins / 60);
    const endM = endMins % 60;
    const endAmpm = endH >= 12 && endH < 24 ? "PM" : endH >= 24 ? "AM" : "AM";
    if (endH > 12) endH -= 12;
    if (endH === 0) endH = 12;
    
    let endTimeLabel = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')} ${endAmpm}`;
    if (endMins >= 24 * 60) endTimeLabel = "12:00 MN";

    const totalPrice = getDynamicPrice(sport, date, startSlot) * d;
    options.push({ endTimeLabel, duration: d, totalPrice, lastSlotIdx });
  }

  return options;
}

// ─── Calendar Picker ──────────────────────────────────────────────────────────
function CalendarPicker({
  selectedDate,
  onSelect,
  isReadOnly,
}: {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  isReadOnly?: boolean;
}) {
  const today = startOfToday();
  const [viewMonth, setViewMonth] = useState(startOfMonth(selectedDate));
  const maxDate = addMonths(today, 3);

  const monthStart = viewMonth;
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const canGoPrev = isBefore(today, viewMonth);
  const canGoNext = isBefore(viewMonth, startOfMonth(maxDate));

  return (
    <div className="px-5">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => canGoPrev && setViewMonth(subMonths(viewMonth, 1))}
          disabled={!canGoPrev}
          className="w-8 h-8 rounded-lg bg-[#1A1A1A] border border-white/8 flex items-center justify-center disabled:opacity-20 transition-all"
        >
          <ChevronLeft size={15} className="text-white" />
        </button>
        <span className="text-white font-black" style={{ fontSize: 15 }}>
          {format(viewMonth, "MMMM yyyy")}
        </span>
        <button
          onClick={() => canGoNext && setViewMonth(addMonths(viewMonth, 1))}
          disabled={!canGoNext}
          className="w-8 h-8 rounded-lg bg-[#1A1A1A] border border-white/8 flex items-center justify-center disabled:opacity-20 transition-all"
        >
          <ChevronRight size={15} className="text-white" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-gray-500 font-black" style={{ fontSize: 11, paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          const isPast = isBefore(day, today);
          const isDisabled = isPast || !inMonth || (isReadOnly && !isSelected);
          return (
            <motion.button
              key={day.toString()}
              whileTap={!isDisabled ? { scale: 0.88 } : {}}
              onClick={() => !isDisabled && onSelect(day)}
              disabled={isDisabled}
              className="w-full rounded-xl flex items-center justify-center transition-all"
              style={{
                height: 36, fontSize: 13, fontWeight: 800,
                backgroundColor: isSelected ? "#FF8C00" : isToday && !isReadOnly ? "rgba(255,140,0,0.12)" : "transparent",
                color: isSelected ? "white" : isDisabled ? "#333" : isToday ? "#FF8C00" : "#e5e7eb",
                border: isToday && !isSelected && !isReadOnly ? "1px solid rgba(255,140,0,0.4)" : "1px solid transparent",
                cursor: isDisabled ? "default" : "pointer",
                opacity: !inMonth ? 0 : isDisabled ? 0.25 : 1,
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
// ─── Main Component ────────────────────────────────────────────────────────────

function BookingProgressBar({ currentStep }: { currentStep: "select" | "confirm" | "success" }) {
  const steps = ["select", "confirm", "success"];
  const currentIndex = steps.indexOf(currentStep);

  return (
    <div className="w-full bg-[#111111] pt-4 pb-2 z-10 border-b border-white/5 flex-shrink-0">
      <div className="flex items-start justify-between px-8">
        {steps.map((s, i) => (
          <Fragment key={s}>
            <div className="flex flex-col items-center gap-2 relative z-10 w-14">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black transition-all duration-300 ${
                  i <= currentIndex
                    ? "bg-[#FF8C00] text-white shadow-[0_0_12px_rgba(255,140,0,0.4)]"
                    : "bg-[#1A1A1A] text-gray-600 border border-white/10"
                }`}
              >
                {i < currentIndex ? <Check size={13} strokeWidth={3} /> : i + 1}
              </div>
              <span
                className={`text-[9px] uppercase tracking-wider font-black transition-colors duration-300 text-center ${
                  i <= currentIndex ? "text-white" : "text-gray-600"
                }`}
              >
                {s === "select" ? "Details" : s === "confirm" ? "Review" : "Done"}
              </span>
            </div>
            
            {i < steps.length - 1 && (
              <div className="flex-1 h-[2px] bg-white/10 mt-3 mx-[-10px] relative z-0 overflow-hidden">
                <div 
                  className="h-full bg-[#FF8C00] transition-all duration-500 ease-out"
                  style={{ width: i < currentIndex ? "100%" : "0%" }}
                />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function MobileBooking() {
  const { user, addBooking, bookings } = useUser();
  const { requests, updateRequestStatus, activeRequestId, setActiveRequestId, coaches } = useCoaching();
  const { addonsBySport } = useAddons();
  const { createBooking, checkAvailability, loading: apiLoading, error: apiError } = useBookingAPI();

  const unlinkedRequest = useMemo(() => {
    if (!activeRequestId) return undefined;
    return requests.find(r => r.id === activeRequestId && (r.userId === user?.id || r.userId === "u1") && !r.linkedBookingId && (r.status === 'pending' || r.status === 'pending_verification' || r.status === 'confirmed'));
  }, [requests, activeRequestId]);

  const [step, setStep] = useState<"select" | "confirm" | "success">("select");
  const [selectedSport, setSelectedSport] = useState(() => {
    if (unlinkedRequest) {
      return SPORTS.find(s => s.name === unlinkedRequest.sport) || SPORTS[0];
    }
    return SPORTS[0];
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    if (unlinkedRequest && unlinkedRequest.requestedDate) {
      return parseISO(unlinkedRequest.requestedDate);
    }
    return startOfToday();
  });
  const [startSlot, setStartSlot] = useState<string | null>(() => {
    if (unlinkedRequest && unlinkedRequest.requestedTime) {
      return unlinkedRequest.requestedTime;
    }
    return null;
  });
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [createdBooking, setCreatedBooking] = useState<any>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState(user?.email || "");
  const [showRates, setShowRates] = useState(false);
  const [selectedAddOns, setSelectedAddOns] = useState<Set<string>>(new Set());
  const endPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (unlinkedRequest) {
      if (unlinkedRequest.sport) {
        const sportObj = SPORTS.find(s => s.name === unlinkedRequest.sport);
        if (sportObj) setSelectedSport(sportObj);
      }
      if (unlinkedRequest.requestedDate) {
        setSelectedDate(parseISO(unlinkedRequest.requestedDate));
      }
      if (unlinkedRequest.requestedTime) {
        setStartSlot(unlinkedRequest.requestedTime);
      }
    }
  }, [unlinkedRequest]);

  const activeTimeSlots = useMemo(() => {
    if (unlinkedRequest?.requestedTime && !TIME_SLOTS.includes(unlinkedRequest.requestedTime)) {
      const parse = (t: string) => {
        const [time, period] = t.split(' ');
        if (!time || !period) return 0;
        let [h, m] = time.split(':').map(Number);
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };
      return [...TIME_SLOTS, unlinkedRequest.requestedTime].sort((a, b) => parse(a) - parse(b));
    }
    return TIME_SLOTS;
  }, [unlinkedRequest]);

  const sportColor = getSportColor(selectedSport.name);
  const rateRows = RATE_CARD[selectedSport.name] || [];

  // Derived: end time options for selected start
  const endTimeOptions = startSlot
    ? getEndTimeOptions(startSlot, bookedSlots, selectedSport.name, selectedDate, activeTimeSlots)
    : [];

  // Indices for range highlight
  const startIdx = startSlot ? activeTimeSlots.indexOf(startSlot) : -1;
  const endIdx = startIdx >= 0 ? startIdx + selectedDuration - 1 : -1;

  // Base price (per hour) × duration
  const baseHourly = startSlot
    ? getDynamicPrice(selectedSport.name, selectedDate, startSlot)
    : 0;
  const baseTotal = baseHourly * selectedDuration;

  // Scroll to end picker when it appears
  useEffect(() => {
    if (startSlot && endPickerRef.current) {
      setTimeout(() => {
        endPickerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 150);
    }
  }, [startSlot]);

  // Reset duration when start changes
  useEffect(() => {
    setSelectedDuration(1);
  }, [startSlot]);

  useEffect(() => {
    const fetchBookings = async () => {
      setIsLoading(true);
      setBookedSlots([]);
      try {
        const dateStr = format(selectedDate, "yyyy-MM-dd");
        
        const SHARED_SPORTS = ["Basketball", "Volleyball", "Badminton", "Pickleball"];
        const FULL_COURT_SPORTS = ["Basketball", "Volleyball"];
        const SPORT_CAPACITY: Record<string, number> = {
          Basketball: 1, Volleyball: 1, Badminton: 3, Pickleball: 3, Billiards: 4, "Table Tennis": 4
        };

        const demoSeedSport = SHARED_SPORTS.includes(selectedSport.name) ? "SharedCourt" : selectedSport.name;
        
        const localBookedSlots: string[] = [];
        const hourCounts = new Map<number, number>();

        bookings.forEach(b => {
          if (b.status === 'cancelled' || b.status === 'completed' || b.status === 'rejected') return;
          if (b.date !== dateStr) return;
          
          const sportA = SHARED_SPORTS.find(s => selectedSport.name.includes(s));
          const sportB = SHARED_SPORTS.find(s => b.court.includes(s) || b.sport === s);

          let isConflict = false;
          let weight = 1;

          if (sportA && sportB) {
            if (FULL_COURT_SPORTS.includes(sportB)) {
              isConflict = true; weight = 999;
            } else if (FULL_COURT_SPORTS.includes(sportA)) {
              isConflict = true; weight = 999;
            } else if (sportA !== sportB) {
              isConflict = true; weight = 999;
            } else {
              isConflict = true; weight = 1;
            }
          } else if (b.sport === selectedSport.name || b.court.includes(selectedSport.name)) {
            isConflict = true; weight = 1;
          }
          
          if (isConflict) {
             const [h] = b.time.split(':');
             const startHour = parseInt(h);
             for(let i=0; i<(b.duration||1); i++) {
                const cur = hourCounts.get(startHour + i) || 0;
                hourCounts.set(startHour + i, cur + weight);
             }
          }
        });

        const capacity = SPORT_CAPACITY[selectedSport.name] || 1;
        for (const [hour, count] of hourCounts.entries()) {
          if (count >= capacity) {
            localBookedSlots.push(`${String(hour).padStart(2, '0')}:00`);
          }
        }

        try {
          const response = await fetch(
            `${SERVER_URL}/bookings?date=${dateStr}&sport=${selectedSport.name}`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
          );
          if (response.ok) {
            const data = await response.json();
            const realBookings = data.bookedSlots || [];
            const demoBookings = generateDemoBookings(dateStr, demoSeedSport);
            setBookedSlots(Array.from(new Set([...realBookings, ...demoBookings, ...localBookedSlots])));
          } else {
            setBookedSlots(Array.from(new Set([...generateDemoBookings(dateStr, demoSeedSport), ...localBookedSlots])));
          }
        } catch {
          setBookedSlots(Array.from(new Set([...generateDemoBookings(dateStr, demoSeedSport), ...localBookedSlots])));
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchBookings();
  }, [selectedDate, selectedSport]);

  const addOnList = addonsBySport[selectedSport.name] || [];
  const addOnTotal = addOnList
    .filter(a => selectedAddOns.has(a.id))
    .reduce((s, a) => s + (a.perHour ? a.price * selectedDuration : a.price), 0);

  let coachingFee = 0;
  if (unlinkedRequest) {
    const coach = coaches.find(c => c.id === unlinkedRequest.coachId);
    if (coach) {
      coachingFee = coach.hourlyRate * selectedDuration;
    }
  }

  const confirmPrice = baseTotal + addOnTotal + coachingFee;

  const handleBooking = async () => {
    if (!startSlot) return;
    if (!userEmail.includes("@")) {
      setBookingError("Please enter a valid email address.");
      return;
    }
    setIsBooking(true);
    setBookingError(null);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const endLabelOption = endTimeOptions.find(o => o.duration === selectedDuration);
      const endLabel = endLabelOption ? endLabelOption.endTimeLabel : "";
      
      const isAvailable = await checkAvailability(selectedSport.name, dateStr, startSlot, endLabel);
      if (!isAvailable) {
        setBookingError("Slot unavailable");
        setIsBooking(false);
        return;
      }
      
      // Determine the next available court number for the ID
      const SPORT_CAPACITY: Record<string, number> = {
        Basketball: 1, Volleyball: 1, Badminton: 3, Pickleball: 3, Billiards: 4, "Table Tennis": 4
      };
      const capacity = SPORT_CAPACITY[selectedSport.name] || 1;
      let assignedCourt = `${selectedSport.name} 1`;
      for (let i = 1; i <= capacity; i++) {
        const cName = `${selectedSport.name} ${i}`;
        const isFree = !bookings.some(b => {
          if (b.status === 'cancelled' || b.status === 'completed' || b.status === 'rejected') return false;
          if (b.date !== dateStr) return false;
          if (b.court === cName) {
            const [h] = b.time.split(':');
            const sHour = parseInt(h);
            const eHour = sHour + (b.duration || 1);
            const reqStart = parseInt(startSlot.split(':')[0]);
            const reqEnd = reqStart + selectedDuration;
            return (reqStart < eHour && reqEnd > sHour);
          }
          return false;
        });
        if (isFree) {
          assignedCourt = cName;
          break;
        }
      }

      let addonsArray = Array.from(selectedAddOns).map(id => {
        const addon = addOnList.find(a => a.id === id);
        return addon ? addon.label : id;
      });
      if (unlinkedRequest) {
        addonsArray.push(`Coaching (${unlinkedRequest.coachName})`);
      }

      const response = await createBooking({
        user_id: user?.id || "guest",
        court_id: assignedCourt,
        booking_date: dateStr,
        start_time: startSlot,
        end_time: endLabel,
        addons: addonsArray,
        status: "confirmed",
      });

      // Simulate GCash Gateway Processing
      await new Promise(resolve => setTimeout(resolve, 2500));

      const transactionId = `TXN-${response.id || Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      const booking = {
        id: response.id || `BK${Date.now()}`,
        sport: selectedSport.name,
        date: dateStr,
        time: startSlot,
        duration: selectedDuration,
        court: assignedCourt,
        status: "confirmed" as const,
        amount: response.total_price || confirmPrice,
        paymentStatus: "paid" as const,
        paymentProofUrl: transactionId,
        createdAt: new Date().toISOString(),
        customerName: user?.name,
        addOns: addonsArray.join(", ") || undefined,
      };
      
      addBooking(booking);
      setCreatedBooking(booking);

      // Link the booking to the coaching request if it exists
      if (unlinkedRequest) {
        updateRequestStatus(unlinkedRequest.id, "confirmed", booking.id, transactionId);
        setActiveRequestId(null);
      }
      
      setStep("success");
    } catch (err: any) {
      setBookingError(err.message || "Booking failed");
    } finally {
      setIsBooking(false);
    }
  };

  const resetBooking = () => {
    setActiveRequestId(null);
    setStep("select");
    setStartSlot(null);
    setSelectedDuration(1);
    setBookingError(null);
    setSelectedAddOns(new Set());
    setCreatedBooking(null);
  };

  // ─── Success ────────────────────────────────────────────────────────────────
  if (step === "success") {
    const displayBookingId = createdBooking?.id || Math.floor(Math.random() * 90000) + 10000;
    const displayPrice = createdBooking?.amount || confirmPrice;
    const endLabelOption = endTimeOptions.find(o => o.duration === selectedDuration);
    const endLabel = endLabelOption ? endLabelOption.endTimeLabel : "";
    return (
      <div className="h-full flex flex-col bg-[#111111]">
        <BookingProgressBar currentStep="success" />
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-10">
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="text-center w-full"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5"
            >
              <CheckCircle size={40} className="text-green-400" />
            </motion.div>
          <h2 className="text-white mb-2" style={{ fontSize: 24, fontWeight: 900 }}>Booking Reserved!</h2>
          <p className="text-gray-400 text-sm mb-6 text-center">Your court has been reserved. Please proceed to the facility to pay in person and check in.</p>

          {/* Time range pill */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className="flex items-center gap-2 bg-[#FF8C00]/10 border border-[#FF8C00]/30 rounded-2xl px-4 py-2">
              <Clock size={14} className="text-[#FF8C00]" />
              <span className="text-[#FF8C00] font-black" style={{ fontSize: 13 }}>{startSlot}</span>
              <ArrowRight size={12} className="text-[#FF8C00]/60" />
              <span className="text-[#FF8C00] font-black" style={{ fontSize: 13 }}>{endLabel}</span>
              <span className="text-[#FF8C00]/70" style={{ fontSize: 12 }}>· {selectedDuration}hr{selectedDuration > 1 ? "s" : ""}</span>
            </div>
          </div>

          <div className="bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 mb-6 text-left space-y-3">
            {[
              { label: "Sport",      value: selectedSport.name },
              { label: "Date",       value: format(selectedDate, "EEEE, MMMM d, yyyy") },
              { label: "Start",      value: startSlot || "" },
              { label: "End",        value: endLabel },
              { label: "Duration",   value: `${selectedDuration} hour${selectedDuration > 1 ? "s" : ""}` },
              { label: "Amount Due", value: `₱${displayPrice.toLocaleString()}`, highlight: true },
              { label: "Booking ID", value: `#${displayBookingId}` },
              { label: "Status",     value: "Pending Payment", yellow: true },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-gray-500" style={{ fontSize: 13 }}>{row.label}</span>
                <span
                  className="font-black"
                  style={{
                    fontSize: 13,
                    color: (row as any).green ? "#4ade80" : (row as any).yellow ? "#eab308" : (row as any).highlight ? "#FF8C00" : "white",
                  }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={resetBooking}
            className="w-full bg-[#FF8C00] text-white rounded-2xl py-4 shadow-lg shadow-orange-500/30"
            style={{ fontSize: 15, fontWeight: 900 }}
          >
            Book Another Court
          </motion.button>
        </motion.div>
        </div>
      </div>
    );
  }

  // ─── Confirm ─────────────────────────────────────────────────────────────────
  if (step === "confirm") {
    const endLabelOption = endTimeOptions.find(o => o.duration === selectedDuration);
    const endLabel = endLabelOption ? endLabelOption.endTimeLabel : "";
    const toggleAddOn = (id: string) => {
      setSelectedAddOns(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };
    return (
      <div className="h-full flex flex-col bg-[#111111]">
        <div className="px-5 pt-4 pb-2 flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setStep("select")} className="w-10 h-10 rounded-xl bg-[#1E1E1E] flex items-center justify-center">
            <ChevronLeft size={20} className="text-white" />
          </button>
          <h2 className="text-white" style={{ fontSize: 18, fontWeight: 900 }}>Confirm Booking</h2>
        </div>
        <BookingProgressBar currentStep="confirm" />

        <div className="flex-1 overflow-y-auto px-5 scrollbar-hide pt-3">

          {/* Booking summary card */}
          <div className="bg-[#1A1A1A] rounded-2xl p-4 mb-4 border border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${sportColor}20` }}>
                <SportIcon sport={selectedSport.name} size={24} color={sportColor} strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="text-white font-black" style={{ fontSize: 16 }}>{selectedSport.name}</p>
                <p className="text-gray-400" style={{ fontSize: 13 }}>Court 1</p>
              </div>
              <div className="text-right">
                <p className="font-black" style={{ fontSize: 20, color: sportColor }}>₱{confirmPrice.toLocaleString()}</p>
                <p className="text-gray-500" style={{ fontSize: 11 }}>total</p>
              </div>
            </div>

            {/* Time range display */}
            <div className="bg-black/30 rounded-xl p-3 flex items-center justify-between">
              <div className="text-center">
                <p className="text-gray-500" style={{ fontSize: 10, fontWeight: 700 }}>START</p>
                <p className="text-white font-black" style={{ fontSize: 15 }}>{startSlot}</p>
              </div>
              <div className="flex-1 mx-3 flex flex-col items-center gap-1">
                <div className="flex items-center w-full">
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                </div>
                <span className="text-gray-500 font-black" style={{ fontSize: 11 }}>
                  {selectedDuration}hr{selectedDuration > 1 ? "s" : ""}
                </span>
              </div>
              <div className="text-center">
                <p className="text-gray-500" style={{ fontSize: 10, fontWeight: 700 }}>END</p>
                <p className="text-white font-black" style={{ fontSize: 15 }}>{endLabel}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <CalendarDays size={13} className="text-gray-500" />
              <span className="text-gray-400" style={{ fontSize: 12 }}>
                {format(selectedDate, "EEEE, MMMM d")}
              </span>
              <span className="text-gray-600 mx-1">·</span>
              <Info size={12} className="text-gray-600" />
              <span className="text-gray-500" style={{ fontSize: 12 }}>
                {selectedDate.getDay() === 0 || selectedDate.getDay() === 6 ? "Weekend" : "Weekday"} rate
              </span>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="bg-[#1A1A1A] rounded-2xl p-4 mb-4 border border-white/5">
            <p className="text-gray-400 mb-3" style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.06em" }}>Price Breakdown</p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400" style={{ fontSize: 13 }}>
                  ₱{baseHourly.toLocaleString()} × {selectedDuration}hr{selectedDuration > 1 ? "s" : ""}
                </span>
                <span className="text-white font-black" style={{ fontSize: 13 }}>₱{baseTotal.toLocaleString()}</span>
              </div>
              {Array.from(selectedAddOns).map(id => {
                const addon = addOnList.find(a => a.id === id);
                if (!addon) return null;
                const lineCost = addon.perHour ? addon.price * selectedDuration : addon.price;
                const leftLabel = addon.perHour
                  ? `${addon.label} (₱${addon.price.toLocaleString()}/hr × ${selectedDuration}h)`
                  : `${addon.label} (flat ₱${addon.price.toLocaleString()})`;
                return (
                  <div key={id} className="flex justify-between gap-2">
                    <span className="text-gray-400 flex-1 min-w-0" style={{ fontSize: 13 }}>{leftLabel}</span>
                    <span style={{ fontSize: 13, color: sportColor, fontWeight: 800 }} className="flex-shrink-0">+₱{lineCost.toLocaleString()}</span>
                  </div>
                );
              })}
              {unlinkedRequest && coachingFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400" style={{ fontSize: 13 }}>Coaching ({unlinkedRequest.coachName})</span>
                  <span style={{ fontSize: 13, color: sportColor, fontWeight: 800 }}>+₱{coachingFee.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-white/5 pt-2 flex justify-between">
                <span className="text-white font-black" style={{ fontSize: 14 }}>Total</span>
                <span className="font-black" style={{ fontSize: 14, color: sportColor }}>₱{confirmPrice.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Optional Add-ons */}
          {addOnList.length > 0 && (
            <div className="mb-4">
              <p className="mb-2" style={{ fontSize: 12, fontWeight: 800, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Optional Add-ons
              </p>
              <div className="space-y-2">
                {addOnList.map((addon: AddOn) => {
                  const checked = selectedAddOns.has(addon.id);
                  const addonCost = addon.perHour ? addon.price * selectedDuration : addon.price;
                  return (
                    <motion.button
                      key={addon.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleAddOn(addon.id)}
                      className="w-full flex items-center gap-3 rounded-xl px-3.5 py-3 border text-left transition-all"
                      style={{
                        backgroundColor: checked ? `${sportColor}12` : "#1A1A1A",
                        borderColor: checked ? `${sportColor}60` : "rgba(255,255,255,0.07)",
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          backgroundColor: checked ? sportColor : "transparent",
                          border: checked ? `2px solid ${sportColor}` : "2px solid rgba(255,255,255,0.2)",
                        }}
                      >
                        {checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-white" style={{ fontSize: 13, fontWeight: 700 }}>{addon.label}</span>
                        <p className="text-gray-500 mt-0.5" style={{ fontSize: 11 }}>
                          {addon.perHour
                            ? `₱${addon.price.toLocaleString()}/hr × ${selectedDuration}h = ₱${addonCost.toLocaleString()}`
                            : (addon.note || `Flat ₱${addon.price.toLocaleString()}`)}
                        </p>
                      </div>
                      <span className="font-black flex-shrink-0" style={{ fontSize: 13, color: checked ? sportColor : "#6b7280" }}>
                        +₱{addonCost.toLocaleString()}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label className="flex items-center gap-2 mb-2" style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af" }}>
              <User size={14} /> Email for Confirmation
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-[#1E1E1E] border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FF8C00] focus:border-transparent"
              style={{ fontSize: 14 }}
            />
          </div>

          {bookingError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 mb-4" style={{ fontSize: 13 }}>
              {bookingError}
            </div>
          )}

          {/* Payment Info */}
          <motion.div 
            animate={{ boxShadow: ['0px 0px 0px rgba(255,140,0,0)', '0px 0px 15px rgba(255,140,0,0.15)', '0px 0px 0px rgba(255,140,0,0)'] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="bg-gradient-to-br from-[#FF8C00]/10 to-[#cc7000]/5 rounded-3xl p-5 mb-6 border border-[#FF8C00]/30 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF8C00]/10 rounded-full blur-3xl -mt-10 -mr-10 pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-[#FF8C00]/20 flex items-center justify-center border border-[#FF8C00]/30 mb-3 shadow-[0_0_15px_rgba(255,140,0,0.2)]">
                <Building2 size={22} className="text-[#FF8C00]" />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-[#FF8C00] animate-pulse" />
                <p className="text-[#FF8C00] font-black tracking-widest text-[10px] uppercase">Manual Check-In Required</p>
              </div>
              <p className="text-white font-black text-lg mb-2">Pay at Facility</p>
              <p className="text-gray-400 text-xs leading-relaxed max-w-[260px]">
                Your court will be instantly reserved. Please pay the total amount at the front desk upon arrival.
              </p>
            </div>
          </motion.div>
        </div>

        <div className="px-5 pb-5 pt-3 border-t border-white/5 flex-shrink-0">
          <motion.button
            whileTap={{ scale: isBooking ? 1 : 0.98 }}
            onClick={handleBooking}
            disabled={isBooking}
            className={`w-full rounded-2xl py-4 flex items-center justify-center gap-2 shadow-lg disabled:opacity-60 transition-all ${
              isBooking ? 'bg-gray-700 text-gray-400' : 'bg-[#FF8C00] text-white shadow-orange-500/30'
            }`}
            style={{ fontSize: 16, fontWeight: 900 }}
          >
            {isBooking ? (
              <><Loader2 size={20} className="animate-spin" /> Processing Reservation...</>
            ) : (
              `Confirm Reservation • ₱${confirmPrice.toLocaleString()}`
            )}
          </motion.button>
        </div>
      </div>
    );
  }

  // ─── Select Screen ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-[#111111]">
      <div className="px-5 pt-4 pb-2 flex-shrink-0 flex items-start justify-between">
        <div>
          <h2 className="text-white" style={{ fontSize: 22, fontWeight: 900 }}>Book a Court</h2>
          <p className="text-gray-400" style={{ fontSize: 13 }}>Follow the steps below</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowRates(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border mt-1"
          style={{
            fontSize: 11, fontWeight: 800,
            backgroundColor: showRates ? `${sportColor}20` : "#1A1A1A",
            borderColor: showRates ? sportColor : "rgba(255,255,255,0.1)",
            color: showRates ? sportColor : "#9ca3af",
          }}
        >
          <Info size={11} /> Rates
        </motion.button>
      </div>

      <BookingProgressBar currentStep="select" />

      {/* Rate card panel */}
      <AnimatePresence>
        {showRates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-5 mb-3 bg-[#1A1A1A] rounded-2xl p-4 border border-white/5">
              <p className="mb-2.5 uppercase tracking-widest" style={{ fontSize: 10, fontWeight: 800, color: sportColor }}>
                {selectedSport.name} · 2026 Rates
              </p>
              <div className="space-y-2">
                {rateRows.map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-gray-400" style={{ fontSize: 12 }}>{row.label}</span>
                    <span className="font-black" style={{ fontSize: 12, color: sportColor }}>{row.rate}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {unlinkedRequest && (
          <div className="mx-5 mb-5 p-3 rounded-xl bg-[#0047AB]/10 border border-[#0047AB]/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0047AB]/20 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-[#0047AB]" />
              </div>
              <div>
                <p className="text-white font-bold text-sm">Coaching with {unlinkedRequest.coachName}</p>
                <p className="text-[#0047AB] text-xs">Complete your booking for this session</p>
              </div>
            </div>
            <button onClick={() => setActiveRequestId(null)} className="p-2 -mr-2 bg-[#0047AB]/10 rounded-full text-[#0047AB]">
              <X size={16} />
            </button>
          </div>
        )}

        {/* ── Step 1: Sport ── */}
        <div className="mb-5 px-5">
          <StepLabel n={1} label="Select Sport" />
          <div className="grid grid-cols-3 gap-2">
            {SPORTS.map((sport) => {
              const isActive = selectedSport.name === sport.name;
              const color = getSportColor(sport.name);
              const info = SPORTS_INFO.find(s => s.name === sport.name);
              const isReadOnlySport = !!unlinkedRequest && sport.name !== selectedSport.name;
              return (
                <motion.button
                  key={sport.name}
                  whileTap={!isReadOnlySport ? { scale: 0.94 } : {}}
                  onClick={() => { if (!isReadOnlySport) { setSelectedSport(sport); setStartSlot(null); setShowRates(false); } }}
                  disabled={isReadOnlySport}
                  className="flex flex-col items-center justify-center rounded-2xl border transition-all"
                  style={{
                    height: 86, gap: 4,
                    backgroundColor: isActive ? `${color}18` : "#1A1A1A",
                    borderColor: isActive ? color : "rgba(255,255,255,0.08)",
                    boxShadow: isActive ? `0 0 16px ${color}30` : "none",
                    opacity: isReadOnlySport ? 0.3 : 1,
                  }}
                >
                  <SportIcon sport={sport.name} size={26} color={isActive ? color : "#6b7280"} strokeWidth={2} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? color : "#9ca3af", textAlign: "center", lineHeight: 1.2 }}>
                    {sport.name}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: isActive ? `${color}90` : "#4b5563" }}>
                    {info?.courts}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Step 2: Date ── */}
        <div className="mb-5">
          <div className="px-5">
            <StepLabel
              n={2}
              label="Select Date"
              badge={`${format(selectedDate, "EEE, MMM d")}  ${selectedDate.getDay() === 0 || selectedDate.getDay() === 6 ? "· Weekend" : "· Weekday"}`}
              badgeColor="#FF8C00"
            />
          </div>
          <div className="mx-4 bg-[#1A1A1A] rounded-2xl border border-white/5 py-4">
            <CalendarPicker selectedDate={selectedDate} onSelect={(d) => { setSelectedDate(d); setStartSlot(null); }} isReadOnly={!!unlinkedRequest} />
          </div>
        </div>

        {/* ── Step 3: Start Time ── */}
        <div className="px-5 mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <StepLabel n={3} label="Pick Start Time" />
            {/* Legend */}
            <div className="flex items-center gap-3" style={{ fontSize: 10 }}>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded inline-block" style={{ backgroundColor: "rgba(255,140,0,0.25)", border: "1px solid rgba(255,140,0,0.5)" }} />
                <span className="text-gray-400">Free</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded inline-block bg-[#111] border border-white/5" />
                <span className="text-gray-600">Booked</span>
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={26} className="text-[#FF8C00] animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {activeTimeSlots.map((slot, i) => {
                const isBooked  = bookedSlots.includes(slot);
                const isStart   = slot === startSlot;
                const inRange   = startIdx >= 0 && i > startIdx && i <= endIdx;
                const isEnd     = i === endIdx && !isStart;
                const isReadOnlySlot = !!unlinkedRequest && slot !== unlinkedRequest.requestedTime;

                let bg = "rgba(255,140,0,0.08)";
                let border = "rgba(255,140,0,0.3)";
                let color = "#FFB347";

                if (isBooked) {
                  bg = "#111"; border = "rgba(255,255,255,0.05)"; color = "#2e2e2e";
                } else if (isReadOnlySlot) {
                  bg = "#1A1A1A"; border = "rgba(255,255,255,0.05)"; color = "#555";
                } else if (isStart) {
                  bg = sportColor; border = sportColor; color = "white";
                } else if (inRange) {
                  bg = `${sportColor}25`; border = `${sportColor}60`; color = sportColor;
                }

                return (
                  <motion.button
                    key={slot}
                    whileTap={!isBooked && !isReadOnlySlot && !unlinkedRequest ? { scale: 0.94 } : {}}
                    onClick={() => {
                      if (isBooked || isReadOnlySlot || !!unlinkedRequest) return;
                      setStartSlot(slot === startSlot ? null : slot);
                    }}
                    disabled={isBooked || isReadOnlySlot || !!unlinkedRequest}
                    className="rounded-xl border flex flex-col items-center justify-center transition-all"
                    style={{
                      paddingTop: 8, paddingBottom: 8,
                      fontSize: 12, fontWeight: 700,
                      backgroundColor: bg,
                      borderColor: border,
                      color,
                      textDecoration: isBooked ? "line-through" : "none",
                      cursor: (isBooked || isReadOnlySlot || !!unlinkedRequest) ? "not-allowed" : "pointer",
                      opacity: isReadOnlySlot ? 0.3 : 1,
                    }}
                  >
                    <span>{slot}</span>
                    {!isBooked && !isReadOnlySlot && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: isStart ? "rgba(255,255,255,0.8)" : inRange ? `${sportColor}CC` : "rgba(255,179,71,0.7)", marginTop: 1 }}>
                        ₱{getDynamicPrice(selectedSport.name, selectedDate, slot).toLocaleString()}/hr
                      </span>
                    )}
                    {isBooked && (
                      <span style={{ fontSize: 9, color: "#333", marginTop: 1 }}>Booked</span>
                    )}
                    {isReadOnlySlot && !isBooked && (
                      <span style={{ fontSize: 9, color: "#555", marginTop: 1 }}>Not Selected</span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Step 4: End Time ── slides in after start is selected */}
        <AnimatePresence>
          {startSlot && (
            <motion.div
              ref={endPickerRef}
              key="end-picker"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className="px-5 mb-5"
            >
              <StepLabel
                n={4}
                label="Pick End Time"
                badge={
                  endTimeOptions.length > 0
                    ? `up to ${endTimeOptions[endTimeOptions.length - 1].endTimeLabel}`
                    : ""
                }
                badgeColor={sportColor}
              />

              {/* Conflict warning if only 1hr slot exists (next slot already booked) */}
              {endTimeOptions.length === 1 && (
                <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-2.5 mb-3">
                  <AlertTriangle size={13} className="text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-yellow-400" style={{ fontSize: 12 }}>
                    Only 1 hour available from this start time — the next slot is already booked.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {endTimeOptions.map(opt => {
                  const isSelected = selectedDuration === opt.duration;
                  return (
                    <motion.button
                      key={opt.duration}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedDuration(opt.duration)}
                      className="w-full rounded-2xl border flex items-center gap-4 px-4 py-3 transition-all text-left"
                      style={{
                        backgroundColor: isSelected ? `${sportColor}18` : "#1A1A1A",
                        borderColor: isSelected ? sportColor : "rgba(255,255,255,0.07)",
                        boxShadow: isSelected ? `0 0 16px ${sportColor}25` : "none",
                      }}
                    >
                      {/* Checkmark */}
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                        style={{
                          backgroundColor: isSelected ? sportColor : "transparent",
                          border: `2px solid ${isSelected ? sportColor : "rgba(255,255,255,0.2)"}`,
                        }}
                      >
                        {isSelected && (
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Time range */}
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-black" style={{ fontSize: 14, color: isSelected ? "white" : "#9ca3af" }}>
                          {startSlot}
                        </span>
                        <ArrowRight size={13} style={{ color: isSelected ? sportColor : "#4b5563" }} />
                        <span className="font-black" style={{ fontSize: 14, color: isSelected ? "white" : "#9ca3af" }}>
                          {opt.endTimeLabel}
                        </span>
                        <span
                          className="ml-1 px-2 py-0.5 rounded-full"
                          style={{
                            fontSize: 11, fontWeight: 800,
                            backgroundColor: isSelected ? `${sportColor}25` : "rgba(255,255,255,0.05)",
                            color: isSelected ? sportColor : "#6b7280",
                          }}
                        >
                          {opt.duration}hr{opt.duration > 1 ? "s" : ""}
                        </span>
                      </div>

                      {/* Price */}
                      <div className="text-right flex-shrink-0">
                        <p className="font-black" style={{ fontSize: 15, color: isSelected ? sportColor : "#6b7280" }}>
                          ₱{opt.totalPrice.toLocaleString()}
                        </p>
                        <p className="text-gray-600" style={{ fontSize: 10 }}>
                          ₱{baseHourly.toLocaleString()}/hr
                        </p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Visual range summary */}
              {selectedDuration > 1 && (
                <div className="mt-3 flex items-center gap-2 bg-[#1A1A1A] rounded-xl px-4 py-2.5 border border-white/5">
                  <Clock size={13} style={{ color: sportColor, flexShrink: 0 }} />
                  <p style={{ fontSize: 12 }}>
                    <span className="text-gray-400">Your court: </span>
                    <span className="text-white font-black">{startSlot}</span>
                    <span className="text-gray-500"> to </span>
                    <span className="text-white font-black">{endTimeOptions.find(o => o.duration === selectedDuration)?.endTimeLabel}</span>
                    <span className="text-gray-500"> ({selectedDuration} hours · </span>
                    <span className="font-black" style={{ color: sportColor }}>₱{baseTotal.toLocaleString()}</span>
                    <span className="text-gray-500">)</span>
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* ── CTA ── */}
      <div className="px-5 pb-5 pt-3 border-t border-white/5 flex-shrink-0">
        <AnimatePresence mode="wait">
          {startSlot ? (
            <motion.div key="cta-active" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Mini summary above button */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <SportIcon sport={selectedSport.name} size={15} color={sportColor} />
                  <span className="text-gray-300" style={{ fontSize: 12 }}>
                    {startSlot}
                    <span className="text-gray-600 mx-1">→</span>
                    {endTimeOptions.find(o => o.duration === selectedDuration)?.endTimeLabel}
                    <span className="text-gray-600 ml-1">· {selectedDuration}hr{selectedDuration > 1 ? "s" : ""}</span>
                  </span>
                </div>
                <span className="font-black" style={{ fontSize: 14, color: sportColor }}>
                  ₱{baseTotal.toLocaleString()}
                </span>
              </div>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => { if (user) setUserEmail(user.email); setStep("confirm"); }}
                className="w-full text-white rounded-2xl py-4 flex items-center justify-center gap-2 shadow-lg"
                style={{ fontSize: 15, fontWeight: 900, backgroundColor: sportColor, boxShadow: `0 8px 24px ${sportColor}40` }}
              >
                Continue to Confirm <ArrowRight size={17} />
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="cta-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full bg-[#1E1E1E] text-gray-500 rounded-2xl py-4 text-center"
              style={{ fontSize: 14, fontWeight: 700 }}
            >
              Select a start time to continue
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Tiny helper component ────────────────────────────────────────────────────
function StepLabel({
  n, label, badge, badgeColor,
}: {
  n: number; label: string; badge?: string; badgeColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-2.5 flex-wrap">
      <div className="w-5 h-5 rounded-md bg-[#FF8C00] flex items-center justify-center flex-shrink-0" style={{ fontSize: 11, fontWeight: 900, color: "white" }}>
        {n}
      </div>
      <span className="text-gray-400 uppercase tracking-wider" style={{ fontSize: 11, fontWeight: 800 }}>{label}</span>
      {badge && (
        <span className="font-black normal-case" style={{ fontSize: 12, color: badgeColor || "#9ca3af" }}>{badge}</span>
      )}
    </div>
  );
}
