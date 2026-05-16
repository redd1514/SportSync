export type BookingNotesPayload = {
  refCode?: string;
  customerName?: string;
  customerPhone?: string;
  sport?: string;
  addOns?: string;
  source?: string;
  paymentMethod?: string;
  /** Facility map editor id when booking came from a specific published map */
  facilityMapId?: string;
};

export function parseBookingNotes(notes: string | null | undefined): BookingNotesPayload {
  if (!notes) return {};
  try {
    const o = JSON.parse(notes) as BookingNotesPayload;
    return typeof o === 'object' && o ? o : {};
  } catch {
    return {};
  }
}

/** Normalize DB/API date values to Manila YYYY-MM-DD. */
export function normalizeManilaDateKey(value: unknown): string {
  if (value == null || value === '') return '';
  const normalized = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(parsed);
}

export function durationHoursFromTimes(start: string, end: string): number {
  const parse = (t: string) => {
    const p = t.split(':').map(Number);
    return (p[0] ?? 0) + (p[1] ?? 0) / 60;
  };
  const d = parse(end) - parse(start);
  return Math.max(1, Math.round(d * 10) / 10) || 1;
}

/** Map DB row (+ joined court/sport) to admin / calendar row */
export function mapBookingRowToAdmin(row: {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number | null;
  base_price?: number | null;
  notes?: string | null;
  qr_code_token?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  courts?: { name?: string; sports?: { name?: string } | null } | null;
  user_id?: string | null;
}): {
  id: string;
  refCode: string;
  customerName: string;
  customerPhone?: string;
  addOns?: string;
  court: string;
  sport: string;
  date: string;
  time: string;
  duration: number;
  amount: number;
  status: string;
  paymentStatus: string;
  checkInStatus: 'none' | 'checked_in';
  checkInTime?: string;
  createdAt: string;
  facilityMapId?: string;
  userId?: string;
} {
  const meta = parseBookingNotes(row.notes ?? undefined);
  const courtName = row.courts?.name ?? 'Court';
  const sportName = row.courts?.sports?.name ?? meta.sport ?? 'Unknown';
  const start = (row.start_time ?? '00:00:00').slice(0, 5);
  const end = (row.end_time ?? '00:00:00').slice(0, 5);
  const duration = durationHoursFromTimes(
    (row.start_time ?? '00:00:00').slice(0, 8),
    (row.end_time ?? '00:00:00').slice(0, 8)
  );
  const refCode = row.qr_code_token || meta.refCode || row.id.slice(0, 8).toUpperCase();
  const checkedIn = row.status === 'checked_in';
  const uiStatus:
    | 'pending_payment'
    | 'pending_verification'
    | 'confirmed'
    | 'cancelled'
    | 'completed' =
    row.status === 'cancelled'
      ? 'cancelled'
      : row.status === 'pending'
        ? 'pending_payment'
        : row.status === 'completed'
          ? 'completed'
          : 'confirmed';
  return {
    id: row.id,
    refCode,
    customerName: meta.customerName || 'Customer',
    customerPhone: meta.customerPhone,
    addOns: meta.addOns,
    court: courtName,
    sport: sportName,
    date: normalizeManilaDateKey(row.booking_date),
    time: start,
    duration,
    amount: Number(row.total_price ?? 0),
    status: checkedIn ? 'confirmed' : uiStatus,
    paymentStatus: row.status === 'pending' ? 'pending' : 'paid',
    checkInStatus: checkedIn ? 'checked_in' : 'none',
    checkInTime: checkedIn ? row.updated_at || row.created_at : undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    facilityMapId: typeof meta.facilityMapId === 'string' && meta.facilityMapId ? meta.facilityMapId : undefined,
    userId: row.user_id || undefined,
  };
}

/** Shape expected by FacilityMapViewer / UserContext Booking merge */
export function deskAdminRowToClientBooking(a: ReturnType<typeof mapBookingRowToAdmin>) {
  return {
    id: a.id,
    sport: a.sport,
    date: a.date,
    time: a.time,
    duration: a.duration,
    court: a.court,
    status: a.status as any,
    amount: a.amount,
    paymentStatus: a.paymentStatus as any,
    createdAt: a.createdAt,
    customerName: a.customerName,
    customerPhone: a.customerPhone,
    addOns: a.addOns,
    refCode: a.refCode,
    checkInStatus: a.checkInStatus,
    checkInTime: a.checkInTime,
    facilityMapId: a.facilityMapId,
    userId: a.userId,
  };
}
