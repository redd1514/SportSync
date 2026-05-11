import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import bookingsRouter from './routes/bookings.ts';
import coachesRouter from './routes/coaches.ts';
import { coachService } from './services/coachService.ts';
import paymentsRouter from './routes/payments.ts';
import usersRouter from './routes/users.ts';
import adminRouter from './routes/admin.ts';
import facilitiesRouter from './routes/facilities.ts';
import appDataRouter from './routes/appData.ts';
import coachApplicationsPatchRouter from './routes/coachApplicationsPatch.ts';
import { coachApplicationService } from './services/coachApplicationService.ts';



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
    coachApplications: '/api/coach-applications',
    appData: '/api/app-data',
    payments: '/api/payments',
    users: '/api/users',
    admin: '/api/admin',
    facilities: '/api/facilities',
  }
}));

// Routes
app.route('/api/bookings', bookingsRouter);

// Coaches: list + create on the root app so POST/GET /api/coaches always match (nested `post('/')` on a mount can 404 via some proxies).
app.get('/api/coaches', async (c) => {
  try {
    const coaches = await coachService.listCoaches();
    return c.json(coaches);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list coaches' }, 400);
  }
});

app.post('/api/coaches', async (c) => {
  try {
    const body = await c.req.json();
    const created = await coachService.createCoach({
      name: String(body.name || '').trim(),
      email: body.email ? String(body.email).trim() : undefined,
      sport: String(body.sport || '').trim(),
      hourlyRate: Number(body.hourlyRate ?? body.hourly_rate) || 0,
      description: String(body.description || body.bio || ''),
      availableDays: Array.isArray(body.availableDays) ? body.availableDays : [],
      timeRange: String(body.timeRange || body.time_range || ''),
      isAvailable: body.isAvailable !== false && body.is_available !== false,
      image: body.image ? String(body.image) : undefined,
    });
    return c.json(created, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to create coach' }, 400);
  }
});

app.route('/api/coaches', coachesRouter);

app.get('/api/coach-applications', async (c) => {
  try {
    const rows = await coachApplicationService.list();
    return c.json(rows);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list applications' }, 400);
  }
});

app.post('/api/coach-applications', async (c) => {
  try {
    const body = await c.req.json();
    const created = await coachApplicationService.create({
      userId: body.userId,
      userName: String(body.userName || '').trim(),
      userEmail: String(body.userEmail || '').trim(),
      sport: String(body.sport || '').trim(),
      experience: String(body.experience || ''),
      bio: String(body.bio || ''),
      availability: Array.isArray(body.availability) ? body.availability : [],
      requestedRate: Number(body.requestedRate ?? body.requested_rate) || 0,
      certifications: String(body.certifications || ''),
    });
    return c.json(created, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to submit application' }, 400);
  }
});

app.route('/api/coach-applications', coachApplicationsPatchRouter);
app.route('/api/app-data', appDataRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/users', usersRouter);
app.route('/api/admin', adminRouter);
app.route('/api/facilities', facilitiesRouter);

// 404 handler
app.notFound((c) => c.json({ error: 'Not Found', path: c.req.path }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;