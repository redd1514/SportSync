import './types/honoEnv.ts';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import bookingsRouter from './routes/bookings.ts';
import coachesRouter from './routes/coaches.ts';
import coachingSessionsRouter from './routes/coachingSessions.ts';
import { coachService } from './services/coachService.ts';
import paymentsRouter from './routes/payments.ts';
import usersRouter from './routes/users.ts';
import adminRouter from './routes/admin.ts';
import staffRouter from './routes/staff.ts';
import facilitiesRouter from './routes/facilities.ts';
import appDataRouter from './routes/appData.ts';
import coachApplicationsPatchRouter from './routes/coachApplicationsPatch.ts';
import { coachApplicationService } from './services/coachApplicationService.ts';
import announcementsRouter from './routes/announcements.ts';
import notificationsRouter from './routes/notifications.ts';
import chatRoute from './routes/chatRoute.js';
import authRouter from './routes/auth.ts';
import { attachOrRequireAuth, requireAppRoles } from './middleware/authGate.ts';

const app = new Hono();

// Middleware
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use('*', logger());
app.use('*', attachOrRequireAuth);

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Root endpoint
// Root endpoint
app.get('/', (c) => {
  return c.json({
    app: 'JRC SportSync API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth/token',
      bookings: '/api/bookings',
      coaches: '/api/coaches',
      coachApplications: '/api/coach-applications',
      appData: '/api/app-data',
      payments: '/api/payments',
      users: '/api/users',
      staff: '/api/staff',
      admin: '/api/admin',
      facilities: '/api/facilities',
      chat: '/api/chat',
    },
  });
});

app.route('/api/auth', authRouter);

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
    if (process.env.API_AUTH_REQUIRED === 'true') {
      const auth = c.get('auth');
      if (!auth) return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
      if (auth.appRole !== 'admin') {
        return c.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, 403);
      }
    }
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

app.route('/api/coaching-sessions', coachingSessionsRouter);

app.get('/api/coach-applications', async (c) => {
  try {
    if (process.env.API_AUTH_REQUIRED === 'true') {
      const auth = c.get('auth');
      if (!auth) return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
      if (auth.appRole !== 'admin') {
        return c.json({ error: 'Forbidden', code: 'ADMIN_ONLY' }, 403);
      }
    }
    const rows = await coachApplicationService.list();
    return c.json(rows);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to list applications' }, 400);
  }
});

app.post('/api/coach-applications', async (c) => {
  try {
    if (process.env.API_AUTH_REQUIRED === 'true') {
      const auth = c.get('auth');
      if (!auth) return c.json({ error: 'Unauthorized', code: 'AUTH_REQUIRED' }, 401);
    }
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
      photoUrl: body.photoUrl || body.photo_url || null,
      applicationType: body.applicationType || body.application_type || 'new',
      requestDetails: body.requestDetails || body.request_details || '',
    });
    return c.json(created, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to submit application' }, 400);
  } // <--- You were likely missing this brace
}); // <--- And this closing for the .post() call

app.route('/api/coach-applications', coachApplicationsPatchRouter);
app.route('/api/app-data', appDataRouter);
app.route('/api/payments', paymentsRouter);
app.route('/api/users', usersRouter);

const adminMount = new Hono();
adminMount.use('*', requireAppRoles('admin'));
adminMount.route('/', adminRouter);
app.route('/api/admin', adminMount);

const staffMount = new Hono();
staffMount.use('*', requireAppRoles('staff', 'admin'));
staffMount.route('/', staffRouter);
app.route('/api/staff', staffMount);

app.route('/api/announcements', announcementsRouter);
app.route('/api/notifications', notificationsRouter);
app.route('/api/facilities', facilitiesRouter);
app.route('/api/chat', chatRoute);

// 404 handler
app.notFound((c) => c.json({ error: 'Not Found', path: c.req.path }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
