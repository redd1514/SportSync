import { Hono } from 'hono';
import { bookingService, resolveUserRowId } from '../services/bookingService.ts';
import { BookingRequest } from '../types';
import { supabase } from '../services/supabaseClient.ts';
import {
  createDeskBooking,
  listCalendarBookings,
  lookupBookingByRefOrId,
  checkInBooking,
  checkOutBooking,
  type DeskBookingInput,
} from '../services/deskBookingService.ts';
import { deskAdminRowToClientBooking } from '../utils/bookingMap.ts';

const bookingsRouter = new Hono();

function addHoursToTime(time: string, hours: number): string {
  const [hRaw, mRaw = '0', sRaw = '0'] = String(time || '').split(':');
  const h = parseInt(hRaw || '0', 10);
  const m = parseInt(mRaw || '0', 10);
  const s = parseInt(sRaw || '0', 10);
  const total = h * 3600 + m * 60 + s + Math.round(hours * 3600);
  const wrapped = ((total % 86400) + 86400) % 86400;
  const outH = Math.floor(wrapped / 3600);
  const outM = Math.floor((wrapped % 3600) / 60);
  const outS = wrapped % 60;
  return `${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:${String(outS).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
  const [h = '0', m = '0'] = String(time || '').slice(0, 5).split(':');
  return Number(h) * 60 + Number(m);
}

// --- Specific paths first (avoid :param shadowing) ---

bookingsRouter.get('/calendar', async (c) => {
  try {
    const start = c.req.query('start');
    const end = c.req.query('end');
    if (!start || !end) {
      return c.json({ error: 'Query params start and end (YYYY-MM-DD) are required' }, 400);
    }
    const rows = await listCalendarBookings(start, end);
    return c.json(rows.map((r) => deskAdminRowToClientBooking(r)));
  } catch (error: any) {
    console.error('[bookings/calendar]', error.message);
    return c.json([], 200);
  }
});

bookingsRouter.get('/lookup', async (c) => {
  try {
    const q = c.req.query('q')?.trim();
    if (!q) return c.json(null, 200);
    const row = await lookupBookingByRefOrId(q);
    if (!row) return c.json(null, 200);
    return c.json(deskAdminRowToClientBooking(row));
  } catch (error: any) {
    console.error('[bookings/lookup]', error.message);
    return c.json(null, 200);
  }
});

bookingsRouter.post('/desk', async (c) => {
  try {
    const body = (await c.req.json()) as Partial<DeskBookingInput> & {
      court?: string;
      sport?: string;
      booking_date?: string;
      start_time?: string;
      duration_hours?: number;
      total_price?: number;
      payment_method?: string;
      source?: string;
      loyalty_points_redeemed?: number;
      loyalty_discount?: number;
    };

    if (!body.court || !body.sport || !body.booking_date || !body.start_time) {
      return c.json({ error: 'court, sport, booking_date, and start_time are required' }, 400);
    }

    const staffRaw = (body as { staff_id?: string; staffId?: string }).staff_id
      ?? (body as { staffId?: string }).staffId;

    const input: DeskBookingInput = {
      court: body.court,
      sport: body.sport,
      booking_date: body.booking_date,
      start_time: body.start_time,
      duration_hours: body.duration_hours ?? 1,
      total_price: body.total_price ?? 0,
      base_price: body.base_price,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      payment_method: body.payment_method === 'gcash' ? 'gcash' : 'cash',
      source: body.source ?? 'desk_map',
      ref_code: body.ref_code,
      add_ons: body.add_ons,
      loyalty_points_redeemed: body.loyalty_points_redeemed ?? 0,
      loyalty_discount: body.loyalty_discount ?? 0,
      staff_id: staffRaw,
      user_id:
        (body as { user_id?: string; userId?: string }).user_id ??
        (body as { userId?: string }).userId ??
        (c.get('auth') as { userId?: string } | undefined)?.userId ??
        null,
      facility_map_id: (body as { facility_map_id?: string }).facility_map_id ?? null,
    };

    const out = await createDeskBooking(input);
    return c.json(
      {
        booking: deskAdminRowToClientBooking(out.booking),
        payment_id: out.payment_id,
      },
      201
    );
  } catch (error: any) {
    console.error('[bookings/desk]', error.message);
    return c.json({ error: error.message || 'Desk booking failed' }, 400);
  }
});

bookingsRouter.patch('/:id/check-in', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const staffId = (body as { staff_id?: string }).staff_id;
    const row = await checkInBooking(id, staffId);
    return c.json(deskAdminRowToClientBooking(row));
  } catch (error: any) {
    return c.json({ error: error.message || 'Check-in failed' }, 400);
  }
});

bookingsRouter.patch('/:id/check-out', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const staffId = (body as { staff_id?: string }).staff_id;
    const row = await checkOutBooking(id, staffId);
    return c.json(deskAdminRowToClientBooking(row));
  } catch (error: any) {
    return c.json({ error: error.message || 'Check-out failed' }, 400);
  }
});

// User-facing: request cancellation (creates booking_requests row, pending approval)
bookingsRouter.post('/:id/request-cancellation', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const userId = String((body as any).user_id || '').trim();
    const reason = String((body as any).reason || '').trim();
    if (!userId) return c.json({ error: 'user_id required' }, 400);
    if (!reason) return c.json({ error: 'reason required' }, 400);

    const resolvedUserId = await resolveUserRowId(userId);

    const { data: b, error: bErr } = await supabase.from('bookings').select('id,status,user_id').eq('id', id).maybeSingle();
    if (bErr) throw bErr;
    if (!b) return c.json({ error: 'Booking not found' }, 404);
    if (String(b.user_id) !== resolvedUserId) return c.json({ error: 'Forbidden' }, 403);
    if (b.status === 'cancelled' || b.status === 'completed') return c.json({ error: 'Booking already finished' }, 400);

    const { data: existing } = await supabase
      .from('booking_requests')
      .select('id,status')
      .eq('booking_id', id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing?.id) return c.json({ error: 'A request is already pending for this booking.' }, 409);

    const row = {
      booking_id: id,
      request_type: 'cancellation',
      reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('booking_requests').insert([row]).select('*').single();
    if (error) throw error;
    return c.json(data, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Request failed' }, 400);
  }
});

// User-facing: request reschedule (creates booking_requests row, pending approval)
bookingsRouter.post('/:id/request-reschedule', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const userId = String((body as any).user_id || '').trim();
    const reason = String((body as any).reason || '').trim();
    const newDate = String((body as any).requested_new_date || '').trim();
    const newStart = String((body as any).requested_new_start_time || '').trim(); // "HH:MM"
    if (!userId) return c.json({ error: 'user_id required' }, 400);
    if (!newDate || !newStart) return c.json({ error: 'requested_new_date and requested_new_start_time required' }, 400);

    const resolvedUserId = await resolveUserRowId(userId);

    const { data: b, error: bErr } = await supabase
      .from('bookings')
      .select('id,status,user_id,court_id,start_time,end_time')
      .eq('id', id)
      .maybeSingle();
    if (bErr) throw bErr;
    if (!b) return c.json({ error: 'Booking not found' }, 404);
    if (String(b.user_id) !== resolvedUserId) return c.json({ error: 'Forbidden' }, 403);
    if (b.status === 'cancelled' || b.status === 'completed') return c.json({ error: 'Booking already finished' }, 400);

    const { data: existing } = await supabase
      .from('booking_requests')
      .select('id,status')
      .eq('booking_id', id)
      .eq('status', 'pending')
      .maybeSingle();
    if (existing?.id) return c.json({ error: 'A request is already pending for this booking.' }, 409);

    // Derive duration from current start/end if possible
    let durHours = 1;
    try {
      const s = String(b.start_time || '').slice(0, 5);
      const e = String(b.end_time || '').slice(0, 5);
      const sMin = parseInt(s.slice(0, 2), 10) * 60 + parseInt(s.slice(3, 5), 10);
      const eMin = parseInt(e.slice(0, 2), 10) * 60 + parseInt(e.slice(3, 5), 10);
      const diff = eMin - sMin;
      if (diff > 0) durHours = diff / 60;
    } catch {}

    const requestedStart = `${newStart}:00`;
    const requestedEnd = addHoursToTime(requestedStart, durHours);
    const openMin = 7 * 60;
    const closeMin = 23 * 60;
    if (timeToMinutes(requestedStart) < openMin || timeToMinutes(requestedEnd) > closeMin) {
      return c.json({ error: 'Requested schedule must fit within facility hours: 7:00 AM to 11:00 PM.' }, 400);
    }

    const available = await bookingService.checkAvailability(
      b.court_id,
      newDate,
      requestedStart,
      requestedEnd,
      id
    );
    if (!available) {
      return c.json({ error: 'Requested time conflicts with another booking on the same court.' }, 409);
    }

    const row = {
      booking_id: id,
      request_type: 'reschedule',
      reason: reason || null,
      requested_new_date: newDate,
      requested_new_start_time: requestedStart,
      requested_new_end_time: requestedEnd,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from('booking_requests').insert([row]).select('*').single();
    if (error) throw error;
    return c.json(data, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Request failed' }, 400);
  }
});

// POST /api/bookings - Create a booking (legacy mobile flow)
bookingsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const bookingReq: BookingRequest = body;

    const booking = await bookingService.createBooking(bookingReq);
    return c.json(booking, 201);
  } catch (error: any) {
    return c.json(
      { error: error.message || 'Failed to create booking' },
      400
    );
  }
});

// GET /api/bookings/:userId - Get user's bookings
bookingsRouter.get('/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    if (userId === 'calendar' || userId === 'lookup' || userId === 'desk') {
      return c.json({ error: 'Not Found' }, 404);
    }
    const bookings = await bookingService.getUserBookings(userId);
    return c.json(bookings);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// GET /api/bookings/:courtId/availability - Check availability
bookingsRouter.get('/:courtId/availability', async (c) => {
  try {
    const { date, startTime, endTime, excludeBookingId } = c.req.query() as Record<string, string>;
    const courtId = c.req.param('courtId');

    const available = await bookingService.checkAvailability(
      courtId,
      date,
      startTime,
      endTime,
      excludeBookingId
    );

    return c.json({ available });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// DELETE /api/bookings/:id - Cancel booking
bookingsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await bookingService.cancelBooking(id);

    // Fetch and return the updated booking
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return c.json({ success: true, message: 'Booking cancelled' });
    }

    return c.json({ success: true, booking: data });
  } catch (error: any) {
    console.error('[bookings/delete]', error.message);
    return c.json({ error: error.message || 'Failed to cancel booking' }, 400);
  }
});

export default bookingsRouter;
