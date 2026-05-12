import { Hono } from 'hono';
import { coachService } from '../services/coachService.ts';
import { coachingSessionService } from '../services/coachingSessionService.ts';

const coachesRouter = new Hono();

// Register static paths before /:id patterns.
// POST /api/coaches/sessions — request coaching (redirects to new API)
coachesRouter.post('/sessions', async (c) => {
  try {
    const body = await c.req.json();
    // Create session using new service
    const session = await coachingSessionService.createSession({
      coach_id: body.coach_id || body.coachId,
      user_id: body.user_id || body.userId,
      session_date: body.session_date || body.requestedDate,
      start_time: body.start_time || body.requestedTime,
      end_time: body.end_time || body.endTime,
      status: 'pending',
    });
    return c.json(session, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// GET /api/coaches and POST /api/coaches are registered on the main app in server.ts (reliable with Vite proxy).

// PUT /api/coaches/:id — update coach
coachesRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await coachService.updateCoach(id, {
      name: body.name !== undefined ? String(body.name).trim() : undefined,
      email: body.email !== undefined ? String(body.email).trim() : undefined,
      sport: body.sport !== undefined ? String(body.sport).trim() : undefined,
      hourlyRate: body.hourlyRate !== undefined ? Number(body.hourlyRate) : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
      availableDays: body.availableDays !== undefined ? body.availableDays : undefined,
      timeRange: body.timeRange !== undefined ? String(body.timeRange) : undefined,
      isAvailable: body.isAvailable !== undefined ? Boolean(body.isAvailable) : undefined,
      image: body.image !== undefined ? (body.image ? String(body.image) : undefined) : undefined,
    });
    return c.json(updated);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update coach' }, 400);
  }
});

// DELETE /api/coaches/:id — delete or soft-hide if coaching_sessions exist
coachesRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    await coachService.deleteCoach(id);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to delete coach' }, 400);
  }
});

export default coachesRouter;
