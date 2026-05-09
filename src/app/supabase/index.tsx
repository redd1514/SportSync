// @ts-nocheck
import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import * as kv from './kv_store.tsx';

const app = new Hono();

app.use('*', cors());
app.use('*', logger(console.log));

// Health check
app.get('/make-server-5628f883/health', (c) => c.text('OK'));

// GET /bookings?date=YYYY-MM-DD&sport=SportName
app.get('/make-server-5628f883/bookings', async (c) => {
  const date = c.req.query('date');
  const sport = c.req.query('sport');

  if (!date || !sport) {
    return c.json({ error: 'Missing date or sport' }, 400);
  }

  try {
    // Key format: booking:YYYY-MM-DD:SportName:TimeSlot
    const prefix = `booking:${date}:${sport}`;
    const bookings = await kv.getByPrefix(prefix);
    
    // Extract just the time slots from the keys
    // key is like "booking:2023-10-27:Basketball:08:00 AM"
    const bookedSlots = bookings.map(item => {
      const parts = item.key.split(':');
      return parts[parts.length - 1]; // The last part is the time
    });

    return c.json({ bookedSlots });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// GET /admin/bookings - Fetch ALL bookings for analytics
app.get('/make-server-5628f883/admin/bookings', async (c) => {
  try {
    const bookings = await kv.getByPrefix("booking:");
    
    // Transform into a structured array
    const parsedBookings = bookings.map(item => {
      const parts = item.key.split(':');
      // key: booking:2023-10-27:Basketball:08:00 AM
      return {
        key: item.key,
        date: parts[1],
        sport: parts[2],
        time: parts[3],
        details: item.value // Contains email, timestamp, etc.
      };
    });

    return c.json({ bookings: parsedBookings });
  } catch (error) {
    console.error('Error fetching admin bookings:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// POST /bookings
app.post('/make-server-5628f883/bookings', async (c) => {
  const body = await c.req.json();
  const { date, sport, time, email } = body;

  if (!date || !sport || !time) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  const key = `booking:${date}:${sport}:${time}`;

  try {
    // Check if already booked
    const existing = await kv.get(key);
    if (existing) {
      return c.json({ error: 'Slot already booked' }, 409);
    }

    // Save booking
    await kv.set(key, { 
      email: email || 'anonymous',
      timestamp: new Date().toISOString(),
      status: 'confirmed'
    });

    return c.json({ success: true, message: 'Booking confirmed' });
  } catch (error) {
    console.error('Error creating booking:', error);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

Deno.serve(app.fetch);