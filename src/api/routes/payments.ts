import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.ts';
import { paymentService } from '../services/paymentService.ts';

const paymentsRouter = new Hono();

paymentsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return c.json({ error: 'Invalid amount' }, 400);
    }
    const booking_id = body.booking_id || body.bookingId || null;
    const coaching_session_id = body.coaching_session_id || body.coachingSessionId || null;
    let user_id: string | undefined = body.user_id || body.userId;
    if (!user_id && booking_id) {
      const { data: booking } = await supabase.from('bookings').select('user_id').eq('id', booking_id).maybeSingle();
      user_id = booking?.user_id;
    }
    if (!user_id) {
      return c.json({ error: 'user_id or a valid booking_id is required' }, 400);
    }
    const method = String(body.payment_method || body.method || 'gcash').toLowerCase();
    const row = await paymentService.createPayment({
      user_id,
      booking_id,
      coaching_session_id,
      amount,
      payment_method: method,
      status: 'completed',
    });
    return c.json(
      {
        id: row.id,
        booking_id: row.booking_id,
        amount: row.amount,
        payment_method: row.payment_method,
        status: row.status,
        created_at: row.created_at,
        reference: row.transaction_id || `REF-${row.id?.slice(0, 8)}`,
      },
      201
    );
  } catch (error: any) {
    return c.json({ error: error.message || 'Payment processing failed' }, 400);
  }
});

paymentsRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { data, error } = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return c.json({ error: 'Not Found' }, 404);
    return c.json(data);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default paymentsRouter;
