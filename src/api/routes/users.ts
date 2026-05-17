import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.ts';
import { coachingSessionService, listCoachProfileIdsForViewer } from '../services/coachingSessionService.ts';
import { findUserRow, isUuid, toStableUuid } from '../services/userRowQuery.ts';
import { parseBookingNotes } from '../utils/bookingMap.ts';

const usersRouter = new Hono();

function extractUsersRouterId(path: string): string | null {
  const m = path.match(/\/users\/([^/]+)/);
  if (m?.[1]) return m[1];
  const stripped = path.startsWith('/') ? path.slice(1) : path;
  const first = stripped.split('/')[0];
  if (first && first !== 'sync') return first;
  return null;
}

/** When `API_AUTH_REQUIRED=true`: POST /sync stays public; other routes need Bearer + self scope (or staff/admin). */
usersRouter.use(async (c, next) => {
  const path = c.req.path;
  const syncPost =
    c.req.method === 'POST' &&
    (path === '/api/users/sync' || path.endsWith('/users/sync') || path === '/sync');
  if (syncPost) return next();

  if (process.env.API_AUTH_REQUIRED !== 'true') return next();

  const auth = c.get('auth');
  if (!auth) return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);

  const seg1 = extractUsersRouterId(path);
  if (!seg1 || seg1 === 'sync') return next();

  if (auth.appRole === 'admin' || auth.appRole === 'staff') return next();

  const target = await findUserRow(seg1);
  const targetId = target?.id as string | undefined;
  if (!targetId) return next();

  if (String(targetId) !== String(auth.userId)) {
    return c.json({ error: 'Forbidden', code: 'USER_SCOPE' }, 403);
  }
  return next();
});

function mapSessionStatusForUi(dbStatus: string, adminNotes?: string | null): string {
  if (/COACHING_CHECKED_OUT|checked_out:/i.test(adminNotes || '')) return 'completed';
  if (/PAYMENT_VERIFIED|COACHING_CHECKED_IN|checked_in:/i.test(adminNotes || '')) return 'ongoing';
  if (/COACHING_RESCHEDULE_(REQUESTED|PROPOSED)/i.test(adminNotes || '') && !/COACHING_RESCHEDULE_(ACCEPTED|REJECTED)/i.test(adminNotes || '')) return 'reschedule_requested';
  if (dbStatus === 'approved' || dbStatus === 'scheduled') return 'confirmed';
  if (dbStatus === 'completed') return 'completed';
  return dbStatus;
}

function normalizeUserRoleForDb(role: unknown): 'user' | 'staff' | 'admin' {
  const r = String(role || 'user')
    .trim()
    .toLowerCase();
  if (r === 'admin' || r === 'staff' || r === 'user') return r;
  // DB CHECK only allows user/staff/admin (see migrations). "coach" is app-level; store as user.
  return 'user';
}

async function ensureCoachingSessionsForUserBookings(usersTableId: string) {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id,user_id,booking_date,start_time,end_time,total_price,notes,status,courts(name)')
    .eq('user_id', usersTableId)
    .not('notes', 'is', null)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;

  for (const booking of bookings || []) {
    const meta = parseBookingNotes((booking as any).notes);
    const addOns = String(meta.addOns || '').trim();
    const looksLikeCoaching =
      !!meta.coachId ||
      /coaching/i.test(String(meta.source || '')) ||
      /coaching\s+with/i.test(addOns);
    if (!looksLikeCoaching) continue;

    const linkedBookingId = String((booking as any).id);
    const { data: existing, error: existingErr } = await supabase
      .from('coaching_sessions')
      .select('id')
      .ilike('notes', `%linked_booking:${linkedBookingId}%`)
      .limit(1);
    if (existingErr) throw existingErr;
    if ((existing || []).length > 0) continue;

    let coachId = typeof meta.coachId === 'string' ? meta.coachId : '';
    if (!coachId) {
      const coachName = String(meta.coachName || addOns.match(/coaching\s+with\s+([^|]+)/i)?.[1] || '')
        .trim()
        .toLowerCase();
      if (coachName) {
        const { data: coaches } = await supabase
          .from('coaches')
          .select('id, users(full_name,email)')
          .limit(250);
        const matched = (coaches || []).find((coach: any) => {
          const rawUser = coach.users;
          const coachUser = Array.isArray(rawUser) ? rawUser[0] : rawUser;
          const fullName = String(coachUser?.full_name || '').trim().toLowerCase();
          const email = String(coachUser?.email || '').trim().toLowerCase();
          const fullNameMatches = !!fullName && (fullName === coachName || fullName.includes(coachName) || coachName.includes(fullName));
          return fullNameMatches || (!!email && email === coachName);
        });
        coachId = String((matched as any)?.id || '');
      }
    }
    if (!coachId) continue;

    const totalDue = Math.max(0, Number(meta.totalDue ?? meta.totalPrice ?? (booking as any).total_price ?? 0));
    const coachFee = Math.max(0, Number(meta.coachFee || 0));
    const courtAmount = Math.max(0, Number(meta.courtAmount ?? (coachFee ? totalDue - coachFee : totalDue)));
    const courtName = Array.isArray((booking as any).courts)
      ? (booking as any).courts[0]?.name
      : (booking as any).courts?.name;
    try {
      await coachingSessionService.createSession({
        coach_id: coachId,
        user_id: usersTableId,
        session_date: String((booking as any).booking_date || ''),
        start_time: String((booking as any).start_time || '09:00:00'),
        end_time: String((booking as any).end_time || ''),
        status: 'confirmed',
        linked_booking_id: linkedBookingId,
        payment_proof_url: `COACHING_BOOKING:${JSON.stringify({
          linkedBookingId,
          court: courtName,
          courtAmount,
          coachFee,
          totalDue,
          paidBy: 'student',
          bookingQr: meta.refCode,
        })}`,
      });
    } catch (err) {
      console.warn('[users/coaching-sessions] Could not repair coaching session for booking', linkedBookingId, (err as any)?.message || err);
    }
  }
}

// POST /api/users/sync - Upsert a DB user row for an auth session or demo account
usersRouter.post('/sync', async (c) => {
  try {
    const body = await c.req.json();
    const authId = String(body.auth_id || '').trim();
    const email = String(body.email || '').trim();
    if (!authId || !email) {
      return c.json({ error: 'auth_id and email are required' }, 400);
    }

    const authKey = isUuid(authId) ? authId : toStableUuid(authId);
    const incomingRole = normalizeUserRoleForDb(body.role);

    const { data: byAuth } = await supabase.from('users').select('*').eq('auth_id', authKey).maybeSingle();
    let existingRow = byAuth;

    if (!existingRow) {
      const { data: byEmail } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();
      existingRow = byEmail ?? null;
    }

    /** Do not let a generic "user" sync from the client wipe staff/admin rows (Supabase session bootstrap sends role user). */
    const payload: Record<string, unknown> = {
      auth_id: authKey,
      email,
      full_name: body.full_name || body.name || 'User',
      phone: body.phone || null,
    };
    if (!existingRow) {
      payload.role = incomingRole;
    } else {
      const existingRole = String(existingRow.role || 'user').toLowerCase();
      const wouldDowngradeStaffOrAdmin =
        (existingRole === 'staff' || existingRole === 'admin') && incomingRole === 'user';
      if (!wouldDowngradeStaffOrAdmin) {
        payload.role = incomingRole;
      }
    }

    const { data, error } = existingRow
      ? await supabase.from('users').update(payload).eq('id', existingRow.id).select('*').single()
      : await supabase.from('users').insert([payload]).select('*').single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// Register multi-segment routes before `/:id` so paths like `/x/coaching-sessions` are not captured as `id = "x"` only.

// GET /api/users/email-exists?email=x - Public signup precheck.
usersRouter.get('/email-exists', async (c) => {
  try {
    const email = String(c.req.query('email') || '').trim().toLowerCase();
    if (!email) return c.json({ exists: false });

    const { data: publicUser, error: publicErr } = await supabase
      .from('users')
      .select('id')
      .ilike('email', email)
      .maybeSingle();
    if (publicErr) throw publicErr;
    if (publicUser?.id) return c.json({ exists: true });

    if (typeof supabase.auth.admin?.listUsers === 'function') {
      for (let page = 1; page <= 10; page += 1) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
        if (error) break;
        const found = (data?.users || []).some(
          (u) => String(u.email || '').trim().toLowerCase() === email,
        );
        if (found) return c.json({ exists: true });
        if (!data?.users || data.users.length < 1000) break;
      }
    }

    return c.json({ exists: false });
  } catch (error: any) {
    return c.json({ error: error.message || 'Email check failed' }, 400);
  }
});

// GET /api/users/:id/loyalty - Get loyalty points
usersRouter.get('/:id/loyalty', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await findUserRow(id);
    if (!user) return c.json({ error: 'User not found' }, 404);
    const { data: transactions } = await supabase
      .from('loyalty_transactions')
      .select('id, points_change, transaction_type, reference_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25);
    const points = Number(user?.loyalty_points || 0);
    return c.json({
      userId: user.id,
      points,
      tier: points >= 30 ? 'gold' : points >= 10 ? 'silver' : 'bronze',
      redeemableAmount: 0,
      nextTierPoints: 10,
      rewardThreshold: 10,
      rewardsAvailable: Math.floor(points / 10),
      pointsToNextReward: (10 - (points % 10)) % 10,
      transactions: transactions || [],
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

usersRouter.post('/:id/loyalty/add-test', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await findUserRow(id);
    if (!user) return c.json({ error: 'User not found' }, 404);

    await supabase.from('loyalty_transactions').insert({
      user_id: user.id,
      points_change: 1,
      transaction_type: 'manual_test',
      reference_id: null,
    });

    const next = Number(user.loyalty_points || 0) + 1;
    const { data, error } = await supabase
      .from('users')
      .update({ loyalty_points: next })
      .eq('id', user.id)
      .select('id, loyalty_points')
      .single();
    if (error) throw error;
    return c.json({
      userId: data.id,
      points: data.loyalty_points || 0,
      rewardsAvailable: Math.floor(Number(data.loyalty_points || 0) / 10),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

usersRouter.post('/:id/loyalty/reset', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await findUserRow(id);
    if (!user) return c.json({ error: 'User not found' }, 404);

    await supabase
      .from('loyalty_transactions')
      .insert({
        user_id: user.id,
        points_change: -Number(user.loyalty_points || 0),
        transaction_type: 'manual_reset',
        reference_id: null,
      });

    const { data, error } = await supabase
      .from('users')
      .update({ loyalty_points: 0 })
      .eq('id', user.id)
      .select('id, loyalty_points')
      .single();
    if (error) throw error;
    return c.json({ userId: data.id, points: data.loyalty_points || 0 });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

usersRouter.post('/:id/loyalty/redeem', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const points = Math.max(10, Number(body.points || 10));
    const user = await findUserRow(id);
    if (!user) return c.json({ error: 'User not found' }, 404);
    if (Number(user.loyalty_points || 0) < points) return c.json({ error: 'Not enough loyalty points' }, 400);

    await supabase.from('loyalty_transactions').insert({
      user_id: user.id,
      points_change: -points,
      transaction_type: 'redemption',
      reference_id: null,
    });
    const next = Number(user.loyalty_points || 0) - points;
    const { data, error } = await supabase
      .from('users')
      .update({ loyalty_points: next })
      .eq('id', user.id)
      .select('id, loyalty_points')
      .single();
    if (error) throw error;
    return c.json({ userId: data.id, points: data.loyalty_points || 0, rewardsAvailable: Math.floor(Number(data.loyalty_points || 0) / 10) });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// GET /api/users/:id/bookings - Get booking history
usersRouter.get('/:id/bookings', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await findUserRow(id);
    const userId = user?.id || id;
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('user_id', userId)
      .order('booking_date', { ascending: false });
    if (error) throw error;
    return c.json(data || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// GET /api/users/:id/coaching-sessions — sessions where this user is the student OR the coach
usersRouter.get('/:id/coaching-sessions', async (c) => {
  try {
    const paramId = c.req.param('id');
    const userRow = await findUserRow(paramId);
    const usersTableId = userRow?.id as string | undefined;
    if (!usersTableId) {
      return c.json([]);
    }

    await ensureCoachingSessionsForUserBookings(usersTableId);
    const sessions = await coachingSessionService.listSessionsForParticipant(usersTableId);

    const coachIdsForViewer = await listCoachProfileIdsForViewer(usersTableId);
    const viewerCoachIdSet = new Set(coachIdsForViewer.map((id) => String(id)));

    const linkedBookingIds = Array.from(new Set(
      sessions
        .map((session: any) => String(session.notes || '').match(/linked_booking:([0-9a-f-]+)/i)?.[1])
        .filter(Boolean)
    ));

    const { data: coaches } = await supabase.from('coaches').select('*');
    const { data: sports } = await supabase.from('sports').select('*');
    const { data: users } = await supabase.from('users').select('*');
    const { data: linkedBookings } = linkedBookingIds.length > 0
      ? await supabase
          .from('bookings')
          .select('id,court_id,booking_date,start_time,end_time,status,total_price,notes,qr_code_token,courts(name)')
          .in('id', linkedBookingIds)
      : { data: [] as any[] };
    const { data: pendingLinkedRequests } = linkedBookingIds.length > 0
      ? await supabase
          .from('booking_requests')
          .select('booking_id, request_type, requested_new_date, requested_new_start_time, requested_new_end_time')
          .in('booking_id', linkedBookingIds)
          .eq('status', 'pending')
      : { data: [] as any[] };
    const pendingRequestMap = new Map((pendingLinkedRequests || []).map((r: any) => [String(r.booking_id), r]));

    const sportMap = new Map((sports || []).map((s: any) => [s.id, s]));
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));
    const bookingDetailMap = new Map((linkedBookings || []).map((b: any) => {
      const meta = parseBookingNotes(b.notes);
      const totalAmount = Number(meta.totalDue ?? meta.totalPrice ?? b.total_price ?? 0);
      const downpaymentAmount =
        meta.downpaymentAmount != null ? Number(meta.downpaymentAmount) : undefined;
      return [String(b.id), {
        bookingDate: b.booking_date,
        courtId: b.court_id,
        startTime: b.start_time,
        endTime: b.end_time,
        status: b.status,
        refCode: b.qr_code_token || meta.refCode,
        courtName: (Array.isArray(b.courts) ? b.courts[0]?.name : b.courts?.name) || meta.court,
        courtAmount: meta.courtAmount != null ? Number(meta.courtAmount) : undefined,
        coachFee: meta.coachFee != null ? Number(meta.coachFee) : undefined,
        totalAmount,
        downpaymentAmount,
        downpaymentPercentage: meta.downpaymentPercentage != null ? Number(meta.downpaymentPercentage) : undefined,
        balanceDue:
          meta.balanceDue != null
            ? Number(meta.balanceDue)
            : downpaymentAmount != null
              ? Math.max(0, totalAmount - downpaymentAmount)
              : undefined,
      }];
    }));

    const mapped = sessions.map((session: any) => {
      const coach = (coaches || []).find((co: any) => String(co.id) === String(session.coach_id));
      const sport = sportMap.get(session.sport_id);
      const coachUser = coach ? userMap.get(coach.user_id) : null;
      const student = userMap.get(session.user_id);
      const notes = typeof session.notes === 'string' ? session.notes : '';
      const linkedBookingId = notes.match(/linked_booking:([0-9a-f-]+)/i)?.[1];
      const linkedDetails = linkedBookingId ? bookingDetailMap.get(String(linkedBookingId)) : undefined;
      const pendingLinkedRequest = linkedBookingId ? pendingRequestMap.get(String(linkedBookingId)) : undefined;
      const viewerIsStudent = String(session.user_id) === String(usersTableId);
      const viewerIsCoachForThisSession = viewerCoachIdSet.has(String(session.coach_id));
      const bookingStatus = String((linkedDetails as any)?.status || '');
      const isLinkedBookingCancelled = bookingStatus === 'cancelled' || bookingStatus === 'rejected';
      const isPaidLinkedBooking =
        !isLinkedBookingCancelled &&
        (bookingStatus === 'confirmed' ||
          bookingStatus === 'checked_in' ||
          bookingStatus === 'completed' ||
          bookingStatus === 'rescheduled' ||
          Number((linkedDetails as any)?.downpaymentAmount || 0) > 0);
      const baseStatus = mapSessionStatusForUi(String(session.status || 'pending'), session.admin_notes);
      const rawCoachFee = Number((linkedDetails as any)?.coachFee || 0);
      const durationHours = (() => {
        if (session.duration_hours != null && Number(session.duration_hours) > 0) return Number(session.duration_hours);
        const start = String((linkedDetails as any)?.startTime || session.start_time || '').slice(0, 5);
        const end = String((linkedDetails as any)?.endTime || session.end_time || '').slice(0, 5);
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        const diff = (eh * 60 + em) - (sh * 60 + sm);
        return diff > 0 ? diff / 60 : undefined;
      })();
      const fallbackCoachFee = Math.max(0, Number((coach as any)?.hourly_rate || 0) * Math.max(1, Number(durationHours || 1)));
      const coachFee = rawCoachFee > 0 ? rawCoachFee : fallbackCoachFee;
      const totalAmount = Number((linkedDetails as any)?.totalAmount || 0);
      const courtAmount = (linkedDetails as any)?.courtAmount != null && Number((linkedDetails as any).courtAmount) > 0
        ? Number((linkedDetails as any).courtAmount)
        : Math.max(0, totalAmount - coachFee);
      const status = isLinkedBookingCancelled
        ? 'rejected'
        : bookingStatus === 'completed'
          ? 'completed'
          : bookingStatus === 'checked_in'
            ? 'ongoing'
          : baseStatus === 'pending' && isPaidLinkedBooking
            ? 'confirmed'
            : baseStatus;

      return {
        id: session.id,
        userId: session.user_id,
        userName: student?.full_name || student?.email || 'Unknown User',
        coachId: session.coach_id,
        coachName: coachUser?.full_name || coachUser?.email || 'Unknown Coach',
        sport: sport?.name || 'Unknown Sport',
        requestedDate: String((linkedDetails as any)?.bookingDate || session.session_date),
        requestedTime: String((linkedDetails as any)?.startTime || session.start_time),
        endTime: String((linkedDetails as any)?.endTime || session.end_time),
        message: notes,
        notes,
        adminNotes: session.admin_notes,
        linkedBookingId,
        courtId: linkedDetails?.courtId,
        courtName: linkedDetails?.courtName,
        courtAmount,
        coachFee,
        totalAmount,
        downpaymentAmount: linkedDetails?.downpaymentAmount,
        downpaymentPercentage: linkedDetails?.downpaymentPercentage,
        balanceDue: linkedDetails?.balanceDue,
        coachCourtQr: (linkedDetails as any)?.refCode,
        pendingLinkedBookingChange: pendingLinkedRequest ? {
          type: pendingLinkedRequest.request_type,
          requestedDate: pendingLinkedRequest.requested_new_date,
          requestedStartTime: pendingLinkedRequest.requested_new_start_time,
          requestedEndTime: pendingLinkedRequest.requested_new_end_time,
        } : null,
        durationHours,
        status,
        viewerIsStudent,
        viewerIsCoachForThisSession,
      };
    });

    return c.json(mapped);
  } catch (error: any) {
    console.error('Error fetching coaching sessions:', error);
    return c.json([]);
  }
});

// GET /api/users/:id - Get user profile
usersRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = await findUserRow(id);
    if (!user) return c.json({ error: 'Not Found' }, 404);
    return c.json(user);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// PUT /api/users/:id - Update user profile
usersRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    // 1. Logic from Incoming: Get the specific target ID
    const user = await findUserRow(id);
    const targetId = user?.id || id;

    // 2. Logic from Current: Transform account status
    const updates: Record<string, unknown> = { ...body };
    if (Object.prototype.hasOwnProperty.call(updates, 'accountStatus')) {
      updates.is_active = String(updates.accountStatus).toLowerCase() !== 'suspended';
      delete updates.accountStatus;
    }

    // 3. Update Supabase using the targetId and the cleaned updates object
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', targetId)
      .select('*')
      .single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default usersRouter;
