/**
 * Base URL for the Node/Hono API (no trailing slash, no trailing `/api`).
 *
 * **Same-origin (Vercel, recommended):** leave `VITE_API_URL` unset. Requests go to
 * `/api/...` on your Vercel host; `api/index.ts` + `vercel.json` rewrites serve the
 * bundled Hono app from `src/api/`.
 *
 * **External API host:** set `VITE_API_URL` to the origin only, e.g.
 * `https://api.myapp.com` or `https://my-api.onrender.com` (not Supabase Edge URLs).
 * Paths stay `/api/users/sync`, etc.
 *
 * **Supabase Edge Functions (different stack):** set `VITE_API_URL` to
 * `https://<project-ref>.supabase.co/functions/v1` only if you migrate routes to Edge
 * Functions named to match paths (e.g. `users-sync` → you must change fetch paths).
 * This repo’s routes are implemented in `src/api/`, not Edge Functions.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL;
  if (typeof raw === "string" && raw.trim() !== "") {
    let b = raw.trim().replace(/\/+$/, "");
    if (/\/api$/i.test(b)) b = b.replace(/\/api$/i, "");
    return b;
  }
  return "";
}

/** Build full API URL: `${getApiBaseUrl()}/api/...` */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${p}`;
}
