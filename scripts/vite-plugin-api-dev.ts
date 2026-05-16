import type { Plugin } from 'vite';
import { spawn, type ChildProcess } from 'child_process';

/**
 * Starts `npm run api:dev` when Vite dev server boots so `/api` proxy (port 3000) works.
 * Set VITE_SKIP_API_DEV=1 to disable (e.g. when you run the API yourself).
 */
export function apiDevPlugin(): Plugin {
  let child: ChildProcess | null = null;

  return {
    name: 'sportsync-api-dev',
    apply: 'serve',
    configureServer() {
      if (process.env.VITE_SKIP_API_DEV === '1') {
        console.log('[sportsync] VITE_SKIP_API_DEV=1 — not starting API (use npm run api:dev separately)');
        return;
      }

      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      child = spawn(npm, ['run', 'api:dev'], {
        stdio: 'inherit',
        shell: true,
        env: process.env,
      });

      child.on('error', (err) => {
        console.warn('[sportsync] Could not start API dev server:', err.message);
        console.warn('[sportsync] Run `npm run api:dev` in another terminal, then refresh.');
      });

      child.on('exit', (code, signal) => {
        if (code !== 0 && code !== null && signal !== 'SIGTERM' && signal !== 'SIGKILL') {
          console.warn(`[sportsync] API dev process exited (code ${code}). Is port 3000 already in use?`);
        }
      });

      console.log('[sportsync] Starting API on http://127.0.0.1:3000 (proxied via /api)…');
    },
    buildEnd() {
      if (child && !child.killed) {
        child.kill('SIGTERM');
        child = null;
      }
    },
  };
}
