import { useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

export const useBookingAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createBooking = async (data: any) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/bookings`, {
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

  const checkAvailability = async (courtId: string, date: string, startTime: string, endTime: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/api/bookings/${courtId}/availability?date=${date}&startTime=${startTime}&endTime=${endTime}`
      );
      const data = await response.json();
      return data.available;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  };

  return { createBooking, checkAvailability, loading, error };
};