import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.ts';
import { findUserRow } from '../services/userRowQuery.ts';

const notificationsRouter = new Hono();

async function resolveRecipientId(raw: string) {
  const user = await findUserRow(raw);
  return user?.id || raw;
}

notificationsRouter.get('/:userId', async (c) => {
  try {
    const userId = await resolveRecipientId(c.req.param('userId'));
    let rows: any[] = [];
    const { data, error } = await supabase
      .from('notifications')
      .select('id,recipient_id,event_type,data,read_at,created_at')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error) rows = data || [];

    const key = `notifications:${userId}`;
    const { data: kv } = await supabase.from('app_kv_store').select('value').eq('key', key).maybeSingle();
    const kvRows = Array.isArray(kv?.value) ? kv.value : [];
    const byId = new Map<string, any>();
    for (const row of [...rows, ...kvRows]) byId.set(String(row.id), row);
    return c.json(Array.from(byId.values()).sort((a, b) =>
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    ).slice(0, 50));
  } catch (error: any) {
    console.error('[notifications/list]', error?.message || error);
    return c.json([]);
  }
});

notificationsRouter.put('/:userId/mark-all-read', async (c) => {
  try {
    const userId = await resolveRecipientId(c.req.param('userId'));
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', userId)
      .is('read_at', null);
    if (error) console.error('[notifications/mark-all-read]', error.message);
    const key = `notifications:${userId}`;
    const { data: kv } = await supabase.from('app_kv_store').select('value').eq('key', key).maybeSingle();
    const current = Array.isArray(kv?.value) ? kv.value : [];
    await supabase.from('app_kv_store').upsert(
      {
        key,
        value: current.map((row: any) => ({ ...row, read_at: row.read_at || new Date().toISOString() })),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to mark notifications as read' }, 400);
  }
});

notificationsRouter.put('/:notificationId', async (c) => {
  try {
    const id = c.req.param('notificationId');
    const body = await c.req.json().catch(() => ({}));
    const readAt = String((body as any).read_at || new Date().toISOString());
    const { data, error } = await supabase
      .from('notifications')
      .update({ read_at: readAt })
      .eq('id', id)
      .select('*')
      .single();
    if (error) console.error('[notifications/mark-read]', error.message);

    const { data: kvRows } = await supabase.from('app_kv_store').select('key,value').like('key', 'notifications:%');
    for (const item of kvRows || []) {
      const current = Array.isArray((item as any).value) ? (item as any).value : [];
      if (!current.some((row: any) => String(row.id) === id)) continue;
      await supabase.from('app_kv_store').upsert(
        {
          key: (item as any).key,
          value: current.map((row: any) => String(row.id) === id ? { ...row, read_at: readAt } : row),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      );
    }
    return c.json(data || { id, read_at: readAt });
  } catch (error: any) {
    return c.json({ error: error.message || 'Failed to mark notification as read' }, 400);
  }
});

export default notificationsRouter;
