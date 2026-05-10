import { Hono } from 'hono';

const usersRouter = new Hono();

// GET /api/users/:id - Get user profile
usersRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const user = {
      id,
      name: 'Sample User',
      email: 'user@example.com',
      phone: '+63 9XX XXX XXXX',
      loyaltyPoints: 5,
      favoriteSports: ['Basketball', 'Badminton'],
      memberSince: '2025-01-15',
      created_at: new Date().toISOString(),
    };
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
    return c.json({ id, ...body, updated_at: new Date().toISOString() });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

// GET /api/users/:id/loyalty - Get loyalty points
usersRouter.get('/:id/loyalty', async (c) => {
  try {
    const id = c.req.param('id');
    return c.json({
      userId: id,
      points: 5,
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
    return c.json([
      {
        id: 'b1',
        userId: id,
        sport: 'Basketball',
        court: 'Court 1',
        date: '2026-05-15',
        time: '14:00',
        status: 'completed',
      },
    ]);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default usersRouter;