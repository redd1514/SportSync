import { supabase } from './supabaseClient';
import { BookingRequest, BookingResponse } from '../types';

// Mock data for development - stored in memory for session
let mockBookings: BookingResponse[] = [
  {
    id: 'b1',
    user_id: 'u1',
    court_id: 'court1',
    booking_date: '2026-05-15',
    start_time: '14:00',
    end_time: '15:00',
    status: 'confirmed',
    base_price: 450,
    total_price: 450,
    created_at: new Date().toISOString(),
  },
];

export const bookingService = {
  // Check if time slot is available
  async checkAvailability(
    courtId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('id')
        .eq('court_id', courtId)
        .eq('booking_date', date)
        .in('status', ['pending', 'confirmed', 'checked_in'])
        .or(`and(start_time.gte.${startTime},start_time.lt.${endTime}),and(end_time.gt.${startTime},end_time.lte.${endTime})`);

      if (error) throw error;
      return (data?.length ?? 0) === 0; // True if no conflicts
    } catch (e) {
      // Return mock data for development
      console.log('Using mock availability check');
      return true;
    }
  },

  // Create a booking
  async createBooking(booking: BookingRequest): Promise<BookingResponse> {
    try {
      // Check availability
      const isAvailable = await this.checkAvailability(
        booking.court_id,
        booking.booking_date,
        booking.start_time,
        booking.end_time
      );

      if (!isAvailable) {
        throw new Error('Time slot not available');
      }

      // Get hourly rate
      const { data: rateData, error: rateError } = await supabase
        .from('hourly_rates')
        .select('rate_per_hour')
        .eq('court_id', booking.court_id)
        .single();

      if (rateError) throw rateError;

      // Calculate duration in hours
      const [startHour, startMin] = booking.start_time.split(':').map(Number);
      const [endHour, endMin] = booking.end_time.split(':').map(Number);
      const durationMinutes = (endHour - startHour) * 60 + (endMin - startMin);
      const durationHours = durationMinutes / 60;

      // Calculate base price
      const basePrice = (rateData?.rate_per_hour ?? 0) * durationHours;

      // Get add-ons price
      let addonsTotal = 0;
      if (booking.addons && booking.addons.length > 0) {
        const { data: addonsPrices, error: addonsError } = await supabase
          .from('addons')
          .select('price')
          .in('id', booking.addons);

        if (addonsError) throw addonsError;
        addonsTotal = addonsPrices?.reduce((sum, a) => sum + (a.price ?? 0), 0) ?? 0;
      }

      const totalPrice = basePrice + addonsTotal;

      // Create booking
      const { data, error } = await supabase
        .from('bookings')
        .insert([
          {
            user_id: booking.user_id,
            court_id: booking.court_id,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            status: 'pending',
            base_price: basePrice,
            total_price: totalPrice,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return data as BookingResponse;
    } catch (e) {
      // Return mock booking for development
      console.log('[Mock API] Using mock booking creation');
      const mockBooking: BookingResponse = {
        id: `b${Date.now()}`,
        user_id: booking.user_id,
        court_id: booking.court_id,
        booking_date: booking.booking_date,
        start_time: booking.start_time,
        end_time: booking.end_time,
        status: 'confirmed',
        base_price: 450,
        total_price: 450,
        created_at: new Date().toISOString(),
      };
      // Add to mock bookings array for persistence during session
      mockBookings.push(mockBooking);
      console.log(`[Mock API] Added booking for user ${booking.user_id}, total bookings: ${mockBookings.length}`);
      return mockBooking;
    }
  },

  // Get user bookings
  async getUserBookings(userId: string): Promise<BookingResponse[]> {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', userId)
        .order('booking_date', { ascending: false });

      if (error) {
        throw error;
      }
      // If Supabase returned data, use it; otherwise fall back to mock
      if (data && data.length > 0) {
        return data as BookingResponse[];
      }
      // Fall through to mock data if empty
      throw new Error('Using mock bookings');
    } catch (e) {
      // Return mock bookings for development (all created in session)
      console.log(`[Mock API] Getting bookings for user: ${userId}`);
      console.log(`[Mock API] Total mock bookings in memory: ${mockBookings.length}`);
      const userBookings = mockBookings.filter(b => b.user_id === userId);
      console.log(`[Mock API] Found ${userBookings.length} bookings for user ${userId}`);
      if (userBookings.length === 0) {
        console.log(`[Mock API] Available mock bookings by user:`);
        const groupedByUser = mockBookings.reduce((acc: any, b) => {
          if (!acc[b.user_id]) acc[b.user_id] = 0;
          acc[b.user_id]++;
          return acc;
        }, {});
        console.log(groupedByUser);
      }
      return userBookings;
    }
  },

  // Cancel booking
  async cancelBooking(bookingId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) throw error;
    } catch (e) {
      // Mock cancellation for development
      console.log('Using mock booking cancellation');
      const booking = mockBookings.find(b => b.id === bookingId);
      if (booking) booking.status = 'cancelled';
    }
  },
};