import { Hono } from 'hono';
import { coachApplicationService } from '../services/coachApplicationService.ts';

const coachApplicationsPatchRouter = new Hono();

coachApplicationsPatchRouter.patch('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const status = body.status as 'pending' | 'approved' | 'rejected';
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return c.json({ error: 'Invalid status' }, 400);
    }
    const updated = await coachApplicationService.updateStatus(id, status);
    return c.json(updated);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to update' }, 400);
  }
});

export default coachApplicationsPatchRouter;
