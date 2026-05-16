import { supabase } from './supabaseClient';
import { genRefCode } from '../../shared/ticketRef';
import {
  deskAdminRowToClientBooking,
  mapBookingRowToAdmin,
  parseBookingNotes,
} from '../utils/bookingMap';
import { resolveUserRowId } from './bookingService';

const BOOKING_SELECT = `
      id,
      user_id,
      booking_date,
      start_time,
      end_time,
      status,
      total_price,
      base_price,
      notes,
      qr_code_token,
      created_at,
      updated_at,
      courts ( name, sports ( name ) )
    `;

export type DeskBookingInput = {
  court: string;
  sport: string;
  booking_date: string;
  /** "14" or "14:00" or "14:00:00" */
  start_time: string;
  duration_hours: number;
  total_price: number;
  base_price?: number;
  customer_name?: string;
  customer_phone?: string;
  payment_method: 'cash' | 'gcash';
  /** walk_in | map_staff | map_customer */
  source: string;
  ref_code?: string;
  add_ons?: string;
  staff_id?: string | null;
  /** Supabase public.users id or auth id for customer-originated map bookings */
  user_id?: string | null;
  loyalty_points_redeemed?: number;
  loyalty_discount?: number;
  /** Published facility map id (from map editor) for multi-facility scoping */
  facility_map_id?: string | null;
  /** Logged-in customer (public.users.id) — required for My Bookings */
  user_id?: string | null;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

/** Normalize to HH:MM:SS for Postgres time */
export function normalizeStartTime(t: string): string {
  const p = t.trim().split(':').map((x) => parseInt(x, 10));
  const h = p[0] ?? 0;
  const m = p[1] ?? 0;
  return `${pad2(h)}:${pad2(m)}:00`;
}

function toMinutesHms(t: string): number {
  const [h, m] = String(t || '00:00').slice(0, 8).split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

/** True when no confirmed/pending booking overlaps [start, end) on court+date. */
export async function isCourtSlotAvailable(
  courtId: string,
  bookingDate: string,
  startHms: string,
  endHms: string,
): Promise<boolean> {
  const startM = toMinutesHms(startHms);
  const endM = toMinutesHms(endHms);
  const { data, error } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('court_id', courtId)
    .eq('booking_date', bookingDate)
    .in('status', ['pending', 'confirmed', 'checked_in']);
  if (error) throw error;
  for (const row of data ?? []) {
    const bStart = toMinutesHms(String(row.start_time));
    const bEnd = toMinutesHms(String(row.end_time));
    if (startM < bEnd && endM > bStart) return false;
  }
  return true;
}

export function endTimeFromStartAndDuration(startHms: string, durationHours: number): string {
  const [h, m] = startHms.split(':').map((x) => parseInt(x, 10));
  const startM = (h ?? 0) * 60 + (m ?? 0);
  const endM = startM + durationHours * 60;
  const eh = Math.floor(endM / 60) % 24;
  const em = endM % 60;
  return `${pad2(eh)}:${pad2(em)}:00`;
}

function isValidUuid(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

async function ensureWalkInUserId(): Promise<string> {
  const authId = '00000000-0000-4000-8000-000000000001';
  const email = 'walkin@sportsync.local';
  const { data: existing, error: existingErr } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();
  if (existingErr) throw existingErr;
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from('users')
    .insert({
      auth_id: authId,
      email,
      full_name: 'Walk-in Guest',
      phone: null,
      role: 'user',
      loyalty_points: 0,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data!.id as string;
}

async function resolveCourtId(courtName: string, sportName: string): Promise<string | null> {
  const name = courtName.trim();
  if (!name) return null;

  const { data: rows, error } = await supabase
    .from('courts')
    .select('id, name, sports!inner(name)')
    .ilike('name', name);

  if (error) throw error;
  if (!rows?.length) {
    const numMatch = name.match(/^(.+?)\s+(\d+)$/i);
    if (numMatch) {
      const { data: fuzzy, error: fuzzyErr } = await supabase
        .from('courts')
        .select('id, name, sports!inner(name)')
        .ilike('name', `${numMatch[1].trim()} ${numMatch[2]}`);
      if (fuzzyErr) throw fuzzyErr;
      if (fuzzy?.length) {
        const bySport = fuzzy.find(
          (r: { sports?: { name?: string } }) =>
            String(r.sports?.name || '').toLowerCase() === sportName.trim().toLowerCase(),
        );
        if (bySport?.id) return bySport.id as string;
        if (fuzzy.length === 1) return fuzzy[0].id as string;
      }
    }
    return null;
  }
  if (rows.length === 1) return rows[0].id as string;
  const bySport = rows.find((r: { sports?: { name?: string } }) => r.sports?.name === sportName);
  if (bySport?.id) return bySport.id as string;
  throw new Error(
    `Multiple database courts share the name "${name}". Match sport "${sportName}" or add a facility column to courts.`,
  );
}

export async function createDeskBooking(input: DeskBookingInput) {
  const courtId = await resolveCourtId(input.court, input.sport);
  if (!courtId) {
    throw new Error(
      `Court not found in database: "${input.court}". Run migration 002_seed_facility_courts.sql to seed courts.`
    );
  }

  const ref = (input.ref_code || genRefCode()).toUpperCase();
  const startNorm = normalizeStartTime(input.start_time);
  const endNorm = endTimeFromStartAndDuration(startNorm, input.duration_hours);
  const resolvedUserId = input.user_id ? await resolveUserRowId(input.user_id) : null;
  const loyaltyPointsRedeemed = Math.max(0, Number(input.loyalty_points_redeemed || 0));
  if (loyaltyPointsRedeemed > 0 && resolvedUserId) {
    const { data: u } = await supabase.from('users').select('loyalty_points').eq('id', resolvedUserId).maybeSingle();
    if (Number(u?.loyalty_points || 0) < loyaltyPointsRedeemed) {
      throw new Error('Not enough loyalty points for this reward.');
    }
  }

  const available = await isCourtSlotAvailable(courtId, input.booking_date, startNorm, endNorm);
  if (!available) {
    throw new Error(
      `Sorry, ${input.court} is already booked on ${input.booking_date} for that time slot.`,
    );
  }

  const notes = JSON.stringify({
    refCode: ref,
    customerName: input.customer_name ?? '',
    customerPhone: input.customer_phone ?? '',
    sport: input.sport,
    addOns: input.add_ons ?? '',
    source: input.source,
    paymentMethod: input.payment_method,
    ...(loyaltyPointsRedeemed > 0 ? { loyaltyPointsRedeemed, loyaltyDiscount: input.loyalty_discount ?? 0 } : {}),
    ...(input.facility_map_id ? { facilityMapId: input.facility_map_id } : {}),
  });

  const resolvedUserId =
    input.user_id && isValidUuid(input.user_id) ? input.user_id.trim() : null;

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .insert({
      user_id: resolvedUserId,
      court_id: courtId,
      booking_date: input.booking_date,
      start_time: startNorm,
      end_time: endNorm,
      status: 'confirmed',
      base_price: input.base_price ?? input.total_price,
      total_price: input.total_price,
      notes,
      qr_code_token: ref,
    })
    .select('id')
    .single();

  if (bErr) throw bErr;
  const bookingId = booking!.id as string;
  const paymentCompleted = input.source !== 'map_customer';

  const { data: payment, error: pErr } = await supabase
    .from('payments')
    .insert({
      user_id: resolvedUserId,
      booking_id: bookingId,
      amount: input.total_price,
      payment_method: input.payment_method,
      status: paymentCompleted ? 'completed' : 'pending',
      transaction_id: `DESK-${ref}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      completed_at: paymentCompleted ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  if (pErr) throw pErr;

  if (loyaltyPointsRedeemed > 0 && resolvedUserId) {
    await supabase.from('loyalty_transactions').insert({
      user_id: resolvedUserId,
      points_change: -loyaltyPointsRedeemed,
      transaction_type: 'redemption',
      reference_id: bookingId,
    });
    const { data: u } = await supabase.from('users').select('loyalty_points').eq('id', resolvedUserId).maybeSingle();
    await supabase
      .from('users')
      .update({ loyalty_points: Math.max(0, Number(u?.loyalty_points || 0) - loyaltyPointsRedeemed) })
      .eq('id', resolvedUserId);
  }

  if (isValidUuid(input.staff_id)) {
    await supabase.from('staff_operations').insert({
      staff_id: input.staff_id,
      booking_id: bookingId,
      action: input.source === 'walk_in' ? 'walk_in_booking' : 'desk_booking',
      notes: input.customer_name ?? null,
    });
  }

  const full = await fetchBookingById(bookingId);
  return { booking: full, payment_id: payment!.id as string };
}

export async function fetchBookingById(id: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('id', id)
    .single();

  if (error) throw error;
  return mapBookingRowToAdmin(data as Parameters<typeof mapBookingRowToAdmin>[0]);
}

export async function lookupBookingByRefOrId(scan: string) {
  const q = scan.trim();
  if (!q) return null;

  if (isValidUuid(q)) {
    try {
      return await fetchBookingById(q.toLowerCase());
    } catch {
      return null;
    }
  }

  const upper = q.toUpperCase();

  const { data: byToken, error: e1 } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .ilike('qr_code_token', upper)
    .maybeSingle();

  if (!e1 && byToken) {
    return mapBookingRowToAdmin(byToken as Parameters<typeof mapBookingRowToAdmin>[0]);
  }

  const { data: rows } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .not('notes', 'is', null)
    .limit(80);

  for (const row of rows ?? []) {
    const meta = parseBookingNotes((row as { notes?: string }).notes);
    if (meta.refCode?.toUpperCase() === upper) {
      return mapBookingRowToAdmin(row as Parameters<typeof mapBookingRowToAdmin>[0]);
    }
  }

  return null;
}

export async function listCalendarBookings(start: string, end: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .gte('booking_date', start)
    .lte('booking_date', end)
    .not('status', 'eq', 'cancelled')
    .order('booking_date', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) =>
    mapBookingRowToAdmin(row as Parameters<typeof mapBookingRowToAdmin>[0])
  );
}

export async function getAllBookingsFiltered(filters?: {
  date?: string;
  start?: string;
  end?: string;
}) {
  let q = supabase.from('bookings').select(BOOKING_SELECT);
  if (filters?.date) {
    q = q.eq('booking_date', filters.date);
  } else if (filters?.start && filters?.end) {
    q = q.gte('booking_date', filters.start).lte('booking_date', filters.end);
  } else {
    const now = new Date();
    const past = new Date(now);
    past.setMonth(past.getMonth() - 3);
    const fut = new Date(now);
    fut.setMonth(fut.getMonth() + 6);
    q = q
      .gte('booking_date', past.toISOString().split('T')[0])
      .lte('booking_date', fut.toISOString().split('T')[0]);
  }
  const { data, error } = await q.order('booking_date', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) =>
    deskAdminRowToClientBooking(
      mapBookingRowToAdmin(row as Parameters<typeof mapBookingRowToAdmin>[0])
    )
  );
}

export async function checkInBooking(bookingId: string, staffId?: string | null) {
  const { data: cur, error: curErr } = await supabase
    .from('bookings')
    .select('id,status')
    .eq('id', bookingId)
    .maybeSingle();
  if (curErr) throw curErr;
  if (!cur) throw new Error('Booking not found');
  if (cur.status === 'completed') throw new Error('Cannot check-in: booking is already checked out (completed).');
  if (cur.status === 'cancelled') throw new Error('Cannot check-in: booking is cancelled.');
  if (cur.status === 'checked_in') return fetchBookingById(bookingId);

  const { error: uErr } = await supabase
    .from('bookings')
    .update({ status: 'checked_in', updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (uErr) throw uErr;

  await supabase
    .from('payments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .eq('status', 'pending');

  if (isValidUuid(staffId)) {
    await supabase.from('staff_operations').insert({
      staff_id: staffId,
      booking_id: bookingId,
      action: 'check_in',
      notes: null,
    });
  }

  return fetchBookingById(bookingId);
}

export async function refundLoyaltyRedemptionForUnstartedBooking(bookingId: string) {
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id,user_id,status')
    .eq('id', bookingId)
    .maybeSingle();
  if (bookingErr || !booking?.user_id) return;
  if (booking.status === 'checked_in' || booking.status === 'completed') return;

  const { data: redemptions } = await supabase
    .from('loyalty_transactions')
    .select('points_change')
    .eq('reference_id', bookingId)
    .eq('transaction_type', 'redemption');

  const redeemed = Math.abs(
    (redemptions || []).reduce((sum: number, row: any) => sum + Math.min(0, Number(row.points_change || 0)), 0),
  );
  if (redeemed <= 0) return;

  const { data: existingRefund } = await supabase
    .from('loyalty_transactions')
    .select('id')
    .eq('reference_id', bookingId)
    .eq('transaction_type', 'redemption_refund')
    .limit(1);
  if ((existingRefund || []).length > 0) return;

  const { error: txErr } = await supabase.from('loyalty_transactions').insert({
    user_id: booking.user_id,
    points_change: redeemed,
    transaction_type: 'redemption_refund',
    reference_id: bookingId,
  });
  if (txErr) return;

  const { data: userRow } = await supabase
    .from('users')
    .select('loyalty_points')
    .eq('id', booking.user_id)
    .maybeSingle();

  await supabase
    .from('users')
    .update({ loyalty_points: Number(userRow?.loyalty_points || 0) + redeemed })
    .eq('id', booking.user_id);
}

export async function checkOutBooking(bookingId: string, staffId?: string | null) {
  const { data: cur, error: curErr } = await supabase
    .from('bookings')
    .select('id,status,user_id')
    .eq('id', bookingId)
    .maybeSingle();
  if (curErr) throw curErr;
  if (!cur) throw new Error('Booking not found');
  if (cur.status === 'completed') return fetchBookingById(bookingId);
  if (cur.status !== 'checked_in') {
    throw new Error('Cannot check-out before check-in. Please check-in the guest first, then check-out when they finish.');
  }

  if (!cur.user_id) {
    const walkInUserId = await ensureWalkInUserId();
    const { error: ownerErr } = await supabase
      .from('bookings')
      .update({ user_id: walkInUserId, updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .is('user_id', null);
    if (ownerErr) throw ownerErr;
    await supabase
      .from('payments')
      .update({ user_id: walkInUserId })
      .eq('booking_id', bookingId)
      .is('user_id', null);
  }

  const { error: uErr } = await supabase
    .from('bookings')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (uErr) throw uErr;

  await ensureLoyaltyPointForCompletedBooking(bookingId);

  if (isValidUuid(staffId)) {
    await supabase.from('staff_operations').insert({
      staff_id: staffId,
      booking_id: bookingId,
      action: 'check_out',
      notes: null,
    });
  }

  return fetchBookingById(bookingId);
}

async function ensureLoyaltyPointForCompletedBooking(bookingId: string) {
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('id,user_id,status')
    .eq('id', bookingId)
    .maybeSingle();
  if (bookingErr || !booking?.user_id || booking.status !== 'completed') return;

  const { data: existing } = await supabase
    .from('loyalty_transactions')
    .select('id')
    .eq('reference_id', bookingId)
    .in('transaction_type', ['booking', 'booking_completed'])
    .limit(1);
  if ((existing || []).length > 0) return;

  const { error: txErr } = await supabase
    .from('loyalty_transactions')
    .insert({
      user_id: booking.user_id,
      points_change: 1,
      transaction_type: 'booking_completed',
      reference_id: booking.id,
    });
  if (txErr) return;

  const { data: userRow } = await supabase
    .from('users')
    .select('loyalty_points')
    .eq('id', booking.user_id)
    .maybeSingle();

  await supabase
    .from('users')
    .update({ loyalty_points: Number(userRow?.loyalty_points || 0) + 1 })
    .eq('id', booking.user_id);
}

export async function listStaffOperationsRecent(limit = 250) {
  const { data, error } = await supabase
    .from('staff_operations')
    .select(
      `
      id,
      action,
      notes,
      created_at,
      staff_id,
      booking_id,
      bookings (
        id,
        booking_date,
        start_time,
        end_time,
        status,
        total_price,
        qr_code_token,
        notes,
        courts ( name, sports ( name ) )
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function listPaymentsJoined() {
  const { data, error } = await supabase
    .from('payments')
    .select(
      `
      id,
      booking_id,
      amount,
      payment_method,
      status,
      created_at,
      completed_at,
      transaction_id,
      bookings ( notes )
    `
    )
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const notes = parseBookingNotes(row.bookings?.notes);
    const payStatus =
      row.status === 'completed'
        ? 'paid'
        : row.status === 'refunded'
          ? 'refunded'
          : row.status === 'failed'
            ? 'failed'
            : 'pending';
    const rawPm = String(row.payment_method ?? 'cash').toLowerCase().replace(/\s+/g, '_');
    const paymentMethod = rawPm.includes('gcash')
      ? 'gcash'
      : rawPm.includes('bank')
        ? 'bank_transfer'
        : 'cash';

    return {
      id: row.id as string,
      bookingId: (row.booking_id as string) ?? '',
      customerName: notes.customerName || 'Customer',
      amount: Number(row.amount ?? 0),
      paymentMethod,
      paymentStatus: payStatus,
      createdAt: (row.completed_at as string) || (row.created_at as string) || new Date().toISOString(),
      transactionId: row.transaction_id as string | null,
    };
  });
}
