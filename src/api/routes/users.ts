import { Hono } from 'hono';
import { createHash } from 'crypto';
import { supabase } from '../services/supabaseClient.ts';

const usersRouter = new Hono();

function toStableUuid(input: string): string {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function findUserRow(id: string) {
  const byId = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (byId.data) return byId.data;

  const byAuthId = await supabase.from('users').select('*').eq('auth_id', id).maybeSingle();
  if (byAuthId.data) return byAuthId.data;

  return null;
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

    const payload = {
      auth_id: isUuid(authId) ? authId : toStableUuid(authId),
      email,
      role: body.role || 'user',
      full_name: body.full_name || body.name || 'User',
      phone: body.phone || null,
    };

    const existing = await supabase.from('users').select('*').eq('auth_id', payload.auth_id).maybeSingle();
    const { data, error } = existing.data
      ? await supabase.from('users').update(payload).eq('auth_id', payload.auth_id).select('*').single()
      : await supabase.from('users').insert([payload]).select('*').single();

    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
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
    const { data, error } = await supabase.from('users').update(body).eq('id', id).select('*').single();
    if (error) throw error;
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

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

export default usersRouter;