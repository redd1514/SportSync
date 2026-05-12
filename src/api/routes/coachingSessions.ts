import { Hono } from 'hono';
import { coachingSessionService } from '../services/coachingSessionService.ts';

const coachingSessionsRouter = new Hono();

// GET /api/coaching-sessions - List all coaching sessions
coachingSessionsRouter.get('/', async (c) => {
  try {
    const sessions = await coachingSessionService.listSessions();
    return c.json(sessions);
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
      end_time: String(body.end_time || body.endTime),
      status: body.status || 'pending',
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
      body.payment_proof_url || body.paymentProofUrl,
      body.linked_booking_id || body.linkedBookingId
    );
    return c.json(session);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update session status' }, 400);
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
