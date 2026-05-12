import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.ts';

const announcementsRouter = new Hono();

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

announcementsRouter.get('/published', async (c) => {
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from('announcements')
      .select('id,title,description,announcement_type,published_at,created_at,expires_at,is_published')
      .eq('is_published', true)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .order('published_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return c.json(data ?? []);
  } catch (e: any) {
    return c.json({ error: e?.message || 'Failed to fetch announcements' }, 400);
  }
});

announcementsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const title = String(body.title || '').trim();
    const description = String(body.description || '').trim();
    const announcementType = String(body.announcement_type || body.type || 'general').trim() || 'general';
    const createdBy = String(body.created_by || body.createdBy || '').trim();
    const publish = body.publish !== false;
    const expiresAt = body.expires_at ? String(body.expires_at) : null;

    if (!title || !description) return c.json({ error: 'title and description are required' }, 400);
    if (!createdBy || !isUuid(createdBy)) {
      return c.json({ error: 'created_by must be a valid UUID (log in with a real Supabase user/staff account).' }, 400);
    }

    const row = {
      title,
      description,
      announcement_type: announcementType,
      created_by: createdBy,
      is_published: publish,
      published_at: publish ? new Date().toISOString() : null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase.from('announcements').insert([row]).select('*').single();
    if (error) throw error;

    return c.json(data, 201);
  } catch (e: any) {
    return c.json({ error: e?.message || 'Failed to create announcement' }, 400);
  }
});

export default announcementsRouter;

