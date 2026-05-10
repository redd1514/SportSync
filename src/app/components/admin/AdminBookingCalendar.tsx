import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, 
  Clock, MapPin, User, CheckCircle, XCircle, DollarSign,
  AlertTriangle, Check, X, AlertCircle, Zap, Receipt,
  Layers, ChevronDown, Loader2
} from 'lucide-react';
import { 
  format, addDays, subDays, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, 
  subMonths, parseISO, parse, isWithinInterval
} from 'date-fns';
import { useUser } from '../../contexts/UserContext';
import { useCoaching } from '../../contexts/CoachingContext';
import { ALL_COURTS, SPORTS_INFO } from '../sportsData';
import { getSportColor, SportIcon } from '../SportIcons';
import { useAddons } from '../../contexts/AddonsContext';
import { useFacilityMap } from '../../contexts/FacilityMapContext';
import { useAdminAPI } from '../../hooks/useAdminAPI';
import { useBookingAPI } from '../../hooks/useBookingAPI';
import { SectionLoader } from '../shared/LoadingScreen';

type ViewMode = 'monthly' | 'weekly' | 'daily';

// Status colors
const STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-green-500',
  pending: 'bg-gray-500',
  pending_verification: 'bg-yellow-500',
  cancelled: 'bg-red-500',
  rescheduled: 'bg-blue-500',
  completed: 'bg-gray-500'
};

const STATUS_BORDER_COLORS: Record<string, string> = {
  confirmed: 'border-green-600',
  pending: 'border-gray-600',
  pending_verification: 'border-yellow-600',
  cancelled: 'border-red-600',
  rescheduled: 'border-blue-600',
  completed: 'border-gray-600'
};

export function AdminBookingCalendar() {
  const { bookings: staticBookings, updateBooking, deleteBooking, cancellationRequests, updateCancellationRequest } = useUser();
  const { requests, updateRequestStatus } = useCoaching();
  const { allSportNames, customSports } = useAddons();
  const { maps } = useFacilityMap();
  const { getAllBookings } = (useAdminAPI as any)();
  const { createBooking, checkAvailability } = (useBookingAPI as any)();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  
  const [apiBookings, setApiBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  useEffect(() => {
    const fetchBookings = async () => {
      setLoadingBookings(true);
      try {
        let filters = {};
        if (viewMode === 'daily') {
          filters = { date: format(currentDate, 'yyyy-MM-dd') };
        } else if (viewMode === 'weekly') {
          const start = startOfWeek(currentDate, { weekStartsOn: 1 });
          filters = { start: format(start, 'yyyy-MM-dd'), end: format(addDays(start, 6), 'yyyy-MM-dd') };
        } else {
          const start = startOfMonth(currentDate);
          const end = endOfMonth(currentDate);
          filters = { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
        }
        const data = await getAllBookings(filters);
        setApiBookings(data || []);
      } catch (err) {
        console.error("Failed to load admin bookings:", err);
      } finally {
        setLoadingBookings(false);
      }
    };
    fetchBookings();
  }, [currentDate, viewMode, getAllBookings]);

  // Merge static bookings with fetched ones for display
  const bookings = useMemo(() => {
    const combined = [...staticBookings];
    apiBookings.forEach(ab => {
      const idx = combined.findIndex(sb => sb.id === ab.id);
      if (idx > -1) combined[idx] = { ...combined[idx], ...ab };
      else combined.push(ab);
    });
    return combined;
  }, [apiBookings, staticBookings]);

  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  React.useEffect(() => { const t = setTimeout(() => setIsInitialLoad(false), 600); return () => clearTimeout(t); }, []);
  const [confirmAction, setConfirmAction] = useState<{
    label: string; description: string; color: string; icon: any;
    onConfirm: () => void;
  } | null>(null);

  const syncCoachingRequest = (bookingId: string, status: "confirmed" | "rejected" | "cancelled" | "completed") => {
    const linkedReq = requests.find(r => r.linkedBookingId === bookingId);
    if (linkedReq) {
      if (status === "completed") updateRequestStatus(linkedReq.id, "confirmed");
      else if (status === "cancelled") updateRequestStatus(linkedReq.id, "rejected");
      else updateRequestStatus(linkedReq.id, status);
    }
  };

  // Filter courts for daily view — merge static + published map courts
  const [selectedSport, setSelectedSport] = useState('All');
  const [isSportFilterOpen, setIsSportFilterOpen] = useState(false);

  const allAvailableCourts = useMemo(() => {
    const publishedCourts: { id: string; name: string; sport: string }[] = [];
    maps.filter(m => m.isPublished).forEach(m => {
      m.blocks.forEach(b => {
        if (b.status !== 'maintenance' && !publishedCourts.find(c => c.name === b.name)) {
          publishedCourts.push({ id: b.id, name: b.name, sport: b.sport });
        }
      });
    });
    
    // Return only courts available in the active facility map
    return publishedCourts;
  }, [maps]);

  const courtsToDisplay = useMemo(() => {
    if (selectedSport === 'All') return allAvailableCourts;
    return allAvailableCourts.filter(c => c.sport === selectedSport);
  }, [selectedSport, allAvailableCourts]);

  const handlePrev = () => {
    if (viewMode === 'monthly') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'weekly') setCurrentDate(subDays(currentDate, 7));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const handleNext = () => {
    if (viewMode === 'monthly') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'weekly') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Convert "14:00" or "14:00 AM" to decimal hours (e.g., 14.0)
  const timeToDecimal = (timeStr: string) => {
    if (!timeStr) return 0;
    try {
      // Try parsing HH:mm first
      if (timeStr.includes(':') && !timeStr.toLowerCase().includes('m')) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours + (minutes / 60);
      }
      const parsed = parse(timeStr, 'h:mm a', new Date());
      return parsed.getHours() + parsed.getMinutes() / 60;
    } catch {
      return 0;
    }
  };

  // Render Daily View
  const renderDailyView = () => {
    const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM
    const formattedDate = format(currentDate, 'yyyy-MM-dd');
    const dayBookings = bookings.filter(b => b.date === formattedDate).map(b => {
      // Fix legacy bookings where court doesn't match predefined names
      const isValidCourt = ALL_COURTS.some(c => c.name === b.court);
      if (isValidCourt) return b;
      const fallbackCourt = ALL_COURTS.find(c => c.sport === b.sport);
      return { ...b, court: fallbackCourt ? fallbackCourt.name : b.court };
    });

    return (
      <div className="flex flex-col h-[700px] bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden relative">
        <div className="flex-1 overflow-auto relative">
          <div className="flex min-w-max">
            {/* Sticky Time Axis */}
            <div className="w-20 flex-shrink-0 bg-[#1A1A1A] border-r border-white/5 sticky left-0 z-30">
              <div className="h-[60px] border-b border-white/5 bg-[#222] flex items-center justify-center text-center text-gray-400 font-bold text-xs sticky top-0 z-40">
                Time
              </div>
              <div className="bg-[#1A1A1A]">
                {hours.map(h => (
                  <div key={h} className="h-20 border-b border-white/5 p-2 text-right relative">
                    <span className="text-xs text-gray-500 font-bold relative -top-3">
                      {h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Courts Content */}
            <div className="flex-1 flex flex-col min-w-max">
              {/* Courts Header */}
              <div className="flex border-b border-white/5 bg-[#222] sticky top-0 z-20 h-[60px]">
                {courtsToDisplay.map((court, i) => (
                  <div key={court.id} className="w-[180px] flex-shrink-0 border-r border-white/5 flex flex-col items-center justify-center p-2">
                    <p className="text-white font-black text-sm">{court.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <SportIcon sport={court.sport} size={10} color={getSportColor(court.sport)} />
                      <p className="text-gray-500 text-xs">{court.sport}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Courts Grid */}
              <div className="flex relative bg-[#111]">
                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none flex flex-col z-0">
                  {hours.map(h => (
                    <div key={h} className="h-20 border-b border-white/5 w-full" />
                  ))}
                </div>

                {courtsToDisplay.map((court) => {
                  const courtBookings = dayBookings.filter(b => b.court === court.name);
                  
                  return (
                    <div key={court.id} className="w-[180px] flex-shrink-0 border-r border-white/5 relative h-[1360px]">
                      {courtBookings.map(booking => {
                        const startHour = timeToDecimal(booking.time);
                        if (startHour < 6 || startHour > 22) return null;
                        
                        const top = (startHour - 6) * 80;
                        const height = (booking.duration || 1) * 80;
                        const statusColor = STATUS_COLORS[booking.status] || STATUS_COLORS.pending;
                        const borderColor = STATUS_BORDER_COLORS[booking.status] || STATUS_BORDER_COLORS.pending;

                        return (
                          <div
                            key={booking.id}
                            onClick={() => setSelectedBooking(booking)}
                            className={`absolute left-1 right-1 rounded-lg p-2 cursor-pointer transition-all hover:brightness-110 shadow-lg border ${statusColor} ${borderColor} bg-opacity-90 z-10 overflow-hidden group`}
                            style={{ top: `${top}px`, height: `${height - 2}px` }}
                          >
                            <div className="flex flex-col h-full">
                              <p className="text-white font-bold text-xs truncate drop-shadow-md">{booking.customerName}</p>
                              <p className="text-white/80 text-[10px] font-medium mt-0.5">{booking.time} ({booking.duration}h)</p>
                              <div className="mt-auto pt-1">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-black/30 text-white uppercase tracking-wider">
                                  {booking.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Weekly View
  const renderWeeklyView = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    const hours = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM to 10 PM
    
    // Filter bookings for the week
    const weekBookings = bookings.filter(b => {
      const bDate = parseISO(b.date);
      return bDate >= start && bDate <= addDays(start, 6);
    });

    return (
      <div className="flex flex-col h-[700px] bg-[#1A1A1A] border border-white/5 rounded-2xl overflow-hidden relative">
        <div className="flex-1 overflow-auto relative">
          <div className="flex min-w-[800px]">
            {/* Sticky Time Axis */}
            <div className="w-16 flex-shrink-0 bg-[#1A1A1A] border-r border-white/5 sticky left-0 z-30">
              <div className="h-[60px] border-b border-white/5 bg-[#222] sticky top-0 z-40"></div>
              <div className="bg-[#1A1A1A]">
                {hours.map(h => (
                  <div key={h} className="h-20 border-b border-white/5 p-2 text-right relative">
                    <span className="text-xs text-gray-500 font-bold relative -top-3">
                      {h === 12 ? '12p' : h > 12 ? `${h - 12}p` : `${h}a`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Days Content */}
            <div className="flex-1 flex flex-col">
              {/* Days Header */}
              <div className="grid grid-cols-7 border-b border-white/5 bg-[#222] sticky top-0 z-20 h-[60px]">
                {days.map(day => (
                  <div key={day.toISOString()} className={`border-r border-white/5 p-2 flex flex-col items-center justify-center ${isSameDay(day, new Date()) ? 'bg-white/5' : ''}`}>
                    <p className="text-gray-400 font-bold text-xs uppercase">{format(day, 'EEE')}</p>
                    <p className={`text-sm font-black mt-0.5 ${isSameDay(day, new Date()) ? 'text-[#FF8C00]' : 'text-white'}`}>
                      {format(day, 'd')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 relative bg-[#111]">
                {/* Grid lines */}
                <div className="absolute inset-0 pointer-events-none flex flex-col z-0">
                  {hours.map(h => (
                    <div key={h} className="h-20 border-b border-white/5 w-full" />
                  ))}
                </div>
                
                <div className="absolute inset-0 pointer-events-none flex z-0">
                  {days.map((_, i) => (
                    <div key={i} className="flex-1 border-r border-white/5" />
                  ))}
                </div>

                {/* Bookings */}
                {days.map((day, dayIndex) => {
                  const formattedDate = format(day, 'yyyy-MM-dd');
                  const dayBookings = weekBookings.filter(b => b.date === formattedDate);

                  return (
                    <div key={day.toISOString()} className="relative col-start-auto h-[1360px]">
                      {dayBookings.map((booking, i) => {
                        const startHour = timeToDecimal(booking.time);
                        if (startHour < 6 || startHour > 22) return null;
                        
                        const top = (startHour - 6) * 80;
                        const height = (booking.duration || 1) * 80;
                        const statusColor = STATUS_COLORS[booking.status] || STATUS_COLORS.pending;
                        
                        // Prevent overlapping visually by offsetting if multiple bookings at same time
                        const overlapping = dayBookings.filter(b => timeToDecimal(b.time) === startHour);
                        const width = 100 / overlapping.length;
                        const left = overlapping.findIndex(b => b.id === booking.id) * width;

                        return (
                          <div
                            key={booking.id}
                            onClick={() => setSelectedBooking(booking)}
                            className={`absolute rounded p-1 cursor-pointer hover:brightness-110 shadow-sm border border-black/20 ${statusColor} z-10 overflow-hidden`}
                            style={{ 
                              top: `${top}px`, 
                              height: `${height - 2}px`,
                              left: `${left}%`,
                              width: `${width}%`
                            }}
                            title={`${booking.customerName} - ${booking.court}`}
                          >
                            <p className="text-white font-bold text-[10px] leading-tight truncate">{booking.customerName}</p>
                            <p className="text-white/80 text-[9px] truncate">{booking.court}</p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Monthly View
  const renderMonthlyView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
    
    const dateFormat = "d";
    const rows = [];
    
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, dateFormat);
        const cloneDay = day;
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayBookings = bookings.filter(b => b.date === dateStr);
        const isCurrentMonth = isSameMonth(day, monthStart);
        const isToday = isSameDay(day, new Date());
        
        // Count bookings by status
        const counts = dayBookings.reduce((acc, b) => {
          acc[b.status] = (acc[b.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        days.push(
          <div 
            key={day.toISOString()}
            className={`min-h-[100px] border-r border-b border-white/5 p-2 flex flex-col transition-colors
              ${!isCurrentMonth ? 'bg-[#111] opacity-50' : 'bg-[#1A1A1A] hover:bg-white/5'}
            `}
            onClick={() => {
              setCurrentDate(cloneDay);
              setViewMode('daily');
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <span className={`text-sm font-black w-6 h-6 flex items-center justify-center rounded-full
                ${isToday ? 'bg-[#FF8C00] text-white' : 'text-gray-400'}
              `}>
                {formattedDate}
              </span>
              {dayBookings.length > 0 && (
                <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                  {dayBookings.length} {dayBookings.length === 1 ? 'booking' : 'bookings'}
                </span>
              )}
            </div>
            
            <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[70px] no-scrollbar">
              {dayBookings.slice(0, 3).map(booking => (
                <div 
                  key={booking.id} 
                  className={`text-[10px] truncate px-1.5 py-0.5 rounded ${STATUS_COLORS[booking.status] || STATUS_COLORS.pending} text-white font-medium`}
                >
                  {booking.time} - {booking.customerName}
                </div>
              ))}
              {dayBookings.length > 3 && (
                <div className="text-[10px] text-gray-500 text-center font-bold">
                  +{dayBookings.length - 3} more
                </div>
              )}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toISOString()} className="grid grid-cols-7 w-full">
          {days}
        </div>
      );
      days = [];
    }

    return (
      <div className="flex flex-col border border-white/5 rounded-2xl overflow-hidden bg-[#1A1A1A]">
        <div className="grid grid-cols-7 bg-[#222] border-b border-white/5">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="p-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider border-r border-white/5 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 flex flex-col">
          {rows}
        </div>
      </div>
    );
  };

  if (isInitialLoad) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <SectionLoader label="Loading calendar…" accentColor="#FF8C00" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Calendar Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1A1A1A] p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-[#222] rounded-xl p-1 border border-white/10">
            <button onClick={handlePrev} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <ChevronLeft size={18} />
            </button>
            <button onClick={handleToday} className="px-4 py-1.5 text-sm font-bold text-white hover:bg-white/10 rounded-lg transition-colors">
              Today
            </button>
            <button onClick={handleNext} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white">
              <ChevronRight size={18} />
            </button>
          </div>
          <h2 className="text-white text-xl font-black min-w-[180px]">
            {viewMode === 'daily' && format(currentDate, 'MMMM d, yyyy')}
            {viewMode === 'weekly' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
            {viewMode === 'monthly' && format(currentDate, 'MMMM yyyy')}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 mr-4">
            {Object.entries({
              confirmed: 'Confirmed',
              pending: 'Pending',
              pending_verification: 'Verification',
              cancelled: 'Cancelled',
              completed: 'Completed'
            }).map(([status, label]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[status]}`} />
                <span className="text-xs text-gray-400 font-bold">{label}</span>
              </div>
            ))}
          </div>

          {viewMode === 'daily' && (
            <div className="relative">
              <motion.button
                onClick={() => setIsSportFilterOpen(!isSportFilterOpen)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#222] border border-white/10 text-white font-bold text-xs"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {selectedSport !== 'All' && <SportIcon sport={selectedSport} size={12} color={getSportColor(selectedSport)} strokeWidth={2.5} />}
                <span>{selectedSport === 'All' ? 'All Sports' : selectedSport}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </motion.button>

              <AnimatePresence>
                {isSportFilterOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsSportFilterOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-50 top-full left-0 mt-2 w-48 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl overflow-hidden py-1"
                    >
                      {['All', ...SPORTS_INFO.map(s => s.name), ...customSports.map(s => s.name)].map(sport => {
                        const color = sport === 'All' ? '#FF8C00' : getSportColor(sport);
                        const isActive = selectedSport === sport;
                        return (
                          <button
                            key={sport}
                            onClick={() => {
                              setSelectedSport(sport);
                              setIsSportFilterOpen(false);
                            }}
                            className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold transition-all hover:bg-white/5 ${isActive ? 'bg-white/5' : ''}`}
                            style={{
                              color: isActive ? color : 'rgba(255,255,255,0.7)',
                            }}
                          >
                            {sport !== 'All' && <SportIcon sport={sport} size={12} color={isActive ? color : '#555'} strokeWidth={2.5} />}
                            {sport}
                            {isActive && <Check size={14} className="ml-auto" color={color} />}
                          </button>
                        );
                      })}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="flex bg-[#222] rounded-xl p-1 border border-white/10">
            {(['monthly', 'weekly', 'daily'] as ViewMode[]).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-1.5 text-sm font-bold rounded-lg capitalize transition-colors ${
                  viewMode === mode ? 'bg-[#FF8C00] text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calendar Views */}
      <div className="flex-1">
        {viewMode === 'monthly' && renderMonthlyView()}
        {viewMode === 'weekly' && renderWeeklyView()}
        {viewMode === 'daily' && renderDailyView()}
      </div>

      {/* Booking Details Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
            onClick={() => { setSelectedBooking(null); setConfirmAction(null); }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="w-full max-w-md shadow-2xl flex flex-col rounded-3xl overflow-hidden"
              style={{ background: '#181818', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '92vh' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="relative px-6 pt-6 pb-5 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <button onClick={() => { setSelectedBooking(null); setConfirmAction(null); }}
                  className="absolute top-4 right-4 w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-white/10"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                  <X size={15} className="text-gray-400" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <CalendarIcon size={26} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-black" style={{ fontSize: 19 }}>{selectedBooking.customerName}</h3>
                    <p className="text-gray-400 font-black" style={{ fontSize: 13 }}>{selectedBooking.sport} · {selectedBooking.court}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="px-2.5 py-0.5 rounded-full font-black capitalize"
                        style={{
                          fontSize: 11,
                          background: selectedBooking.status === 'confirmed' ? 'rgba(34,197,94,0.15)' :
                                      selectedBooking.status === 'pending' ? 'rgba(234,179,8,0.15)' :
                                      selectedBooking.status === 'cancelled' ? 'rgba(239,68,68,0.15)' :
                                      selectedBooking.status === 'completed' ? 'rgba(100,116,139,0.2)' : 'rgba(59,130,246,0.15)',
                          color: selectedBooking.status === 'confirmed' ? '#4ade80' :
                                 selectedBooking.status === 'pending' ? '#facc15' :
                                 selectedBooking.status === 'cancelled' ? '#f87171' :
                                 selectedBooking.status === 'completed' ? '#94a3b8' : '#60a5fa',
                        }}>
                        {selectedBooking.status === 'pending_verification' ? 'Pending Verification' : selectedBooking.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 overflow-y-auto flex-1">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl p-4" style={{ background: '#222', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Clock size={12} className="text-gray-500" />
                      <span className="text-gray-500 font-black uppercase" style={{ fontSize: 10, letterSpacing: 0.5 }}>Schedule</span>
                    </div>
                    <p className="text-white font-black" style={{ fontSize: 13 }}>
                      {(() => { try { return new Date(selectedBooking.date + 'T00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' }); } catch { return selectedBooking.date; } })()}
                    </p>
                    <p className="text-gray-400 font-black mt-0.5" style={{ fontSize: 12 }}>{selectedBooking.time} · {selectedBooking.duration}h</p>
                  </div>
                  <div className="rounded-2xl p-4" style={{ background: '#222', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <User size={12} className="text-gray-500" />
                      <span className="text-gray-500 font-black uppercase" style={{ fontSize: 10, letterSpacing: 0.5 }}>Customer</span>
                    </div>
                    <p className="text-white font-black" style={{ fontSize: 13 }}>{selectedBooking.customerName}</p>
                    <p className="text-gray-400 mt-0.5" style={{ fontSize: 11 }}>{selectedBooking.customerPhone || 'No contact'}</p>
                  </div>
                </div>

                {/* Payment */}
                <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: '#222', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <DollarSign size={12} className="text-gray-500" />
                      <span className="text-gray-500 font-black uppercase" style={{ fontSize: 10, letterSpacing: 0.5 }}>Payment</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedBooking.paymentStatus === 'paid' ? (
                        <CheckCircle size={14} className="text-green-400" />
                      ) : selectedBooking.paymentStatus === 'pending' ? (
                        <AlertTriangle size={14} className="text-yellow-400" />
                      ) : selectedBooking.paymentStatus === 'failed' ? (
                        <AlertCircle size={14} className="text-red-400" />
                      ) : (
                        <Clock size={14} className="text-gray-400" />
                      )}
                      <span className={`font-black capitalize ${
                        selectedBooking.paymentStatus === 'paid' ? 'text-green-400' :
                        selectedBooking.paymentStatus === 'pending' ? 'text-yellow-400' :
                        selectedBooking.paymentStatus === 'failed' ? 'text-red-400' :
                        'text-gray-400'
                      }`} style={{ fontSize: 13 }}>
                        {selectedBooking.paymentStatus || 'Unpaid'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 font-black uppercase mb-1" style={{ fontSize: 10 }}>Total</p>
                    <p className="text-white font-black" style={{ fontSize: 22 }}>₱{selectedBooking.amount?.toLocaleString() || '—'}</p>
                  </div>
                </div>

                {/* Legacy payment proof images omitted for automated gateway */}

                {/* Confirmation UI — inline overlay */}
                <AnimatePresence>
                  {confirmAction && (
                    <motion.div initial={{ opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
                      className="rounded-2xl p-5" style={{ background: `${confirmAction.color}08`, border: `1px solid ${confirmAction.color}25` }}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${confirmAction.color}18` }}>
                          <confirmAction.icon size={16} style={{ color: confirmAction.color }} />
                        </div>
                        <div>
                          <p className="text-white font-black" style={{ fontSize: 14 }}>{confirmAction.label}</p>
                          <p className="text-gray-400" style={{ fontSize: 12 }}>{confirmAction.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setConfirmAction(null)}
                          className="flex-1 py-2.5 rounded-xl font-black text-gray-400 hover:text-white transition-colors"
                          style={{ fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                          Go Back
                        </button>
                        <button onClick={confirmAction.onConfirm}
                          className="flex-1 py-2.5 rounded-xl text-white font-black transition-all hover:brightness-110"
                          style={{ fontSize: 13, background: confirmAction.color, boxShadow: `0 4px 16px ${confirmAction.color}40` }}>
                          Confirm
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions footer */}
              {!confirmAction && (
                <div className="p-5 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#181818' }}>
                  <div className="flex flex-wrap gap-2">
                    {selectedBooking.status !== 'cancelled' && selectedBooking.status !== 'completed' && (
                      <button
                        onClick={() => setConfirmAction({
                          label: 'Cancel Booking',
                          description: 'The booking will be cancelled and the time slot freed.',
                          color: '#ef4444', icon: XCircle,
                          onConfirm: () => {
                            updateBooking(selectedBooking.id, { status: 'cancelled' });
                            setSelectedBooking({ ...selectedBooking, status: 'cancelled' });
                            syncCoachingRequest(selectedBooking.id, 'cancelled');
                            setConfirmAction(null);
                          }
                        })}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black transition-all hover:brightness-110"
                        style={{ fontSize: 13, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <XCircle size={14} /> Cancel
                      </button>
                    )}
                    {selectedBooking.status === 'pending' && (
                      <button
                        onClick={() => setConfirmAction({
                          label: 'Confirm Booking',
                          description: 'Mark this booking as confirmed and payment as paid.',
                          color: '#22c55e', icon: CheckCircle,
                          onConfirm: () => {
                            updateBooking(selectedBooking.id, { status: 'confirmed', paymentStatus: 'paid' });
                            setSelectedBooking({ ...selectedBooking, status: 'confirmed', paymentStatus: 'paid' });
                            syncCoachingRequest(selectedBooking.id, 'confirmed');
                            setConfirmAction(null);
                          }
                        })}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black transition-all hover:brightness-110"
                        style={{ fontSize: 13, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <CheckCircle size={14} /> Confirm
                      </button>
                    )}
                    {/* Automation Note: Verification is now handled automatically via Payment Gateway */}
                    {selectedBooking.status === 'confirmed' && (
                      <button
                        onClick={() => setConfirmAction({
                          label: 'Mark as Completed',
                          description: 'The session has been completed.',
                          color: '#2563EB', icon: Zap,
                          onConfirm: () => {
                            updateBooking(selectedBooking.id, { status: 'completed' });
                            setSelectedBooking({ ...selectedBooking, status: 'completed' });
                            syncCoachingRequest(selectedBooking.id, 'completed');
                            setConfirmAction(null);
                          }
                        })}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black transition-all hover:brightness-110"
                        style={{ fontSize: 13, background: 'rgba(37,99,235,0.12)', color: '#60a5fa', border: '1px solid rgba(37,99,235,0.25)' }}>
                        <Zap size={14} /> Mark Completed
                      </button>
                    )}
                    {selectedBooking.status === 'cancelled' && (
                      <button
                        onClick={() => setConfirmAction({
                          label: 'Delete Permanently',
                          description: 'This record will be removed from the system.',
                          color: '#ef4444', icon: XCircle,
                          onConfirm: () => {
                            deleteBooking(selectedBooking.id);
                            setSelectedBooking(null);
                            setConfirmAction(null);
                          }
                        })}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-black transition-all hover:brightness-110"
                        style={{ fontSize: 13, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <XCircle size={14} /> Delete Record
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}