import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.ts';
import { listStaffOperationsRecent } from '../services/deskBookingService.ts';

const staffRouter = new Hono();

/** KPIs for Live Operations + raw staff_operations rows for Activity tab */
staffRouter.get('/operations', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];

  try {
    const [{ data: payRows }, { data: bookRows }, ops] = await Promise.all([
      supabase.from('payments').select('amount, created_at, completed_at').eq('status', 'completed').limit(800),
      supabase
        .from('bookings')
        .select('id')
        .eq('booking_date', date)
        .not('status', 'eq', 'cancelled'),
      listStaffOperationsRecent(100),
    ]);

    let revenue = 0;
    for (const p of payRows ?? []) {
      const ts =
        (p as { completed_at?: string }).completed_at ||
        (p as { created_at?: string }).created_at ||
        '';
      const day = ts.slice(0, 10);
      if (day === date) revenue += Number((p as { amount?: number }).amount ?? 0);
    }

    const bookingsCount = bookRows?.length ?? 0;

    return c.json({
      date,
      bookingsCount,
      revenue,
      activeCourts: null,
      pendingRequests: null,
      operations: ops,
    });
  } catch (e: any) {
    console.error('[staff/operations]', e?.message);
    return c.json({
      date,
      bookingsCount: 0,
      revenue: 0,
      activeCourts: null,
      pendingRequests: null,
      operations: [],
    });
  }
});

export default staffRouter;
