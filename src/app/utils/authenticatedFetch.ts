import { apiUrl, getApiBaseUrl } from './apiBase';
import { supabase } from './supabase/client';

/** Avoid `res.json()` on Vercel/HTML 404 pages ("The page could not be found"). */
export async function readApiJson<T = unknown>(res: Response): Promise<T> {
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  const text = await res.text();
  if (text.trimStart().startsWith('<') || /not found/i.test(text.slice(0, 80))) {
    throw new Error(
      `API returned HTML instead of JSON (${res.status}). ` +
        'Ensure Vercel deploy ran `build` (api bundle) and env vars include SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${res.status}`);
  }
}

const DEMO_API_JWT_KEY = 'sportsync_api_jwt';

export function setDemoApiToken(token: string) {
  try {
    sessionStorage.setItem(DEMO_API_JWT_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearDemoApiToken() {
  try {
    sessionStorage.removeItem(DEMO_API_JWT_KEY);
  } catch {
    /* ignore */
  }
}

export async function getAccessTokenForApi(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) return session.access_token;
  try {
    return sessionStorage.getItem(DEMO_API_JWT_KEY);
  } catch {
    return null;
  }
}

/**
 * Ensure the next apiFetch sends Authorization (Supabase session, refresh, or demo JWT).
 */
export async function ensureApiAuthForUser(user: {
  id: string;
  email: string;
}): Promise<{ ok: boolean; error?: string }> {
  const existing = await getAccessTokenForApi();
  if (existing) return { ok: true };

  const { data: refreshed } = await supabase.auth.refreshSession();
  if (refreshed.session?.access_token) return { ok: true };

  if (user?.email) {
    const tok = await exchangeDemoApiToken({ authId: user.id, email: user.email });
    if (!tok.error) return { ok: true };
    return { ok: false, error: tok.error || 'Unable to create a demo login token.' };
  }
  return { ok: false, error: 'Not signed in' };
}

/** Mint a SportSync API JWT after demo `/api/users/sync` (requires `SPORTSYNC_API_JWT_SECRET` on the API). */
export async function exchangeDemoApiToken(params: { authId: string; email: string }): Promise<{ error: string | null }> {
  const res = await fetch(apiUrl('/api/auth/token'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_id: params.authId, email: params.email }),
  });
  const data = await readApiJson<{ access_token?: string; error?: string }>(res).catch(() => ({}));
  if (!res.ok || !data.access_token) {
    clearDemoApiToken();
    if (data.error) console.warn('[api] Demo token exchange failed:', data.error);
    return { error: data.error || 'Unable to create a demo login token.' };
  }
  setDemoApiToken(data.access_token);
  return { error: null };
}

/** Authenticated fetch to the Node API (Supabase access_token or demo API JWT). */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = apiUrl(path.startsWith('/') ? path : `/${path}`);
  const headers = new Headers(init?.headers ?? {});
  const token = await getAccessTokenForApi();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export { getApiBaseUrl };
