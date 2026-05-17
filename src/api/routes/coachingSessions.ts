import { Hono } from 'hono';
import { coachingSessionService } from '../services/coachingSessionService.ts';
import { supabase } from '../services/supabaseClient.ts';

const coachingSessionsRouter = new Hono();

function mapSessionStatusForUi(dbStatus: string, adminNotes?: string | null): string {
  if (/COACHING_CHECKED_OUT|checked_out:/i.test(adminNotes || '')) return 'completed';
  if (/PAYMENT_VERIFIED|COACHING_CHECKED_IN|checked_in:/i.test(adminNotes || '')) return 'ongoing';
  if (/COACHING_RESCHEDULE_(REQUESTED|PROPOSED)/i.test(adminNotes || '') && !/COACHING_RESCHEDULE_(ACCEPTED|REJECTED)/i.test(adminNotes || '')) return 'reschedule_requested';
  if (dbStatus === 'approved' || dbStatus === 'scheduled') return 'confirmed';
  if (dbStatus === 'completed') return 'completed';
  return dbStatus;
}

// GET /api/coaching-sessions - List all coaching sessions
coachingSessionsRouter.get('/', async (c) => {
  try {
    const sessions = await coachingSessionService.listSessions();
    const [{ data: coaches }, { data: sports }, { data: users }] = await Promise.all([
      supabase.from('coaches').select('id, user_id, users(full_name,email)'),
      supabase.from('sports').select('id, name'),
      supabase.from('users').select('id, full_name, email'),
    ]);
    const userMap = new Map((users || []).map((u: any) => [String(u.id), u]));
    const coachMap = new Map((coaches || []).map((coach: any) => [String(coach.id), coach]));
    const sportMap = new Map((sports || []).map((sport: any) => [String(sport.id), sport]));

    return c.json((sessions || []).map((session: any) => {
      const coach = coachMap.get(String(session.coach_id));
      const rawCoachUser = coach?.users;
      const coachUser = Array.isArray(rawCoachUser) ? rawCoachUser[0] : rawCoachUser;
      const student = userMap.get(String(session.user_id));
      const sport = sportMap.get(String(session.sport_id));
      const notes = typeof session.notes === 'string' ? session.notes : '';
      const linkedBookingId = notes.match(/linked_booking:([0-9a-f-]+)/i)?.[1];
      return {
        ...session,
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
        linkedBookingId,
        status: mapSessionStatusForUi(String(session.status || 'pending'), session.admin_notes),
      };
    }));
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list coaching sessions' }, 400);
  }
});

// GET /api/coaching-sessions/user/:userId - Get coaching sessions for a user (as student)
coachingSessionsRouter.get('/user/:userId', async (c) => {
  try {
    const userId = c.req.param('userId');
    const sessions = await coachingSessionService.getSessionsByUserId(userId);
    return c.json(sessions);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get user coaching sessions' }, 400);
  }
});

// GET /api/coaching-sessions/coach/:coachId - Get coaching sessions for a coach
coachingSessionsRouter.get('/coach/:coachId', async (c) => {
  try {
    const coachId = c.req.param('coachId');
    const sessions = await coachingSessionService.getSessionsByCoachId(coachId);
    return c.json(sessions);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to get coach coaching sessions' }, 400);
  }
});

// POST /api/coaching-sessions - Create a coaching session
coachingSessionsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const session = await coachingSessionService.createSession({
      coach_id: String(body.coach_id || body.coachId),
      user_id: String(body.user_id || body.userId),
      sport_id: body.sport_id || body.sportId,
      session_date: String(body.session_date || body.sessionDate || body.requestedDate),
      start_time: String(body.start_time || body.startTime || body.requestedTime),
      end_time: body.end_time || body.endTime ? String(body.end_time || body.endTime) : undefined,
      duration_hours: body.duration_hours || body.durationHours,
      status: body.status || 'pending',
      linked_booking_id: body.linked_booking_id || body.linkedBookingId,
      payment_proof_url: body.payment_proof_url || body.paymentProofUrl,
    });
    return c.json(session, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create coaching session' }, 400);
  }
});

// PUT /api/coaching-sessions/:id - Update coaching session
coachingSessionsRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const session = await coachingSessionService.updateSession(id, {
      coach_id: body.coach_id,
      user_id: body.user_id,
      sport_id: body.sport_id,
      session_date: body.session_date,
      start_time: body.start_time,
      end_time: body.end_time,
      duration_hours: body.duration_hours,
      status: body.status,
      payment_proof_url: body.payment_proof_url,
      linked_booking_id: body.linked_booking_id,
    });
    return c.json(session);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update coaching session' }, 400);
  }
});

// PUT /api/coaching-sessions/:id/status - Update session status
coachingSessionsRouter.put('/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const session = await coachingSessionService.updateSessionStatus(
      id,
      body.status,
      body.admin_notes ?? body.adminNotes,
      body.staff_id ?? body.staffId,
    );
    return c.json(session);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update session status' }, 400);
  }
});

// POST /api/coaching-sessions/:id/review - Student coach rating after checkout
coachingSessionsRouter.post('/:id/review', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const session = await coachingSessionService.submitReview(
      id,
      String(body.user_id || body.userId || ''),
      Number(body.rating),
      body.comment,
    );
    return c.json({
      success: true,
      admin_notes: (session as any).admin_notes,
      reviewed_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to submit review' }, 400);
  }
});

// DELETE /api/coaching-sessions/:id - Delete coaching session
coachingSessionsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await coachingSessionService.deleteSession(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to delete coaching session' }, 400);
  }
});

export default coachingSessionsRouter;
