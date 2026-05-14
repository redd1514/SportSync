import { Hono } from 'hono';
import { bookingService } from '../services/bookingService.ts';
import { paymentService } from '../services/paymentService.ts';
import { supabase } from '../services/supabaseClient.ts';

const adminRouter = new Hono();

function toIsoDate(value: Date): string {
  return value.toISOString().split('T')[0];
}

function toLocalDateString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfWeek(date: Date): Date {
  const copy = startOfWeek(date);
  copy.setDate(copy.getDate() + 6);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function currencyTotal(rows: Array<{ amount?: number | string | null }>): number {
  return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
}

function bookingSortTimestamp(row: any): number {
  const datePart = row?.date || row?.booking_date || '';
  const startTimePart = row?.startTime || row?.start_time || '00:00';
  const createdAt = row?.createdAt || row?.created_at || '';
  const dateTs = datePart ? new Date(`${datePart}T${startTimePart}:00`).getTime() : 0;
  const createdTs = createdAt ? new Date(createdAt).getTime() : 0;
  return Math.max(Number.isNaN(dateTs) ? 0 : dateTs, Number.isNaN(createdTs) ? 0 : createdTs);
}

// GET /api/admin/bookings - Get all bookings with filters (client-shaped rows)
adminRouter.get('/bookings', async (c) => {
  try {
    const date = c.req.query('date');
    const start = c.req.query('start');
    const end = c.req.query('end');

    const filters = date ? { date } : start && end ? { start, end } : {};
    const allBookings = await bookingService.getAllBookings(filters);

    // Resolve missing customer names by looking up users via both id and auth_id
    const unresolvedUserIds = [...new Set(
      (allBookings || [])
        .filter((b: any) => !b.customer_name && b.user_id)
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

    // Map bookings to client shape
    const bookings = (allBookings || []).map((b) => ({
    id: b.id,
    refCode: b.id,
    customerName: (b as { customer_name?: string }).customer_name || customerByAnyId[String(b.user_id || '')] || 'Customer',
    court: (b as any).court_name || b.court_id || 'Court',
    date: b.booking_date,
    startTime: b.start_time,
    time: `${b.start_time} - ${b.end_time}`,
    amount: b.total_price || 0,
    status: b.status || 'pending',
    createdAt: (b as any).created_at || '',
}));

    return c.json(bookings || []);
  } catch (error: any) {
    console.error('[Admin API] Booking fetch error:', error.message);
    return c.json([], 200);
  }
});

adminRouter.get('/analytics', async (c) => {
  try {
    const now = new Date();
    const startParam = c.req.query('start');
    const endParam = c.req.query('end');
    const rangeStart = startParam ? new Date(startParam) : new Date(now.getFullYear(), now.getMonth(), 1);
    const rangeEnd = endParam ? new Date(endParam) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const rangeStartStr = toIsoDate(rangeStart);
    const rangeEndStr = toIsoDate(rangeEnd);

    const [bookingRes, paymentRes, userRes, courtRes, coachRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, user_id, booking_date, start_time, status, total_price, created_at, court_id, courts(name, sports(name)), users(full_name, email)')
        .gte('booking_date', rangeStartStr)
        .lte('booking_date', rangeEndStr)
        .order('booking_date', { ascending: false })
        .limit(500),
      supabase
        .from('payments')
        .select('amount, status, created_at, booking_id')
        .gte('created_at', rangeStart.toISOString())
        .lte('created_at', rangeEnd.toISOString()),
      supabase.from('users').select('id, is_active').limit(1000),
      supabase.from('courts').select('id, is_active').limit(1000),
      supabase.from('coaches').select('rating, review_count').limit(1000),
    ]);

    if (bookingRes.error) throw bookingRes.error;
    if (paymentRes.error) throw paymentRes.error;
    if (userRes.error) throw userRes.error;
    if (courtRes.error) throw courtRes.error;
    if (coachRes.error) throw coachRes.error;

    const unresolvedUserIds = [...new Set(
      (bookingRes.data || [])
        .filter((row: any) => !row.users?.full_name && !row.users?.email && row.user_id)
        .map((row: any) => String(row.user_id))
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

    const bookingRows = (bookingRes.data || []).map((row: any) => {
      const sportName = row.courts?.sports?.name || row.courts?.name || row.sport || 'Unknown';
      return {
        id: row.id,
        userId: row.user_id,
        date: row.booking_date,
        startTime: row.start_time || '00:00',
        amount: Number(row.total_price || 0),
        status: row.status || 'pending',
        sport: sportName,
        customerName: row.users?.full_name || row.users?.email || customerByAnyId[String(row.user_id || '')] || 'Customer',
        court: row.courts?.name || row.court_id || 'Court',
        createdAt: row.created_at || '',
      };
    });

    const completedPayments = (paymentRes.data || []).filter((row: any) => row.status === 'completed');
    const paymentRevenue = currencyTotal(completedPayments);
    const totalRevenue = paymentRevenue > 0 ? paymentRevenue : bookingRows.reduce((sum, row) => {
      if (row.status === 'cancelled' || row.status === 'rejected') return sum;
      return sum + Number(row.amount || 0);
    }, 0);

    const totalBookings = bookingRows.length;
    const activeUsers = (userRes.data || []).filter((row: any) => row.is_active !== false).length;
    const suspendedUsers = (userRes.data || []).filter((row: any) => row.is_active === false).length;
    const totalCourts = (courtRes.data || []).length;
    const openCourts = (courtRes.data || []).filter((row: any) => row.is_active !== false).length;

    const statusBreakdown = bookingRows.reduce((acc: Record<string, number>, row) => {
      const key = String(row.status || 'pending');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const revenueBySportMap = bookingRows.reduce((acc: Record<string, number>, row) => {
      if (row.status === 'cancelled' || row.status === 'rejected') return acc;
      acc[row.sport] = (acc[row.sport] || 0) + Number(row.amount || 0);
      return acc;
    }, {});

    const topSport = Object.entries(revenueBySportMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    const weekStart = startOfWeek(now);
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      return day;
    });
    const weeklyRevenue = weekDays.map((day) => {
      const iso = toIsoDate(day);
      const amount = bookingRows.reduce((sum, row) => {
        if (row.date !== iso) return sum;
        if (row.status === 'cancelled' || row.status === 'rejected') return sum;
        return sum + Number(row.amount || 0);
      }, 0);
      return { day: dayLabel(day), amount };
    });

    const todayIso = toLocalDateString(new Date());
    const todayRevenue = bookingRows.reduce((sum, row) => {
      if (row.date !== todayIso) return sum;
      if (row.status === 'cancelled' || row.status === 'rejected') return sum;
      return sum + Number(row.amount || 0);
    }, 0);

    const averageBookingValue = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;
    const avgCoachRatingRows = (coachRes.data || []).filter((row: any) => typeof row.rating === 'number' && row.review_count !== 0);
    const avgRating = avgCoachRatingRows.length
      ? Number((avgCoachRatingRows.reduce((sum: number, row: any) => sum + Number(row.rating || 0), 0) / avgCoachRatingRows.length).toFixed(2))
      : 0;

    const recentBookings = [...bookingRows]
      .sort((a, b) => {
        const tsDiff = bookingSortTimestamp(b) - bookingSortTimestamp(a);
        if (tsDiff !== 0) return tsDiff;
        return String(b.id || '').localeCompare(String(a.id || ''));
      })
      .slice(0, 6);
    const revenueBySport = Object.entries(revenueBySportMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));

    return c.json({
      period: new Date(rangeStart).toLocaleString('en-US', { month: 'long', year: 'numeric' }),
      range: { start: rangeStartStr, end: rangeEndStr },
      summary: {
        totalBookings,
        totalRevenue: Math.round(totalRevenue),
        todayRevenue: Math.round(todayRevenue),
        activeUsers,
        suspendedUsers,
        totalCourts,
        openCourts,
        avgRating,
        averageBookingValue,
        topSport,
      },
      bookings: bookingRows,
      recentBookings,
      weeklyRevenue,
      revenueBySport,
      statusBreakdown,
    } as any);
  } catch (error: any) {
    console.error('[Admin API] analytics:', error.message);
    return c.json({
      summary: {
        totalBookings: 0,
        totalRevenue: 0,
        todayRevenue: 0,
        activeUsers: 0,
        suspendedUsers: 0,
        totalCourts: 0,
        openCourts: 0,
        avgRating: 0,
        averageBookingValue: 0,
        topSport: '—',
      },
      bookings: [],
      recentBookings: [],
      weeklyRevenue: [],
      revenueBySport: [],
      statusBreakdown: {},
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
      accountStatus: u.is_active === false ? 'suspended' : 'active',
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

/** Default module labels for staff permission UI (mirrors RoleManagementAdmin). */
const DEFAULT_STAFF_PERMISSIONS = [
  'Dashboard',
  'Booking Management',
  'Court Status',
  'Coaching Requests',
  'User Account Management',
  'Announcements',
];

function mapDbUserToStaffPayload(u: {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean | null;
  auth_id: string;
}) {
  const emailLocal = String(u.email || '').split('@')[0] || 'staff';
  return {
    id: String(u.id),
    name: String(u.full_name || emailLocal),
    email: String(u.email || ''),
    username: emailLocal,
    role: u.role === 'admin' ? ('admin' as const) : ('staff' as const),
    status: u.is_active === false ? ('inactive' as const) : ('active' as const),
    permissions: [...DEFAULT_STAFF_PERMISSIONS],
  };
}

/** GET /api/admin/staff — staff + admin rows from `users`, enriched from Auth metadata when service role is available. */
adminRouter.get('/staff', async (c) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active, auth_id')
      .in('role', ['staff', 'admin'])
      .order('created_at', { ascending: false });
    if (error) throw error;

    const base = (data || []).map((u: any) => mapDbUserToStaffPayload(u));
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return c.json(base);
    }

    const enriched = await Promise.all(
      (data || []).map(async (u: any, i: number) => {
        const row = { ...base[i] };
        try {
          const { data: au, error: gErr } = await supabase.auth.admin.getUserById(String(u.auth_id));
          if (gErr || !au?.user?.user_metadata) return row;
          const meta = au.user.user_metadata as Record<string, unknown>;
          if (typeof meta.sportsync_username === 'string' && meta.sportsync_username.trim()) {
            row.username = meta.sportsync_username.trim();
          }
          if (Array.isArray(meta.sportsync_permissions) && meta.sportsync_permissions.length) {
            row.permissions = meta.sportsync_permissions.map(String);
          }
        } catch {
          /* keep defaults */
        }
        return row;
      }),
    );

    return c.json(enriched);
  } catch (e: any) {
    console.error('[Admin API] staff list:', e?.message);
    return c.json({ error: e?.message || 'Failed to list staff' }, 400);
  }
});

/** POST /api/admin/staff — Supabase Auth user + `public.users` row (requires service role). */
adminRouter.post('/staff', async (c) => {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return c.json(
        {
          error:
            'SUPABASE_SERVICE_ROLE_KEY must be set on the API server to create staff accounts with passwords.',
          code: 'SERVICE_ROLE_REQUIRED',
        },
        503,
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const username = String(body.username || '').trim() || email.split('@')[0] || 'staff';
    const password = String(body.password || '');
    const role = String(body.role || 'staff').toLowerCase() === 'admin' ? 'admin' : 'staff';
    const status = body.status === 'inactive' ? 'inactive' : 'active';
    const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [...DEFAULT_STAFF_PERMISSIONS];

    if (!name || !email) return c.json({ error: 'name and email are required' }, 400);
    if (password.length < 6) return c.json({ error: 'password must be at least 6 characters' }, 400);

    const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (existing?.id) return c.json({ error: 'A user with this email already exists' }, 409);

    const { data: created, error: cErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        sportsync_username: username,
        sportsync_permissions: permissions,
      },
    });
    if (cErr) throw cErr;
    const authUser = created?.user;
    if (!authUser?.id) return c.json({ error: 'Auth user was not created' }, 500);

    const { data: row, error: iErr } = await supabase
      .from('users')
      .insert([
        {
          auth_id: authUser.id,
          email,
          full_name: name,
          role,
          is_active: status === 'active',
        },
      ])
      .select('id, email, full_name, role, is_active, auth_id')
      .single();

    if (iErr) {
      await supabase.auth.admin.deleteUser(authUser.id);
      throw iErr;
    }

    const payload = mapDbUserToStaffPayload(row as any);
    payload.username = username;
    payload.permissions = permissions;
    return c.json(payload, 201);
  } catch (e: any) {
    console.error('[Admin API] staff create:', e?.message);
    return c.json({ error: e?.message || 'Failed to create staff' }, 400);
  }
});

/** PUT /api/admin/staff/:id — update profile, role, status, optional password; merges Auth user_metadata. */
adminRouter.put('/staff/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));

    const { data: row, error: fErr } = await supabase
      .from('users')
      .select('id, auth_id, email, full_name, role, is_active')
      .eq('id', id)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!row?.id) return c.json({ error: 'Not found' }, 404);
    if (row.role !== 'staff' && row.role !== 'admin') {
      return c.json({ error: 'This account is not staff or admin' }, 400);
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (typeof body.name === 'string' && body.name.trim()) updates.full_name = body.name.trim();
    if (typeof body.email === 'string' && body.email.trim()) updates.email = body.email.trim().toLowerCase();
    if (body.role === 'admin' || body.role === 'staff') updates.role = body.role;
    if (body.status === 'active' || body.status === 'inactive') updates.is_active = body.status === 'active';

    const { error: uErr } = await supabase.from('users').update(updates).eq('id', id);
    if (uErr) throw uErr;

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { data: auData, error: gErr } = await supabase.auth.admin.getUserById(String(row.auth_id));
      if (!gErr && auData?.user) {
        const prevMeta = (auData.user.user_metadata || {}) as Record<string, unknown>;
        const nextMeta: Record<string, unknown> = { ...prevMeta, full_name: updates.full_name ?? prevMeta.full_name ?? row.full_name };
        if (typeof body.username === 'string') {
          nextMeta.sportsync_username = body.username.trim() || prevMeta.sportsync_username;
        }
        if (Array.isArray(body.permissions)) {
          nextMeta.sportsync_permissions = body.permissions.map(String);
        }

        const authPatch: Record<string, unknown> = { user_metadata: nextMeta };
        const pwd = String(body.password || '');
        if (pwd.length >= 6) authPatch.password = pwd;
        if (typeof body.email === 'string' && body.email.trim()) {
          authPatch.email = String(body.email).trim().toLowerCase();
        }

        const { error: aErr } = await supabase.auth.admin.updateUserById(String(row.auth_id), authPatch as any);
        if (aErr) console.error('[Admin API] staff auth update:', aErr.message);
      }
    }

    const { data: fresh } = await supabase
      .from('users')
      .select('id, email, full_name, role, is_active, auth_id')
      .eq('id', id)
      .single();

    const payload = mapDbUserToStaffPayload(fresh as any);
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { data: au } = await supabase.auth.admin.getUserById(String(fresh!.auth_id));
        const meta = au?.user?.user_metadata as Record<string, unknown> | undefined;
        if (typeof meta?.sportsync_username === 'string' && meta.sportsync_username.trim()) {
          payload.username = meta.sportsync_username.trim();
        }
        if (Array.isArray(meta?.sportsync_permissions) && meta.sportsync_permissions.length) {
          payload.permissions = meta.sportsync_permissions.map(String);
        }
      } catch {
        /* ignore */
      }
    }
    return c.json(payload);
  } catch (e: any) {
    console.error('[Admin API] staff update:', e?.message);
    return c.json({ error: e?.message || 'Failed to update staff' }, 400);
  }
});

/** PUT /api/admin/staff/:id/deactivate — convenience alias */
adminRouter.put('/staff/:id/deactivate', async (c) => {
  try {
    const { data: row } = await supabase.from('users').select('id').eq('id', c.req.param('id')).maybeSingle();
    if (!row?.id) return c.json({ error: 'Not found' }, 404);
    await supabase.from('users').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', row.id);
    return c.json({ id: row.id, status: 'inactive' });
  } catch (e: any) {
    return c.json({ error: e?.message }, 400);
  }
});

export default adminRouter;


