import { supabase } from './supabaseClient';
import { BookingRequest, BookingResponse } from '../types';
import { createHash } from 'crypto';
import { emitRealtimeEvent } from '../middleware/realtimeMiddleware.ts';

const USE_MOCK_BOOKINGS = process.env.USE_MOCK_BOOKINGS === 'true';

function toStableUuid(input: string): string {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function resolveUserRowId(userId: string): Promise<string> {
  const normalizedAuthId = isUuid(userId) ? userId : toStableUuid(userId);

  if (isUuid(userId)) {
    const directMatch = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (directMatch.data?.id) return directMatch.data.id;
  }

  const authMatch = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', normalizedAuthId)
    .maybeSingle();

  if (authMatch.data?.id) return authMatch.data.id;

  return userId;
}

async function resolveCourtRowId(courtIdOrName: string): Promise<string> {
  const directMatch = await supabase
    .from('courts')
    .select('id')
    .eq('id', courtIdOrName)
    .maybeSingle();

  if (directMatch.data?.id) return directMatch.data.id;

  const nameMatch = await supabase
    .from('courts')
    .select('id')
    .eq('name', courtIdOrName)
    .maybeSingle();

  if (nameMatch.data?.id) return nameMatch.data.id;

  const normalized = courtIdOrName.trim().toLowerCase();
  const inferredSport = normalized.replace(/\s+\d+$/, '');
  const fallback = await supabase
    .from('courts')
    .select('id, name')
    .limit(100);

  const matched = fallback.data?.find((court: any) => {
    const courtName = String(court.name || '').trim().toLowerCase();
    return courtName === normalized || courtName.includes(inferredSport);
  });
  return matched?.id || courtIdOrName;
}

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
      const resolvedCourtId = await resolveCourtRowId(courtId);
      const { data, error } = await supabase
        .from('bookings')
        .select('id')
        .eq('court_id', resolvedCourtId)
        .eq('booking_date', date)
        .in('status', ['pending', 'confirmed', 'checked_in'])
        .or(`and(start_time.gte.${startTime},start_time.lt.${endTime}),and(end_time.gt.${startTime},end_time.lte.${endTime})`);

      if (error) throw error;
      return (data?.length ?? 0) === 0; // True if no conflicts
    } catch (e) {
      console.error('checkAvailability error:', e);
      if (USE_MOCK_BOOKINGS) {
        console.log('Using mock availability check');
        return true;
      }
      throw e;
    }
  },

  // Create a booking
  async createBooking(booking: BookingRequest): Promise<BookingResponse> {
    try {
      const resolvedUserId = await resolveUserRowId(booking.user_id);
      const resolvedCourtId = await resolveCourtRowId(booking.court_id);
      const bookingId = crypto.randomUUID();

      // Check availability
      const isAvailable = await this.checkAvailability(
        resolvedCourtId,
        booking.booking_date,
        booking.start_time,
        booking.end_time
      );

      if (!isAvailable) {
        throw new Error('Time slot not available');
      }

      // Get hourly rate
      const { data: rateRows, error: rateError } = await supabase
        .from('hourly_rates')
        .select('rate_per_hour')
        .eq('court_id', resolvedCourtId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (rateError) throw rateError;
      const rateData = rateRows?.[0];

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

      // Snapshot display name for admin/realtime (raw booking rows have no users join)
      let notesFromCustomer: string | null = null;
      if (resolvedUserId) {
        const { data: urow } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', resolvedUserId)
          .maybeSingle();
        const nm = String(urow?.full_name || urow?.email || '').trim();
        if (nm) {
          notesFromCustomer = JSON.stringify({ customerName: nm });
        }
      }

      // Create booking
      const rowStatus = booking.status ?? 'pending';
      const { error: insertError } = await supabase
        .from('bookings')
        .insert([
          {
            id: bookingId,
            user_id: resolvedUserId,
            court_id: resolvedCourtId,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            status: rowStatus,
            base_price: basePrice,
            total_price: totalPrice,
            ...(notesFromCustomer ? { notes: notesFromCustomer } : {}),
          },
        ]);

      if (insertError) throw insertError;

      const { data: createdBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!createdBooking) {
        throw new Error('Booking insert succeeded but no row was returned');
      }

      // Emit realtime event
      console.log('[BookingService] Created booking:', createdBooking.id, 'user_id:', createdBooking.user_id);
      try {
        await emitRealtimeEvent('bookings', 'INSERT', createdBooking);
        console.log('[BookingService] emitRealtimeEvent called for booking', createdBooking.id);
      } catch (emitErr) {
        console.error('[BookingService] emitRealtimeEvent error:', (emitErr as any)?.message || emitErr);
      }
      
      return createdBooking as BookingResponse;
    } catch (e) {
      console.error('Create booking error:', e);
      if (USE_MOCK_BOOKINGS) {
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
      throw e;
    }
  },

  // Get user bookings
  async getUserBookings(userId: string): Promise<BookingResponse[]> {
    try {
      const resolvedUserId = await resolveUserRowId(userId);
      console.log('[BookingService] getUserBookings - input userId:', userId, 'resolved:', resolvedUserId);

      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', resolvedUserId)
        .order('booking_date', { ascending: false });

      if (error) {
        throw error;
      }
      console.log('[BookingService] Found bookings:', data?.length);
      if (data && data.length > 0) {
        return data as BookingResponse[];
      }
      if (USE_MOCK_BOOKINGS) {
        throw new Error('Using mock bookings');
      }
      return [];
    } catch (e) {
      console.error('GetUserBookings error:', e);
      if (USE_MOCK_BOOKINGS) {
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
      throw e;
    }
  },

  // Cancel booking
  async cancelBooking(bookingId: string): Promise<void> {
    try {
      const { data: oldBooking } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();
      
      const { data: updatedBooking, error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)
        .select('*')
        .single();

      if (error) throw error;
      
      // Emit realtime event
      if (updatedBooking) {
        await emitRealtimeEvent('bookings', 'UPDATE', updatedBooking, oldBooking);
      }
    } catch (e) {
      // Mock cancellation for development
      console.log('Using mock booking cancellation');
      const booking = mockBookings.find(b => b.id === bookingId);
      if (booking) booking.status = 'cancelled';
    }
  },

  // Use their function signature (with filters) but your database logic
async getAllBookings(filters?: { date?: string; start?: string; end?: string }) {
    try {
        let query = supabase
            .from('bookings')
      .select('*, users(full_name, email), courts(name)')
      .order('created_at', { ascending: false })
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false })
            .limit(500);

    // Apply filters to Supabase query
        if (filters?.date) {
            query = query.eq('booking_date', filters.date);
        }
    if (filters?.start) {
      query = query.gte('booking_date', filters.start);
    }
    if (filters?.end) {
      query = query.lte('booking_date', filters.end);
    }

        const { data, error } = await query;

        if (error) throw error;

    const rows = data || [];
    const unresolvedUserIds = [...new Set(
      rows
        .filter((b: any) => !b.users?.full_name && !b.users?.email && b.user_id)
        .map((b: any) => String(b.user_id))
    )];

    const customerByAnyId: Record<string, string> = {};
    if (unresolvedUserIds.length > 0) {
      const [{ data: usersById }, { data: usersByAuthId }] = await Promise.all([
        supabase
          .from('users')
          .select('id, auth_id, full_name, email')
          .in('id', unresolvedUserIds),
        supabase
          .from('users')
          .select('id, auth_id, full_name, email')
          .in('auth_id', unresolvedUserIds),
      ]);

      for (const u of usersById || []) {
        const name = u.full_name || u.email || '';
        if (name) {
          customerByAnyId[String(u.id)] = name;
          if (u.auth_id) customerByAnyId[String(u.auth_id)] = name;
        }
      }

      for (const u of usersByAuthId || []) {
        const name = u.full_name || u.email || '';
        if (name) {
          customerByAnyId[String(u.id)] = name;
          if (u.auth_id) customerByAnyId[String(u.auth_id)] = name;
        }
      }
    }

        return (data || []).map((b: any) => ({
            ...b,
      customer_name:
        b.users?.full_name ||
        b.users?.email ||
        customerByAnyId[String(b.user_id || '')] ||
        null,
      court_name: b.courts?.name || null,
        }));
    } catch (e) {
        console.error('[bookingService] getAllBookings', e);
        return [];
    }
}
};