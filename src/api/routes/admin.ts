import { Hono } from 'hono';
import { bookingService } from '../services/bookingService.ts';
import { paymentService } from '../services/paymentService.ts';
import { supabase } from '../services/supabaseClient.ts';

const adminRouter = new Hono();

// GET /api/admin/bookings - Get all bookings with filters (client-shaped rows)
adminRouter.get('/bookings', async (c) => {
  try {
    const date = c.req.query('date');
    const start = c.req.query('start');
    const end = c.req.query('end');

    const filters = date ? { date } : start && end ? { start, end } : {};
    const allBookings = await bookingService.getAllBookings(filters);

// Keep the mapping logic from your current branch to satisfy your UI needs
    const bookings = (allBookings || []).map((b) => ({
    id: b.id,
    refCode: b.id,
    customerName: (b as { customer_name?: string }).customer_name || 'Customer',
    court: b.court_id || 'Court',
    date: b.booking_date,
    time: `${b.start_time} - ${b.end_time}`,
    amount: b.total_price || 0,
    status: b.status || 'pending',
}));

    return c.json(bookings || []);
  } catch (error: any) {
    console.error('[Admin API] Booking fetch error:', error.message);
    return c.json([], 200);
  }
});

adminRouter.get('/analytics', async (c) => {
  try {
    const period = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const { count: bookingCount } = await supabase.from('bookings').select('*', { count: 'exact', head: true });
    const { data: payRows } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'completed');
    const totalRevenue = (payRows || []).reduce((s, p: { amount: number }) => s + Number(p.amount || 0), 0);
    const { count: userCount } = await supabase.from('users').select('*', { count: 'exact', head: true });

    return c.json({
      totalBookings: bookingCount ?? 0,
      totalRevenue: Math.round(totalRevenue),
      activeUsers: userCount ?? 0,
      avgRating: 4.7,
      topSport: 'Basketball',
      period,
    });
  } catch (error: any) {
    console.error('[Admin API] analytics:', error.message);
    return c.json({
      totalBookings: 0,
      totalRevenue: 0,
      activeUsers: 0,
      avgRating: 0,
      topSport: '—',
      period: '—',
    });
  }
});

adminRouter.get('/pending-requests', async (c) => {
  try {
    const { data: reqs, error: reqErr } = await supabase
      .from('booking_requests')
      .select('id, booking_id, reason, status, request_type')
      .eq('status', 'pending')
      .eq('request_type', 'cancellation')
      .limit(200);
    if (reqErr) throw reqErr;

    const bookingIds = [...new Set((reqs || []).map((r: { booking_id: string }) => r.booking_id))];
    let bookingsMap: Record<string, any> = {};
    if (bookingIds.length > 0) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, booking_date, start_time, court_id, user_id')
        .in('id', bookingIds);
      for (const b of bookings || []) bookingsMap[b.id] = b;
    }

    const userIds = [...new Set(Object.values(bookingsMap).map((b: any) => b.user_id))];
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, full_name, email').in('id', userIds);
      for (const u of users || []) usersMap[u.id] = u;
    }

    const courtIds = [...new Set(Object.values(bookingsMap).map((b: any) => b.court_id).filter(Boolean))];
    let courtsMap: Record<string, any> = {};
    if (courtIds.length > 0) {
      const { data: courts } = await supabase.from('courts').select('id, name').in('id', courtIds);
      for (const ct of courts || []) courtsMap[ct.id] = ct;
    }

    const cancellations = (reqs || []).map((r: { id: string; booking_id: string; reason: string; status: string }) => {
      const b = bookingsMap[r.booking_id];
      const u = b ? usersMap[b.user_id] : null;
      const court = b ? courtsMap[b.court_id] : null;
      return {
        id: r.id,
        bookingId: r.booking_id,
        customerName: u?.full_name || u?.email || 'Customer',
        date: b?.booking_date || '',
        time: b?.start_time || '',
        court: court?.name || b?.court_id || 'Court',
        reason: r.reason || '',
        status: r.status,
      };
    });

    const { data: sessions, error: sessErr } = await supabase
      .from('coaching_sessions')
      .select('id, session_date, start_time, status, sport_id, coach_id, user_id')
      .eq('status', 'pending')
      .limit(100);
    if (sessErr) throw sessErr;

    const sRows = sessions || [];
    const clientIds = [...new Set(sRows.map((r: { user_id: string }) => r.user_id))];
    const coachRowIds = [...new Set(sRows.map((r: { coach_id: string }) => r.coach_id))];
    const sportIds = [...new Set(sRows.map((r: { sport_id: string }) => r.sport_id))];

    let clientMap: Record<string, string> = {};
    if (clientIds.length) {
      const { data: urows } = await supabase.from('users').select('id, full_name, email').in('id', clientIds);
      for (const u of urows || []) clientMap[u.id] = u.full_name || u.email || 'Client';
    }

    let coachNameMap: Record<string, string> = {};
    if (coachRowIds.length) {
      const { data: crows } = await supabase.from('coaches').select('id, user_id').in('id', coachRowIds);
      const coachUserIds = [...new Set((crows || []).map((c: { user_id: string }) => c.user_id))];
      const userNames: Record<string, string> = {};
      if (coachUserIds.length) {
        const { data: un } = await supabase.from('users').select('id, full_name, email').in('id', coachUserIds);
        for (const u of un || []) userNames[u.id] = u.full_name || u.email || 'Coach';
      }
      for (const c of crows || []) {
        coachNameMap[c.id] = userNames[c.user_id] || 'Coach';
      }
    }

    let sportMap: Record<string, string> = {};
    if (sportIds.length) {
      const { data: sprows } = await supabase.from('sports').select('id, name').in('id', sportIds);
      for (const s of sprows || []) sportMap[s.id] = s.name;
    }

    const coaching = sRows.map((row: any) => ({
      id: row.id,
      userName: clientMap[row.user_id] || 'Client',
      coachName: coachNameMap[row.coach_id] || 'Coach',
      sport: sportMap[row.sport_id] || 'Sports',
      requestedDate: row.session_date,
      requestedTime: row.start_time,
      status: row.status,
    }));

    return c.json({ cancellations, coaching });
  } catch (error: any) {
    console.error('[Admin API] pending-requests:', error.message);
    return c.json({ cancellations: [], coaching: [] });
  }
});

adminRouter.get('/users', async (c) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, phone, loyalty_points, is_active, role')
      .order('created_at', { ascending: false })
      .limit(500);
    if (error) throw error;

    const rows = (data || []).map((u: any) => ({
      id: u.id,
      name: u.full_name || u.email || 'User',
      email: u.email,
      phone: u.phone || '',
      totalBookings: 0,
      loyaltyPoints: u.loyalty_points ?? 0,
      accountStatus: u.is_active === false ? 'inactive' : 'active',
      role: u.role,
    }));

    return c.json(rows);
  } catch (error: any) {
    console.error('[Admin API] users:', error.message);
    return c.json([], 200);
  }
});

// GET /api/admin/payments - Payment transactions from Supabase
adminRouter.get('/payments', async (c) => {
  try {
    const { listPaymentsJoined } = await import('../services/deskBookingService.ts');
    const rows = await listPaymentsJoined();
    return c.json(rows);
  } catch (error: any) {
    console.error('[Admin API] Payments fetch error:', error.message);
    return c.json([], 200);
  }
});

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

adminRouter.post('/verify-payment', async (c) => {
  try {
    const body = await c.req.json();
    const id = body.id;
    if (id) {
      await supabase
        .from('payments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', id);
    }
    return c.json({ success: true, id: body.id, verified_at: new Date().toISOString() });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

adminRouter.post('/approve-cancellation', async (c) => {
  try {
    const body = await c.req.json();
    const requestId = body.id;
    if (!requestId) return c.json({ error: 'id required' }, 400);

    const { data: br } = await supabase.from('booking_requests').select('booking_id').eq('id', requestId).maybeSingle();
    await supabase
      .from('booking_requests')
      .update({ status: 'approved', processed_at: new Date().toISOString() })
      .eq('id', requestId);
    if (br?.booking_id) {
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', br.booking_id);
    }
    return c.json({ success: true, id: requestId, approved_at: new Date().toISOString() });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default adminRouter;
