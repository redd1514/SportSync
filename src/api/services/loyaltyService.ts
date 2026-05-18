import { supabase } from './supabaseClient';
const LOYALTY_TX_TYPES = ['booking', 'booking_completed'] as const;

function linkedBookingIdFromSessionNotes(notes?: string | null): string | undefined {
  const match = String(notes || '').match(/linked_booking:([0-9a-f-]+)/i);
  return match?.[1];
}

function isCoachingSessionCompleted(session: {
  status?: string | null;
  admin_notes?: string | null;
}): boolean {
  if (session.status === 'completed') return true;
  return /COACHING_CHECKED_OUT|checked_out:/i.test(String(session.admin_notes || ''));
}

async function findLinkedCoachingSession(bookingId: string) {
  const { data, error } = await supabase
    .from('coaching_sessions')
    .select('id, status, admin_notes, notes')
    .ilike('notes', `%linked_booking:${bookingId}%`)
    .limit(1);
  if (error) throw error;
  return (data || [])[0] as
    | { id: string; status?: string | null; admin_notes?: string | null; notes?: string | null }
    | undefined;
}

/** True when a completed booking is eligible for its single loyalty point. */
export async function isBookingEligibleForLoyaltyPoint(bookingId: string): Promise<boolean> {
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('id, user_id, status')
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!booking?.user_id || booking.status !== 'completed') return false;

  const session = await findLinkedCoachingSession(bookingId);
  if (!session) return true;
  return isCoachingSessionCompleted(session);
}

/**
 * Award 1 loyalty point for a completed booking (idempotent).
 * Court-only: on checkout. Court + coaching: only after coaching is also completed.
 */
export async function awardLoyaltyPointForCompletedBooking(bookingId: string): Promise<boolean> {
  const eligible = await isBookingEligibleForLoyaltyPoint(bookingId);
  if (!eligible) return false;

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id, user_id, status')
    .eq('id', bookingId)
    .maybeSingle();
  if (bookingErr || !booking?.user_id || booking.status !== 'completed') return false;

  const { data: existing } = await supabase
    .from('loyalty_transactions')
    .select('id')
    .eq('reference_id', bookingId)
    .in('transaction_type', [...LOYALTY_TX_TYPES])
    .limit(1);
  if ((existing || []).length > 0) return false;

  const { error: txErr } = await supabase.from('loyalty_transactions').insert({
    user_id: booking.user_id,
    points_change: 1,
    transaction_type: 'booking_completed',
    reference_id: booking.id,
  });
  if (txErr) {
    if (String(txErr.message || '').toLowerCase().includes('duplicate')) return false;
    throw txErr;
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('loyalty_points')
    .eq('id', booking.user_id)
    .maybeSingle();

  const { error: userErr } = await supabase
    .from('users')
    .update({ loyalty_points: Number(userRow?.loyalty_points || 0) + 1 })
    .eq('id', booking.user_id);
  if (userErr) throw userErr;

  return true;
}

/** After coaching checkout, award loyalty if the linked court booking is already completed. */
export async function awardLoyaltyForCoachingSessionCompletion(session: {
  id: string;
  status?: string | null;
  admin_notes?: string | null;
  notes?: string | null;
}): Promise<boolean> {
  if (!isCoachingSessionCompleted(session)) return false;

  const linkedBookingId =
    linkedBookingIdFromSessionNotes(session.notes) ||
    (() => {
      try {
        const admin = String(session.admin_notes || '');
        const matches = [...admin.matchAll(/COACHING_ACCEPTANCE:(\{.*?\})(?=\n[A-Z_]+:|$)/gs)];
        const latest = matches[matches.length - 1]?.[1];
        if (!latest) return undefined;
        const parsed = JSON.parse(latest) as { linkedBookingId?: string };
        return typeof parsed.linkedBookingId === 'string' ? parsed.linkedBookingId : undefined;
      } catch {
        return undefined;
      }
    })();

  if (!linkedBookingId) return false;
  return awardLoyaltyPointForCompletedBooking(linkedBookingId);
}
