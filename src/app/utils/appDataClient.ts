import { getApiBaseUrl } from './apiBase';

export async function fetchAppData<T>(key: string): Promise<T | null> {
  const res = await fetch(`${getApiBaseUrl()}/api/app-data/${encodeURIComponent(key)}`);
  if (!res.ok) return null;
  const j = await res.json();
  if (j && typeof j === 'object' && 'error' in j) return null;
  return j as T;
}

export async function putAppData(key: string, value: unknown): Promise<boolean> {
  const res = await fetch(`${getApiBaseUrl()}/api/app-data/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  });
  return res.ok;
}
