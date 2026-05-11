import { Hono } from 'hono';
import { bookingService } from '../services/bookingService.ts';
import { BookingRequest } from '../types';
import {
  createDeskBooking,
  listCalendarBookings,
  lookupBookingByRefOrId,
  checkInBooking,
  type DeskBookingInput,
} from '../services/deskBookingService.ts';
import { deskAdminRowToClientBooking } from '../utils/bookingMap.ts';

const bookingsRouter = new Hono();

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
      staff_id: staffRaw,
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
    const { date, startTime, endTime } = c.req.query() as Record<string, string>;
    const courtId = c.req.param('courtId');

    const available = await bookingService.checkAvailability(
      courtId,
      date,
      startTime,
      endTime
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
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default bookingsRouter;
