import type { MiddlewareHandler } from 'hono';
import type { AppRole } from '../auth/types.ts';
import { resolveBearer } from '../auth/resolveBearer.ts';

export function isPublicApiRoute(method: string, path: string): boolean {
  if (path === '/health' || path === '/') return true;
  if (method === 'POST' && (path === '/api/users/sync' || path.endsWith('/api/users/sync'))) return true;
  if (method === 'POST' && (path === '/api/auth/token' || path.endsWith('/api/auth/token'))) return true;
  if (method === 'GET' && (path === '/api/auth/status' || path.endsWith('/api/auth/status'))) return true;
  if (method === 'GET' && (path === '/api/announcements/published' || path.endsWith('/api/announcements/published')))
    return true;
  if (method === 'GET' && path === '/api/coaches') return true;
  if (method === 'GET' && path.startsWith('/api/facilities')) return true;
  return false;
}

/** When `API_AUTH_REQUIRED=true`, requires a valid Bearer except public routes. Always attaches `auth` when token is valid. */
export const attachOrRequireAuth: MiddlewareHandler = async (c, next) => {
  const path = c.req.path;
  const method = c.req.method;

  if (isPublicApiRoute(method, path)) {
    const auth = await resolveBearer(c.req.header('Authorization'));
    if (auth) c.set('auth', auth);
    return next();
  }

  const required = process.env.API_AUTH_REQUIRED === 'true';
  const auth = await resolveBearer(c.req.header('Authorization'));
  if (auth) c.set('auth', auth);

  if (!required) return next();
  if (!auth) {
    return c.json({ error: 'Unauthorized', code: 'BEARER_REQUIRED' }, 401);
  }
  return next();
};

export function requireAppRoles(...allowed: AppRole[]): MiddlewareHandler {
  return async (c, next) => {
    if (process.env.API_AUTH_REQUIRED !== 'true') return next();
    const auth = c.get('auth');
    if (!auth) return c.json({ error: 'Unauthorized', code: 'AUTH_CONTEXT_MISSING' }, 401);
    if (!allowed.includes(auth.appRole)) {
      return c.json(
        { error: 'Forbidden', code: 'ROLE_REQUIRED', requiredRoles: allowed, role: auth.appRole },
        403
      );
    }
    return next();
  };
}
