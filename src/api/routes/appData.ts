import { Hono } from 'hono';
import { appKvService } from '../services/appKvService.ts';

const appDataRouter = new Hono();

appDataRouter.get('/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const value = await appKvService.get(key);
    return c.json(value ?? null);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to load' }, 400);
  }
});

appDataRouter.put('/:key', async (c) => {
  try {
    const key = c.req.param('key');
    const body = await c.req.json();
    if (!('value' in body)) {
      return c.json({ error: 'Body must include { value: ... }' }, 400);
    }
    await appKvService.set(key, body.value);
    return c.json({ ok: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to save' }, 400);
  }
});

export default appDataRouter;
