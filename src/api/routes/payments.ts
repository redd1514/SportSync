import { Hono } from 'hono';
import { PaymentRequest } from '../types/index.ts';

const paymentsRouter = new Hono();

// POST /api/payments - Process payment
paymentsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json() as PaymentRequest;
    
    // Mock payment processing
    const paymentId = `pay_${Date.now()}`;
    const payment = {
      id: paymentId,
      ...body,
      status: 'completed',
      created_at: new Date().toISOString(),
      reference: `REF-${Math.random().toString(36).substring(7).toUpperCase()}`,
    };
    
    return c.json(payment, 201);
  } catch (error: any) {
    return c.json({ error: error.message || 'Payment processing failed' }, 400);
  }
});

// GET /api/payments/:id - Get payment details
paymentsRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    return c.json({
      id,
      status: 'completed',
      amount: 450,
      method: 'gcash',
      created_at: new Date().toISOString(),
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default paymentsRouter;