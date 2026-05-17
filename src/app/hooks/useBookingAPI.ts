import { useState } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';

export const useBookingAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Booking failed');
      const booking = await response.json();
      return booking;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkAvailability = async (courtId: string, date: string, startTime: string, endTime: string, excludeBookingId?: string) => {
    try {
      const exclude = excludeBookingId ? `&excludeBookingId=${encodeURIComponent(excludeBookingId)}` : '';
      const response = await apiFetch(
        `/api/bookings/${courtId}/availability?date=${date}&startTime=${startTime}&endTime=${endTime}${exclude}`
      );
      const data = await response.json();
      return data.available;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  const getUserBookings = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/bookings/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const bookings = await response.json();
      return bookings || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const cancelBooking = async (bookingId: string, reason?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Failed to cancel booking');
      return await response.json();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getQRCodeUrl = (bookingId: string) => {
    // Generate QR code URL - using qr.io service
    return `https://qr.io/?d=booking-${bookingId}`;
  };

  const createDeskBooking = async (payload: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/bookings/desk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || 'Desk booking failed');
      return data as { booking: Record<string, unknown>; payment_id: string };
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const lookupBookingByRef = async (q: string) => {
    setError(null);
    try {
      const response = await apiFetch(`/api/bookings/lookup?q=${encodeURIComponent(q)}`);
      if (!response.ok) return null;
      return await response.json();
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  const checkInBooking = async (bookingId: string, staffId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/bookings/${bookingId}/check-in`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffId ? { staff_id: staffId } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || 'Check-in failed');
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkOutBooking = async (bookingId: string, staffId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/bookings/${bookingId}/check-out`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffId ? { staff_id: staffId } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || 'Check-out failed');
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const requestBookingCancellation = async (bookingId: string, userId: string, reason: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/bookings/${bookingId}/request-cancellation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, reason }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || 'Request failed');
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const requestBookingReschedule = async (bookingId: string, userId: string, reason: string, newDate: string, newStartTime: string, newEndTime?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/bookings/${bookingId}/request-reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, reason, requested_new_date: newDate, requested_new_start_time: newStartTime, requested_new_end_time: newEndTime }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error((data as { error?: string }).error || 'Request failed');
      return data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createBooking,
    checkAvailability,
    getUserBookings,
    cancelBooking,
    getQRCodeUrl,
    createDeskBooking,
    lookupBookingByRef,
    checkInBooking,
    checkOutBooking,
    requestBookingCancellation,
    requestBookingReschedule,
    loading,
    error,
  };
};
