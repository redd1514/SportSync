import { Hono } from 'hono';
import { signSportsyncDemoJwt } from '../auth/apiJwt.ts';
import { getJwtSecret, isUserRowSuspended, resolveBearerUserRow } from '../auth/resolveBearer.ts';
import { findUserRow, isUuid, toStableUuid } from '../services/userRowQuery.ts';

const authRouter = new Hono();

/**
 * Issue a SportSync-signed JWT for clients that cannot use a Supabase session token (demo logins).
 * Requires `SPORTSYNC_API_JWT_SECRET` on the server. Real Supabase users should send `Authorization: Bearer <supabase access_token>` instead.
 */
authRouter.post('/token', async (c) => {
  try {
    const secret = getJwtSecret();
    if (!secret) {
      return c.json(
        { error: 'SPORTSYNC_API_JWT_SECRET is not set; cannot mint demo API tokens.' },
        503
      );
    }

    const body = await c.req.json().catch(() => ({}));
    const authId = String(body.auth_id || '').trim();
    const email = String(body.email || '').trim();
    if (!authId || !email) {
      return c.json({ error: 'auth_id and email are required' }, 400);
    }

    const authKey = isUuid(authId) ? authId : toStableUuid(authId);
    const row = (await findUserRow(authId)) || (await findUserRow(authKey));
    if (!row) {
      return c.json({ error: 'Unknown user; call POST /api/users/sync first.' }, 401);
    }
    if (String(row.auth_id) !== String(authKey)) {
      return c.json({ error: 'auth_id does not match this account.' }, 401);
    }
    if (String(row.email || '').trim().toLowerCase() !== email.toLowerCase()) {
      return c.json({ error: 'email does not match this account.' }, 401);
    }
    if (isUserRowSuspended(row as Record<string, any>)) {
      return c.json(
        { error: 'Your account is suspended. Please contact an administrator.', code: 'ACCOUNT_SUSPENDED' },
        403
      );
    }

    const access_token = signSportsyncDemoJwt({ sub: String(row.id), email: String(row.email) }, secret);
    const exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    return c.json({
      access_token,
      token_type: 'Bearer',
      expires_at: exp,
      user: { id: row.id, email: row.email },
    });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Token error' }, 400);
  }
});

authRouter.get('/status', async (c) => {
  try {
    const row = await resolveBearerUserRow(c.req.header('Authorization'));
    if (!row) {
      return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
    }

    if (isUserRowSuspended(row)) {
      return c.json(
        { error: 'Your account is suspended. Please contact an administrator.', code: 'ACCOUNT_SUSPENDED' },
        403
      );
    }

    return c.json({
      ok: true,
      code: 'ACCOUNT_ACTIVE',
      userId: String(row.id),
      email: String(row.email || ''),
      accountStatus: 'active',
    });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Status error' }, 400);
  }
});

export default authRouter;
