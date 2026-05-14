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
    const payload = {
      auth_id: authKey,
      email,
      role: normalizeUserRoleForDb(body.role),
      full_name: body.full_name || body.name || 'User',
      phone: body.phone || null,
    };

    const { data: byAuth } = await supabase.from('users').select('*').eq('auth_id', authKey).maybeSingle();
    let existingRow = byAuth;

    if (!existingRow) {
      const { data: byEmail } = await supabase.from('users').select('*').ilike('email', email).maybeSingle();
      existingRow = byEmail ?? null;
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
    return c.json({
      userId: id,
      points: user?.loyalty_points || 0,
      tier: 'bronze',
      redeemableAmount: 0,
      nextTierPoints: 10,
    });
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
        adminNotes: session.admin_notes,
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
    const user = await findUserRow(id);
    const targetId = user?.id || id;
    const { data, error } = await supabase.from('users').update(body).eq('id', targetId).select('*').single();
    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default usersRouter;
