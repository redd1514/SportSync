import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import bookingsRouter from './routes/bookings.ts';
import coachesRouter from './routes/coaches.ts';
import paymentsRouter from './routes/payments.ts';
import usersRouter from './routes/users.ts';
import adminRouter from './routes/admin.ts';
import staffRouter from './routes/staff.ts';



const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Root endpoint
app.get('/', (c) => c.json({ 
  app: 'JRC SportSync API', 
  version: '1.0.0',
  endpoints: {
    health: '/health',
    bookings: '/api/bookings',
    coaches: '/api/coaches',
    payments: '/api/payments',
    users: '/api/users',
    admin: '/api/admin',
    staff: '/api/staff'
  }
}));

// Routes
app.route('/api/bookings', bookingsRouter);
app.route('/api/coaches', coachesRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/users', usersRouter);
app.route('/api/admin', adminRouter);
app.route('/api/staff', staffRouter);

// 404 handler
app.notFound((c) => c.json({ error: 'Not Found', path: c.req.path }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;