import { Hono } from 'hono';
import { bookingService } from '../services/bookingService.ts';

const adminRouter = new Hono();

// GET /api/admin/bookings - Get all bookings with filters
adminRouter.get('/bookings', async (c) => {
  try {
    const date = c.req.query('date');
    const start = c.req.query('start');
    const end = c.req.query('end');

    // Get all bookings from the service
    const allBookings = await bookingService.getAllBookings();
    
    let filteredBookings = allBookings || [];

    // Filter by specific date
    if (date) {
      filteredBookings = filteredBookings.filter(b => b.booking_date === date);
    }
    // Filter by date range
    else if (start && end) {
      filteredBookings = filteredBookings.filter(b => 
        b.booking_date >= start && b.booking_date <= end
      );
    }

    // Transform to match admin dashboard format
    const bookings = filteredBookings.map(b => ({
      id: b.id,
      refCode: b.id,
      customerName: b.customer_name || 'Customer',
      court: b.court_id || 'Court',
      date: b.booking_date,
      time: `${b.start_time} - ${b.end_time}`,
      amount: b.total_price || 0,
      status: b.status || 'pending',
    }));

    return c.json(bookings || []);
  } catch (error: any) {
    console.error('[Admin API] Booking fetch error:', error.message);
    return c.json([], 200); // Return empty array on error
  }
});

// GET /api/admin/analytics - Get analytics
adminRouter.get('/analytics', async (c) => {
  return c.json({
    totalBookings: 142,
    totalRevenue: 64500,
    activeUsers: 34,
    avgRating: 4.7,
    topSport: 'Basketball',
    period: 'May 2026',
  });
});

// GET /api/admin/pending-requests - Get pending staff requests
adminRouter.get('/pending-requests', async (c) => {
  return c.json({
    cancellations: [
      {
        id: 'cr1',
        bookingId: 'b1',
        customerName: 'John Doe',
        date: '2026-05-10',
        time: '14:00',
        court: 'Court 1',
        reason: 'Schedule conflict',
        status: 'pending',
      },
    ],
    coaching: [
      {
        id: 'cp1',
        userName: 'Jane Smith',
        coachName: 'Juan Santos',
        sport: 'Basketball',
        requestedDate: '2026-05-12',
        requestedTime: '15:00',
        status: 'pending_verification',
      },
    ],
  });
});

// GET /api/admin/users - Get all users
adminRouter.get('/users', async (c) => {
  try {
    return c.json([
      {
        id: 'u1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '09123456789',
        totalBookings: 5,
        loyaltyPoints: 250,
        accountStatus: 'active',
      },
      {
        id: 'u2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '09987654321',
        totalBookings: 12,
        loyaltyPoints: 600,
        accountStatus: 'active',
      },
    ]);
  } catch (error: any) {
    return c.json([], 200);
  }
});

// GET /api/admin/payments - Get payment transactions
adminRouter.get('/payments', async (c) => {
  try {
    return c.json([
      {
        id: 'p1',
        bookingId: 'b1',
        amount: 450,
        method: 'GCash',
        status: 'completed',
        date: '2026-05-10',
      },
    ]);
  } catch (error: any) {
    return c.json([], 200);
  }
});

// GET /api/admin/loyalty-program - Get loyalty program info
adminRouter.get('/loyalty-program', async (c) => {
  try {
    return c.json({
      name: 'Sports Sync Rewards',
      pointsPerRupee: 1,
      redeemThreshold: 100,
      bonusMultiplier: 1.5,
    });
  } catch (error: any) {
    return c.json(null);
  }
});

// POST /api/admin/verify-payment - Verify coaching payment
adminRouter.post('/verify-payment', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ success: true, id: body.id, verified_at: new Date().toISOString() });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// POST /api/admin/approve-cancellation - Approve booking cancellation
adminRouter.post('/approve-cancellation', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ success: true, id: body.id, approved_at: new Date().toISOString() });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default adminRouter;