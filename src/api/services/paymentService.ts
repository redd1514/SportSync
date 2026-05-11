import { createHash } from 'crypto';
import { supabase } from './supabaseClient.ts';

function toStableUuid(input: string): string {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveUserRowId(userId: string): Promise<string> {
  const normalizedAuthId = isUuid(userId) ? userId : toStableUuid(userId);
  if (isUuid(userId)) {
    const directMatch = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
    if (directMatch.data?.id) return directMatch.data.id;
  }
  const authMatch = await supabase.from('users').select('id').eq('auth_id', normalizedAuthId).maybeSingle();
  if (authMatch.data?.id) return authMatch.data.id;
  return userId;
}

export const paymentService = {
  async createPayment(input: {
    user_id: string;
    booking_id?: string | null;
    coaching_session_id?: string | null;
    amount: number;
    payment_method: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  }) {
    const user_id = await resolveUserRowId(input.user_id);
    const status = input.status || 'completed';
    const row = {
      user_id,
      booking_id: input.booking_id || null,
      coaching_session_id: input.coaching_session_id || null,
      amount: input.amount,
      payment_method: input.payment_method,
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
    };
    const { data, error } = await supabase.from('payments').insert([row]).select('*').single();
    if (error) throw error;
    return data;
  },

  async listRecent(limit = 200) {
    const { data, error } = await supabase
      .from('payments')
      .select('id, user_id, booking_id, amount, payment_method, status, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },
};
