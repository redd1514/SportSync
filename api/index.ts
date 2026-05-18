/**
 * Vercel Serverless entry: all `/api/*` traffic (see vercel.json rewrites).
 * Built by `scripts/build-vercel-api.mjs` → `api/_handler.mjs`.
 */
import { getRequestListener } from '@hono/node-server';

// Bundled Hono app (generated at build time by scripts/build-vercel-api.mjs)
// @ts-expect-error — emitted during `pnpm run build`, not in dev until built
import app from './_handler.mjs';

export const config = {
  maxDuration: 60,
};

export default getRequestListener((request) => app.fetch(request));
