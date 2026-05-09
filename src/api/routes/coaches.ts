import { Hono } from 'hono';

const coachesRouter = new Hono();

// GET /api/coaches - List all coaches
coachesRouter.get('/', async (c) => {
  return c.json({ message: 'Coaches list endpoint - coming soon' });
});

// POST /api/coaching-sessions - Request coaching
coachesRouter.post('/sessions', async (c) => {
  return c.json({ message: 'Coaching request endpoint - coming soon' });
});

export default coachesRouter;