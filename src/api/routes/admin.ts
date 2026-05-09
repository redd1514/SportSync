import { Hono } from 'hono';

const adminRouter = new Hono();

// GET /api/admin/analytics - Get analytics
adminRouter.get('/analytics', async (c) => {
  return c.json({ message: 'Analytics endpoint - coming soon' });
});

export default adminRouter;