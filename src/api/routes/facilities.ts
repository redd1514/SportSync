import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.ts';

const facilitiesRouter = new Hono();

facilitiesRouter.get('/', async (c) => {
  try {
    const { data: facility } = await supabase.from('facility_config').select('*').limit(1).maybeSingle();
    return c.json({
      name: facility?.facility_name || 'JRC Sports Complex',
      address: facility?.address || 'Valenzuela City, Metro Manila',
      hours: facility ? `${facility.business_hours_start || '06:00'} - ${facility.business_hours_end || '22:00'}` : '06:00 - 22:00',
      phone: facility?.phone || '+63 (2) 1234-5678',
      email: facility?.email || 'info@example.com',
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

facilitiesRouter.get('/map', async (c) => {
  try {
    const { data: facility } = await supabase.from('facility_config').select('*').limit(1).maybeSingle();
    const { data: courts } = await supabase.from('courts').select('id, name, capacity, is_active').order('name');
    return c.json({
      id: facility?.id || null,
      name: facility?.facility_name || 'JRC Sports Complex',
      location: facility?.address || 'Valenzuela City, Metro Manila',
      courts: courts || [],
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

facilitiesRouter.get('/courts/status', async (c) => {
  try {
    const { data: courts, error } = await supabase.from('courts').select('id, name, capacity, is_active');
    if (error) throw error;
    return c.json((courts || []).map((court: any) => ({
      id: court.id,
      name: court.name,
      sport: court.name.replace(/\s+\d+$/, ''),
      status: court.is_active === false ? 'maintenance' : 'available',
      capacity: court.capacity,
    })));
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

facilitiesRouter.get('/courts/available', async (c) => {
  try {
    const sport = c.req.query('sport');
    const { data: courts, error } = await supabase.from('courts').select('id, name, is_active');
    if (error) throw error;
    const available = (courts || [])
      .filter((court: any) => court.is_active !== false)
      .filter((court: any) => !sport || court.name.toLowerCase().includes(sport.toLowerCase()))
      .map((court: any) => ({ id: court.id, name: court.name, sport: sport || court.name }));
    return c.json({ available });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

facilitiesRouter.get('/courts/:courtId', async (c) => {
  try {
    const courtId = c.req.param('courtId');
    const { data: court, error } = await supabase.from('courts').select('*').eq('id', courtId).maybeSingle();
    if (error) throw error;
    if (!court) return c.json({ error: 'Not Found' }, 404);
    return c.json(court);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

facilitiesRouter.get('/courts/:courtId/bookings', async (c) => {
  try {
    const courtId = c.req.param('courtId');
    const date = c.req.query('date');
    let query = supabase.from('bookings').select('*').eq('court_id', courtId);
    if (date) query = query.eq('booking_date', date);
    const { data, error } = await query.order('booking_date', { ascending: false });
    if (error) throw error;
    return c.json(data || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

facilitiesRouter.put('/map', async (c) => c.json({ success: true }));
facilitiesRouter.post('/courts', async (c) => c.json({ success: true }));

facilitiesRouter.put('/courts/:courtId/status', async (c) => {
  try {
    const courtId = c.req.param('courtId');
    const { status } = await c.req.json();
    const { error } = await supabase.from('courts').update({ is_active: status !== 'maintenance' }).eq('id', courtId);
    if (error) throw error;
    return c.json({ success: true, courtId, status });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default facilitiesRouter;