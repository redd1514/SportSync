import React, { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, X, AlertCircle, CheckCircle, RefreshCw, Loader2, CreditCard, RotateCcw, Trash2, Filter } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useBookingAPI } from '../hooks/useBookingAPI';
import { useRealtimeBookingAPI } from '../hooks/useRealtimeAPI';
import { ConnectionStatus } from './shared/ConnectionStatus';
import { SportIcon, getSportColor } from './SportIcons';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CustomDateTimePicker } from './shared/CustomDateTimePicker';

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

export function UserMyBookings() {
  const { user, updateBooking, addCancellationRequest, bookings: contextBookings } = useUser();
  const { getQRCodeUrl, loading, error: apiError, requestBookingCancellation, requestBookingReschedule, checkAvailability } = useBookingAPI();
  const { bookings, isConnected, cancelBooking } = useRealtimeBookingAPI(user?.id || '', {
    autoFetch: true,
  });
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
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
  const [fullScreenQr, setFullScreenQr] = useState<{ token: string; booking: any } | null>(null);
  const [sportFilter, setSportFilter] = useState<string>('all');
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
    const primary = Array.isArray(bookings) ? bookings : [];
    const byId = new Map<string, any>();
    primary.forEach((b: any) => {
      if (b?.id) {
        byId.set(String(b.id), b);
      }
    });
    return Array.from(byId.values());
  }, [bookings]);

  useEffect(() => {
    let isMounted = true;
    const bookingCourtId = userBookings.find(b => b.id === selectedBooking)?.courtId;
    if (!rescheduleDate || !selectedBooking || !bookingCourtId) {
      setAvailableTimes([]);
      return;
    }

    const fetchTimes = async () => {
      setCheckingTimes(true);
      const promises = Array.from({ length: 16 }, (_, i) => i + 7).map(async hour => {
        const timeStr = `${String(hour).padStart(2, '0')}:00`;
        const endStr = `${String(hour + 1).padStart(2, '0')}:00`; // Assuming 1 hr duration
        const isAvail = await checkAvailability(bookingCourtId, rescheduleDate, timeStr, endStr);
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
  }, [rescheduleDate, selectedBooking]);

  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseBookingDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const allSports = useMemo(() => {
    return ['all', 'Basketball', 'Badminton', 'Volleyball', 'Pickleball', 'Table Tennis', 'Billiards'];
  }, []);

  const filterBySport = (arr: any[]) =>
    sportFilter === 'all' ? arr : arr.filter(b => b.sport === sportFilter);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(r => setTimeout(r, 1400));
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

  const upcomingBookings = userBookings.filter(b => {
    const isPastDate = parseBookingDate(b.date) < today;
    const isPendingReq = b.cancellationRequested || localPendingRequests.includes(b.id);
    if (isPastDate || b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected') return false;
    if (isPendingReq) return false;
    return true;
  });

  const pendingBookings = userBookings.filter(b => {
    const isPendingReq = b.cancellationRequested || localPendingRequests.includes(b.id);
    if (b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected') return false;
    return isPendingReq;
  });

  const pastBookings = userBookings.filter(b => {
    if (hiddenCompletedIds.includes(b.id)) return false;
    const isPastDate = parseBookingDate(b.date) < today;
    return isPastDate || b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected';
  });

  const handleCancelRequest = async () => {
    if (!selectedBooking || !cancellationReason) return;
    setIsSubmitting(true);
    try {
      if (!user?.id) throw new Error('Please sign in again.');
      await requestBookingCancellation(selectedBooking, user.id, cancellationReason);
      
      setLocalPendingRequests(prev => [...prev, selectedBooking]);
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
    setIsSubmitting(true);
    try {
      if (!user?.id) throw new Error('Please sign in again.');
      await requestBookingReschedule(selectedBooking, user.id, 'Reschedule request', rescheduleDate, rescheduleTime);

      setLocalPendingRequests(prev => [...prev, selectedBooking]);
      setShowRescheduleModal(false);
      setSelectedBooking(null);
      setRescheduleDate('');
      setRescheduleTime('');
      
      toast.success('Reschedule request submitted! Admin will review your request.');
    } catch (e: any) {
      toast.error(`Failed to reschedule: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const StatusBadge = ({ booking }: { booking: any }) => {
    let label = 'PENDING';
    let bg = 'bg-gray-500/15';
    let text = 'text-gray-400';
    let border = 'border-gray-500/30';
    let dot = 'bg-gray-400';

    if (booking.status === 'confirmed' || booking.status === 'checked_in') {
      const isPaid = booking.paymentStatus === 'paid' || booking.payment_status === 'paid';
      label = isPaid ? 'PAID' : 'RESERVED';
      bg = isPaid ? 'bg-emerald-500/10' : 'bg-[#FF8C00]/10';
      text = isPaid ? 'text-emerald-400' : 'text-[#FF8C00]';
      border = isPaid ? 'border-emerald-500/20' : 'border-[#FF8C00]/20';
      dot = isPaid ? 'bg-emerald-400' : 'bg-[#FF8C00]';
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
        <div className={`w-1.5 h-1.5 rounded-full ${dot} ${booking.status === 'confirmed' ? 'animate-pulse' : ''}`} />
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

  const BookingCard = ({ booking }: { booking: any }) => {
    const color = getSportColor(booking.sport);
    const isPast = booking.status === 'completed' || booking.status === 'cancelled';
    const isPendingReq = booking.cancellationRequested || localPendingRequests.includes(booking.id);
    const canModify = !isPast && !isPendingReq && booking.status !== 'pending' && booking.status !== 'pending_verification';

    const qrValue = booking.refCode || booking.id;
    // Always show the raw token if it starts with JRC-, otherwise abbreviate UUID
    const displayQrValue = qrValue?.startsWith('JRC-') ? qrValue : `JRC-${qrValue.slice(0, 6).toUpperCase()}`;

    return (
      <motion.div 
        whileHover={{ y: -4, borderColor: `${color}50` }}
        transition={{ duration: 0.2 }}
        className="bg-[#141414] rounded-3xl border border-white/5 overflow-hidden flex flex-col h-full relative"
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
            <StatusBadge booking={booking} />
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
                    {booking.date.includes('-') ? format(parseBookingDate(booking.date), 'MMM d, yyyy') : booking.date}
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
            {!isPast && qrValue && (
              <div 
                className="flex flex-col items-center justify-center bg-black/30 rounded-2xl p-4 border border-white/5 sm:w-36 flex-shrink-0 h-fit self-center sm:self-start mt-2 sm:mt-0 relative z-20 cursor-pointer hover:bg-black/40 transition-colors"
                onClick={() => setFullScreenQr({ token: qrValue, booking })}
                title="Click to view full screen QR"
              >
                <div className="p-2 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.3)] mb-3 relative group">
                  <QRCodeSVG value={qrValue} size={76} />
                  <div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-[10px] font-black">VIEW</span>
                  </div>
                </div>
                <div className="w-full text-center max-w-[110px] overflow-hidden">
                  <p className="text-gray-400 font-black truncate px-1" style={{ fontSize: 10, letterSpacing: 0.5 }}>{displayQrValue}</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-white/5 pt-5">
            {isPendingReq && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-2 flex items-center gap-2">
                <AlertCircle size={14} className="text-yellow-400 flex-shrink-0" />
                <p className="text-yellow-400 font-bold" style={{ fontSize: 11 }}>
                  Change request pending review by Admin
                </p>
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

        {/* Sport filter pills */}
        {allSports.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <Filter size={14} className="text-gray-500 flex-shrink-0" />
            {allSports.map(sport => (
              <motion.button
                key={sport}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => setSportFilter(sport)}
                className={`px-3 py-1.5 rounded-full font-black transition-all border ${
                  sportFilter === sport
                    ? 'bg-[#FF8C00]/15 border-[#FF8C00]/40 text-[#FF8C00]'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}
                style={{ fontSize: 12 }}
              >
                {sport === 'all' ? 'All Sports' : sport}
              </motion.button>
            ))}
          </div>
        )}
        {userBookings.length === 0 ? (
          <div className="text-center py-16">
            <Calendar size={48} className="text-gray-600 mx-auto mb-4" />
            <h3 className="text-white font-black mb-2" style={{ fontSize: 18 }}>
              No bookings yet
            </h3>
            <p className="text-gray-500" style={{ fontSize: 14 }}>
              Start by booking a court to see your reservations here
            </p>
          </div>
        ) : isRefreshing ? (
          /* ── Facebook-style skeleton loader ── */
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {[0,1,2,3,4,5].map(i => (
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
                      {[0,1,2].map(j => (
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
                  filterBySport(upcomingBookings).length > 0 ? (
                    filterBySport(upcomingBookings).map(booking => (
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
                  filterBySport(pendingBookings).length > 0 ? (
                    filterBySport(pendingBookings).map(booking => (
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
                  filterBySport(pastBookings).length > 0 ? (
                    filterBySport(pastBookings).map(booking => (
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
                />
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRescheduleModal(false);
                  setSelectedBooking(null);
                  setRescheduleDate('');
                  setRescheduleTime('');
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

      {/* Fullscreen QR — Styled Ticket Card */}
      {fullScreenQr && (() => {
        const { token, booking: b } = fullScreenQr;
        const displayToken = token?.startsWith('JRC-') ? token : `JRC-${token.slice(0,6).toUpperCase()}`;
        const color = getSportColor(b?.sport);
        const ticketId = 'jrc-ticket-canvas';

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
            // fallback: just download the QR SVG
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
          <div
            className="fixed inset-0 bg-black/95 flex items-center justify-center z-[100] p-6 backdrop-blur-sm"
            onClick={() => setFullScreenQr(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center gap-4 w-full max-w-xs"
            >
              {/* The ticket card (what gets downloaded) */}
              <div
                id={ticketId}
                className="w-full rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)]"
                style={{ background: '#111' }}
              >
                {/* Header band with sport color */}
                <div className="px-6 pt-6 pb-4" style={{ background: `linear-gradient(135deg, ${color}22, ${color}08)`, borderBottom: `1px solid ${color}30` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>
                      <SportIcon sport={b?.sport} size={20} color={color} strokeWidth={2.5} />
                    </div>
                    <div>
                      <p className="text-white font-black" style={{ fontSize: 18 }}>{b?.sport || 'Court Booking'}</p>
                      <p className="text-gray-400 font-medium" style={{ fontSize: 12 }}>{b?.court} · JRC Facility</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: color }} />
                    <span className="font-black uppercase" style={{ fontSize: 9, letterSpacing: 1, color }}>{b?.status?.toUpperCase() || 'RESERVED'}</span>
                  </div>
                </div>

                {/* Info rows */}
                <div className="px-6 py-4 space-y-3 border-b border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5 }}>Date</span>
                    <span className="text-white font-black" style={{ fontSize: 13 }}>
                      {b?.date ? format(new Date(b.date + 'T00:00:00'), 'MMM d, yyyy') : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5 }}>Time</span>
                    <span className="text-white font-black" style={{ fontSize: 13 }}>
                      {b?.time ? (() => { const [h] = b.time.split(':').map(Number); return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`; })() : '—'} · {b?.duration || 1}hr
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 0.5 }}>Amount</span>
                    <span className="font-black" style={{ fontSize: 13, color: '#FF8C00' }}>₱{b?.amount?.toLocaleString() || '0'}</span>
                  </div>
                </div>

                {/* Dashed perforation */}
                <div className="relative flex items-center px-0 py-0">
                  <div className="w-6 h-6 rounded-full bg-black/95 -ml-3 flex-shrink-0" />
                  <div className="flex-1 border-t-2 border-dashed border-white/10" />
                  <div className="w-6 h-6 rounded-full bg-black/95 -mr-3 flex-shrink-0" />
                </div>

                {/* QR section */}
                <div className="px-6 pt-4 pb-6 flex flex-col items-center">
                  <div className="p-3 bg-white rounded-2xl shadow-lg mb-3">
                    <QRCodeSVG value={token} size={140} />
                  </div>
                  <p className="text-gray-500 font-bold uppercase mb-1" style={{ fontSize: 9, letterSpacing: 1 }}>Show at front desk</p>
                  <p className="text-white font-black" style={{ fontSize: 15, letterSpacing: 1 }}>{displayToken}</p>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 text-center" style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-gray-700 font-bold uppercase" style={{ fontSize: 9, letterSpacing: 1.5 }}>JRC Sports Complex · Valenzuela City</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={downloadTicket}
                  className="flex-1 bg-white text-black py-3.5 rounded-2xl font-black text-sm hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
                >
                  Download Ticket
                </button>
                <button
                  onClick={() => setFullScreenQr(null)}
                  className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white hover:bg-white/20 transition-colors flex-shrink-0"
                >
                  <X size={20} />
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}

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