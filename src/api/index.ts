import 'dotenv/config';
import { serve } from '@hono/node-server';
import app from './server.ts';

const port = parseInt(process.env.API_PORT || '3000', 10);

console.log(`🚀 API Server starting on http://localhost:${port}`);
console.log(
  `   API_AUTH_REQUIRED=${process.env.API_AUTH_REQUIRED === 'true' ? 'true (Bearer required on protected routes)' : 'false (open API; attach Bearer when present)'}`,
);

const server = serve({
  fetch: app.fetch,
  port,
}, () => {
  console.log(`🚀 API Server started`);
  console.log(`   URL: http://localhost:${port}`);
  console.log(`   Health: http://localhost:${port}/health`);
  console.log(`   API: http://localhost:${port}/api`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📴 Shutting down server...');
  process.exit(0);
});
