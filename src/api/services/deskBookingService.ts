import { supabase } from './supabaseClient';
import { genRefCode } from '../../shared/ticketRef';
import {
  deskAdminRowToClientBooking,
  mapBookingRowToAdmin,
  parseBookingNotes,
} from '../utils/bookingMap';

const BOOKING_SELECT = `
      id,
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

async function resolveCourtId(courtName: string, sportName: string): Promise<string | null> {
  const name = courtName.trim();
  const { data: exact } = await supabase
    .from('courts')
    .select('id, sports!inner(name)')
    .eq('name', name)
    .maybeSingle();

  if (exact?.id) {
    const sn = (exact as { sports?: { name?: string } }).sports?.name;
    if (!sn || sn === sportName) return exact.id as string;
  }

  const { data: rows } = await supabase
    .from('courts')
    .select('id, name, sports!inner(name)')
    .ilike('name', `%${name}%`);

  if (!rows?.length) return null;
  const bySport = rows.find(
    (r: { sports?: { name?: string } }) => r.sports?.name === sportName
  );
  return (bySport?.id ?? rows[0]?.id) as string | null;
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

  const notes = JSON.stringify({
    refCode: ref,
    customerName: input.customer_name ?? '',
    customerPhone: input.customer_phone ?? '',
    sport: input.sport,
    addOns: input.add_ons ?? '',
    source: input.source,
    paymentMethod: input.payment_method,
  });

  const { data: booking, error: bErr } = await supabase
    .from('bookings')
    .insert({
      user_id: null,
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

  const { data: payment, error: pErr } = await supabase
    .from('payments')
    .insert({
      user_id: null,
      booking_id: bookingId,
      amount: input.total_price,
      payment_method: input.payment_method,
      status: 'completed',
      transaction_id: `DESK-${ref}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      completed_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (pErr) throw pErr;

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
  const { error: uErr } = await supabase
    .from('bookings')
    .update({ status: 'checked_in', updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (uErr) throw uErr;

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

export async function listStaffOperationsRecent(limit = 80) {
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
        qr_code_token,
        notes,
        courts ( name )
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
