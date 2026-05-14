import { getApiBaseUrl } from './apiBase';
import { supabase } from './supabase/client';

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

/** Mint a SportSync API JWT after demo `/api/users/sync` (requires `SPORTSYNC_API_JWT_SECRET` on the API). */
export async function exchangeDemoApiToken(params: { authId: string; email: string }): Promise<{ error: string | null }> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auth_id: params.authId, email: params.email }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
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
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${p}`;
  const headers = new Headers(init?.headers ?? {});
  const token = await getAccessTokenForApi();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}
