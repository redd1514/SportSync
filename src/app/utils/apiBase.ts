/**
 * Base URL for the Node API (no trailing slash, no trailing `/api`).
 * - If `VITE_API_URL` is unset, returns `''` so requests use same-origin `/api/...`
 *   (use Vite `server.proxy` in dev, or deploy API behind the same host).
 * - Strips a mistaken trailing `/api` so `${base}/api/coaches` is never doubled.
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
