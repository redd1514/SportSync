import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

import bookingsRouter from './routes/bookings';
import coachesRouter from './routes/coaches';
import paymentsRouter from './routes/payments';
import usersRouter from './routes/users';
import adminRouter from './routes/admin';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Routes
app.route('/api/bookings', bookingsRouter);
app.route('/api/coaches', coachesRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/users', usersRouter);
app.route('/api/admin', adminRouter);

// 404 handler
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;