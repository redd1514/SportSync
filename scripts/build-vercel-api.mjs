/**
 * Bundle src/api/server.ts for Vercel Node serverless (api/index.ts).
 * Resolves .ts import suffixes and tree-shakes into a single ESM module.
 */
import * as esbuild from 'esbuild';
import { mkdir } from 'node:fs/promises';

await mkdir('api', { recursive: true });

await esbuild.build({
  entryPoints: ['src/api/server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'api/_handler.mjs',
  packages: 'external',
  logLevel: 'info',
});

console.log('[build] Vercel API bundle → api/_handler.mjs');
