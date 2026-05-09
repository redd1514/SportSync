import { Hono } from 'hono';
import { bookingService } from '../services/bookingService';
import { BookingRequest } from '../types';

const bookingsRouter = new Hono();

// POST /api/bookings - Create a booking
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
    const bookings = await bookingService.getUserBookings(userId);
    return c.json(bookings);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// GET /api/bookings/:courtId/availability - Check availability
bookingsRouter.get('/:courtId/availability', async (c) => {
  try {
    const { date, startTime, endTime } = c.req.query() as any;
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