import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Clock, MapPin, X, AlertCircle, CheckCircle, RefreshCw, ChevronRight, Loader2, CreditCard } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useBookingAPI } from '../hooks/useBookingAPI';
import { SportIcon, getSportColor } from './SportIcons';
import { format } from 'date-fns';
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
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [checkingTimes, setCheckingTimes] = useState(false);

  // Show ALL bookings (upcoming + past + cancelled) for history
  const userBookings = contextBookings || [];

  useEffect(() => {
    if (!selectedBooking || !rescheduleDate) {
      setAvailableTimes([]);
      return;
    }
    const bookingDetails = userBookings.find(b => b.id === selectedBooking);
    if (!bookingDetails) return;

    let isMounted = true;
    const fetchTimes = async () => {
      setCheckingTimes(true);
      const promises = Array.from({ length: 16 }, (_, i) => i + 7).map(async hour => {
        const timeStr = `${String(hour).padStart(2, '0')}:00`;
        const endStr = `${String(hour + 1).padStart(2, '0')}:00`; // Assuming 1 hr duration
        const isAvail = await checkAvailability(bookingDetails.court, rescheduleDate, timeStr, endStr);
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
  }, [rescheduleDate, selectedBooking, userBookings, checkAvailability]);

  console.log('[MyBookings] Context bookings:', contextBookings);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseBookingDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const upcomingBookings = userBookings.filter(b => {
    if (b.status === 'completed') return false;
    return parseBookingDate(b.date) >= today;
  });

  const pastBookings = userBookings.filter(b => {
    if (b.status === 'completed') return true;
    return parseBookingDate(b.date) < today;
  });

  const handleCancelRequest = async () => {
    if (!selectedBooking || !cancellationReason) return;

    try {
      if (!user?.id) throw new Error('Please sign in again.');
      await requestBookingCancellation(selectedBooking, user.id, cancellationReason);
      updateBooking(selectedBooking, { cancellationRequested: true, cancellationReason });
      
      setShowCancelModal(false);
      setSelectedBooking(null);
      setCancellationReason('');
      
      alert('Cancellation request submitted! Admin will review your request.');
    } catch (e: any) {
      alert(`Failed to cancel: ${e.message}`);
    }
  };

  const handleReschedule = async () => {
    if (!selectedBooking || !rescheduleDate || !rescheduleTime) return;

    try {
      if (!user?.id) throw new Error('Please sign in again.');
      await requestBookingReschedule(selectedBooking, user.id, 'Reschedule request', rescheduleDate, rescheduleTime);
      updateBooking(selectedBooking, {
        status: 'rescheduled'
      });

      setShowRescheduleModal(false);
      setSelectedBooking(null);
      setRescheduleDate('');
      setRescheduleTime('');
      
      alert('Reschedule request submitted! Admin will review your request.');
    } catch (e: any) {
      alert(`Failed to reschedule: ${e.message}`);
    }
  };

  const StatusBadge = ({ booking }: { booking: any }) => {
    let label = 'PENDING';
    let bg = 'bg-gray-500/15';
    let text = 'text-gray-400';
    let border = 'border-gray-500/30';
    let dot = 'bg-gray-400';

    if (booking.status === 'confirmed' || booking.status === 'checked_in') {
      label = booking.paymentStatus === 'paid' ? 'PAID' : 'RESERVED';
      bg = booking.paymentStatus === 'paid' ? 'bg-emerald-500/10' : 'bg-[#FF8C00]/10';
      text = booking.paymentStatus === 'paid' ? 'text-emerald-400' : 'text-[#FF8C00]';
      border = booking.paymentStatus === 'paid' ? 'border-emerald-500/20' : 'border-[#FF8C00]/20';
      dot = booking.paymentStatus === 'paid' ? 'bg-emerald-400' : 'bg-[#FF8C00]';
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

  const BookingCard = ({ booking }: { booking: any }) => {
    const color = getSportColor(booking.sport);
    const isPast = booking.status === 'completed' || booking.status === 'cancelled';
    const canModify = !isPast && !booking.cancellationRequested;

    const qrValue = booking.refCode || booking.id;

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
                  {booking.court}
                </p>
              </div>
            </div>
            <StatusBadge booking={booking} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 flex-1">
            <div className="space-y-4">
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
                    {booking.time} · {booking.duration} hr
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
              <div className="flex flex-col items-center justify-center bg-black/20 rounded-2xl p-4 border border-white/5">
                <div className="p-2 bg-white rounded-xl shadow-lg mb-2">
                  <QRCodeSVG value={qrValue} size={90} />
                </div>
                <p className="text-gray-500 font-black" style={{ fontSize: 10, letterSpacing: 1 }}>{qrValue}</p>
              </div>
            )}
          </div>

          <div className="mt-auto border-t border-white/5 pt-5">
            {booking.cancellationRequested && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4 flex items-center gap-2">
                <AlertCircle size={14} className="text-yellow-400 flex-shrink-0" />
                <p className="text-yellow-400 font-bold" style={{ fontSize: 11 }}>
                  Cancellation request pending review
                </p>
              </div>
            )}

            {canModify && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBooking(booking.id);
                    setShowRescheduleModal(true);
                  }}
                  className="flex-1 bg-[#0047AB]/10 border border-[#0047AB]/30 text-[#0047AB] py-3 rounded-xl hover:bg-[#0047AB]/20 transition-all font-black flex items-center justify-center"
                  style={{ fontSize: 12 }}
                >
                  <RefreshCw size={14} className="mr-1.5" />
                  Reschedule
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBooking(booking.id);
                    setShowCancelModal(true);
                  }}
                  className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 py-3 rounded-xl hover:bg-red-500/20 transition-all font-black flex items-center justify-center"
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
    <div className="min-h-full bg-[#0D0D0D] p-4 md:p-6 pb-8 md:pb-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-white mb-2" style={{ fontSize: 28, fontWeight: 900 }}>
              My Bookings
            </h1>
            <p className="text-gray-500" style={{ fontSize: 14 }}>
              View and manage your court reservations ({userBookings.length} bookings)
            </p>
          </div>
        </div>

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
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
          <div className="bg-[#1A1A1A] rounded-2xl p-3 sm:p-5 border border-white/5 flex flex-col items-center sm:items-start text-center sm:text-left">
            <Calendar size={20} className="text-[#FF8C00] mb-1 sm:mb-2" />
            <p className="text-white font-black" style={{ fontSize: 20 }}>
              {upcomingBookings.length}
            </p>
            <p className="text-gray-400" style={{ fontSize: 11 }}>Upcoming</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl p-3 sm:p-5 border border-white/5 flex flex-col items-center sm:items-start text-center sm:text-left">
            <CheckCircle size={20} className="text-green-400 mb-1 sm:mb-2" />
            <p className="text-white font-black" style={{ fontSize: 20 }}>
              {pastBookings.length}
            </p>
            <p className="text-gray-400" style={{ fontSize: 11 }}>Completed</p>
          </div>
          <div className="bg-[#1A1A1A] rounded-2xl p-3 sm:p-5 border border-white/5 flex flex-col items-center sm:items-start text-center sm:text-left">
            <AlertCircle size={20} className="text-yellow-400 mb-1 sm:mb-2" />
            <p className="text-white font-black" style={{ fontSize: 20 }}>
              {userBookings.filter(b => b.cancellationRequested).length}
            </p>
            <p className="text-gray-400" style={{ fontSize: 11 }}>Pending</p>
          </div>
        </div>

        {/* Upcoming Bookings */}
        {upcomingBookings.length > 0 && (
          <div className="mb-8">
            <h2 className="text-white font-black mb-4" style={{ fontSize: 20 }}>
              Upcoming Bookings
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {upcomingBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </div>
        )}

        {/* Past Bookings */}
        {pastBookings.length > 0 && (
          <div>
            <h2 className="text-white font-black mb-4" style={{ fontSize: 20 }}>
              Past Bookings
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {pastBookings.map(booking => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </div>
        )}
          </>
        )}

      </div>

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
                disabled={!cancellationReason.trim()}
                className="flex-1 bg-red-500 text-white px-4 py-2.5 rounded-xl hover:bg-red-600 transition-colors font-black disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: 14 }}
              >
                Submit Request
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
                disabled={!rescheduleDate || !rescheduleTime}
                className="flex-1 bg-[#0047AB] text-white px-4 py-2.5 rounded-xl hover:bg-[#003a8c] transition-colors font-black disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: 14 }}
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}