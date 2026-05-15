import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.ts';
import { coachingSessionService, listCoachProfileIdsForViewer } from '../services/coachingSessionService.ts';
import { findUserRow, isUuid, toStableUuid } from '../services/userRowQuery.ts';

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

function mapSessionStatusForUi(dbStatus: string): string {
  if (dbStatus === 'approved' || dbStatus === 'scheduled') return 'confirmed';
  if (dbStatus === 'completed') return 'confirmed';
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

    const sessions = await coachingSessionService.listSessionsForParticipant(usersTableId);

    const coachIdsForViewer = await listCoachProfileIdsForViewer(usersTableId);
    const viewerCoachIdSet = new Set(coachIdsForViewer.map((id) => String(id)));

    const { data: coaches } = await supabase.from('coaches').select('*');
    const { data: sports } = await supabase.from('sports').select('*');
    const { data: users } = await supabase.from('users').select('*');

    const sportMap = new Map((sports || []).map((s: any) => [s.id, s]));
    const userMap = new Map((users || []).map((u: any) => [u.id, u]));

    const mapped = sessions.map((session: any) => {
      const coach = (coaches || []).find((co: any) => String(co.id) === String(session.coach_id));
      const sport = sportMap.get(session.sport_id);
      const coachUser = coach ? userMap.get(coach.user_id) : null;
      const student = userMap.get(session.user_id);
      const notes = typeof session.notes === 'string' ? session.notes : '';
      const linkedBookingId = notes.match(/linked_booking:([0-9a-f-]+)/i)?.[1];
      const viewerIsStudent = String(session.user_id) === String(usersTableId);
      const viewerIsCoachForThisSession = viewerCoachIdSet.has(String(session.coach_id));

      return {
        id: session.id,
        userId: session.user_id,
        userName: student?.full_name || student?.email || 'Unknown User',
        coachId: session.coach_id,
        coachName: coachUser?.full_name || coachUser?.email || 'Unknown Coach',
        sport: sport?.name || 'Unknown Sport',
        requestedDate: session.session_date,
        requestedTime: session.start_time,
        endTime: session.end_time,
        message: notes,
        notes,
        adminNotes: session.admin_notes,
        linkedBookingId,
        durationHours: session.duration_hours != null ? Number(session.duration_hours) : undefined,
        status: mapSessionStatusForUi(String(session.status || 'pending')),
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
