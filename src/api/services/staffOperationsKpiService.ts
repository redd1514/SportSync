import { supabase } from './supabaseClient.ts';

/**
 * Same logic as Admin → Executive Overview → Overview → Today's Revenue:
 * sum of booking total_price for the given date, excluding cancelled/rejected.
 */
export async function computeTodayRevenueForBookingDate(bookingDate: string): Promise<number> {
  const { data, error } = await supabase
    .from('bookings')
    .select('total_price, status')
    .eq('booking_date', bookingDate);
  if (error) throw error;

  const revenue = (data ?? []).reduce((sum, row) => {
    const status = String((row as { status?: string }).status || '');
    if (status === 'cancelled' || status === 'rejected') return sum;
    return sum + Number((row as { total_price?: number | null }).total_price ?? 0);
  }, 0);

  return Math.round(revenue);
}
