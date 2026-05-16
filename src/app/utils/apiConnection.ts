/** True when fetch failed because nothing is listening on the API port (Vite proxy → :3000). */
export function isApiConnectionError(err: unknown): boolean {
  if (!(err instanceof TypeError)) return false;
  const msg = err.message.toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed');
}

export const API_OFFLINE_HINT =
  'The API server is not reachable. Run `npm run dev` (starts API + Vite together) or `npm run api:dev` in a second terminal on port 3000.';
