import { Hono } from 'hono';

const coachesRouter = new Hono();

// GET /api/coaches - List all coaches (mock data)
coachesRouter.get('/', async (c) => {
  const coaches = [
    { id: 'c1', name: 'Juan Santos', sport: 'Basketball', hourlyRate: 800, rating: 4.8 },
    { id: 'c2', name: 'Maria Cruz', sport: 'Volleyball', hourlyRate: 700, rating: 4.9 },
  ];
  return c.json(coaches);
});

// POST /api/coaches/sessions - Request coaching
coachesRouter.post('/sessions', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ id: `cs${Date.now()}`, ...body, status: 'pending', created_at: new Date().toISOString() }, 201);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default coachesRouter;