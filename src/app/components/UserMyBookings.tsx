import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, X, AlertCircle, CheckCircle, RefreshCw, ChevronRight, Loader2 } from 'lucide-react';
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
  const { getQRCodeUrl, loading, error: apiError, requestBookingCancellation, requestBookingReschedule } = useBookingAPI();
  
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');

  console.log('[MyBookings] Context bookings:', contextBookings);

  // Show ALL bookings (upcoming + past + cancelled) for history
  const userBookings = contextBookings || [];
  
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

  const StatusBadge = ({ status }: { status: string }) => {
    const config: Record<string, { bg: string; text: string }> = {
      confirmed: { bg: 'bg-green-500/15', text: 'text-green-400' },
      pending_verification: { bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
      pending: { bg: 'bg-gray-500/15', text: 'text-gray-400' },
      rescheduled: { bg: 'bg-blue-500/15', text: 'text-blue-400' },
      completed: { bg: 'bg-gray-500/15', text: 'text-gray-400' },
    };
    const c = config[status] || config.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-black ${c.bg} ${c.text} capitalize`}>
        {status === 'pending_verification' ? 'Verification' : status}
      </span>
    );
  };

  const BookingCard = ({ booking }: { booking: any }) => {
    const color = getSportColor(booking.sport);
    const isPast = booking.status === 'completed';
    const canModify = !isPast && !booking.cancellationRequested;

    const qrUrl = booking.id ? getQRCodeUrl(booking.id) : null;

    return (
      <div 
        className="bg-[#1A1A1A] rounded-2xl border border-white/5 overflow-hidden hover:border-white/10 transition-all flex flex-col h-full"
      >
        <div 
          className="h-2"
          style={{ backgroundColor: color }}
        />
        <div className="p-4 sm:p-6 flex flex-col flex-1">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              <div 
                className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${color}20` }}
              >
                <SportIcon sport={booking.sport} size={28} color={color} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h3 className="text-white font-black truncate" style={{ fontSize: 18 }}>
                  {booking.sport}
                </h3>
                <p className="text-gray-400 truncate" style={{ fontSize: 15 }}>
                  {booking.court}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 ml-2">
              <StatusBadge status={booking.status} />
            </div>
          </div>

          <div className="space-y-3 mb-6 flex-1">
            <div className="flex items-center gap-3 text-gray-300">
              <Calendar size={18} className="text-gray-500 flex-shrink-0" />
              <span style={{ fontSize: 15 }} className="break-words">
                {booking.date.includes('-') ? format(parseBookingDate(booking.date), 'MMMM d, yyyy') : booking.date}
              </span>
            </div>
            <div className="flex items-center gap-3 text-gray-300">
              <Clock size={18} className="text-gray-500 flex-shrink-0" />
              <span style={{ fontSize: 15 }} className="break-words">{booking.time} · {booking.duration} hour(s)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500" style={{ fontSize: 15 }}>Amount:</span>
              <span className="text-green-400 font-black" style={{ fontSize: 18 }}>
                ₱{booking.amount?.toLocaleString() || '0'}
              </span>
            </div>
            
            {qrUrl && (
              <div className="mt-2 flex items-center justify-center bg-white p-2 rounded-lg max-w-[120px] mx-auto">
                <img src={qrUrl} alt="Booking QR Code" className="w-[100px] h-[100px]" />
              </div>
            )}
          </div>

          <div className="mt-auto">
            {booking.cancellationRequested && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-yellow-400 flex-shrink-0" />
                  <p className="text-yellow-400" style={{ fontSize: 14, fontWeight: 700 }}>
                    Cancellation request pending admin approval
                  </p>
                </div>
              </div>
            )}

            {canModify && (
              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setSelectedBooking(booking.id);
                    setShowRescheduleModal(true);
                  }}
                  className="flex-1 bg-[#0047AB]/20 text-[#0047AB] px-2 py-3 sm:px-4 rounded-xl hover:bg-[#0047AB]/30 transition-colors font-black flex items-center justify-center"
                  style={{ fontSize: 13 }}
                >
                  <RefreshCw size={16} className="mr-1.5" />
                  Reschedule
                </button>
                <button
                  onClick={() => {
                    setSelectedBooking(booking.id);
                    setShowCancelModal(true);
                  }}
                  className="flex-1 bg-red-500/20 text-red-400 px-2 py-3 sm:px-4 rounded-xl hover:bg-red-500/30 transition-colors font-black flex items-center justify-center"
                  style={{ fontSize: 13 }}
                >
                  <X size={16} className="mr-1.5" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
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
          <div className="bg-[#1A1A1A] rounded-2xl p-5 sm:p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto scrollbar-hide">
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
          <div className="bg-[#1A1A1A] rounded-2xl p-5 sm:p-6 max-w-md w-full border border-white/10 max-h-[90vh] overflow-y-auto scrollbar-hide">
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
              <CustomDateTimePicker
                selectedDate={rescheduleDate}
                selectedTime={rescheduleTime}
                onDateChange={setRescheduleDate}
                onTimeChange={setRescheduleTime}
                minDate={new Date().toISOString().split('T')[0]}
                accentColor="#0047AB"
              />
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