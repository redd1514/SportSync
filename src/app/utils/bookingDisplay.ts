import { getManilaDateKey, getManilaDateKeyFromValue, isManilaDateBefore } from './manilaDate';

export type UiBookingStatus =
  | 'pending_payment'
  | 'pending_verification'
  | 'confirmed'
  | 'cancelled'
  | 'rescheduled'
  | 'completed'
  | 'rejected';

/** Map DB / API status strings to My Bookings UI status. */
export function mapDbStatusToUiStatus(status: unknown): UiBookingStatus {
  const s = String(status || '').toLowerCase();
  if (s === 'cancelled') return 'cancelled';
  if (s === 'completed') return 'completed';
  if (s === 'rejected') return 'rejected';
  if (s === 'pending') return 'pending_payment';
  if (s === 'checked_in' || s === 'confirmed') return 'confirmed';
  if (
    s === 'pending_payment' ||
    s === 'pending_verification' ||
    s === 'rescheduled'
  ) {
    return s as UiBookingStatus;
  }
  return 'confirmed';
}

export function normalizeBookingDate(value: unknown): string {
  return getManilaDateKeyFromValue(value) || '';
}

export function normalizeBookingTime(value: unknown): string {
  const t = String(value || '').trim();
  if (!t) return '';
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t.slice(0, 5);
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

export function isTerminalBookingStatus(status: unknown): boolean {
  const s = mapDbStatusToUiStatus(status);
  return s === 'completed' || s === 'cancelled' || s === 'rejected';
}

function manilaMinutesFromTime24(time24: unknown): number | null {
  const t = normalizeBookingTime(time24);
  if (!t) return null;
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** True when booking should appear under Upcoming (not Completed/Cancelled). */
export function isUpcomingBooking(
  booking: {
    date?: unknown;
    status?: unknown;
    time?: unknown;
    duration?: unknown;
  },
  todayKey: string = getManilaDateKey(),
): boolean {
  if (isTerminalBookingStatus(booking.status)) return false;

  const dateKey = normalizeBookingDate(booking.date);
  if (!dateKey) return true;

  if (isManilaDateBefore(dateKey, todayKey)) return false;

  if (dateKey > todayKey) return true;

  const startMin = manilaMinutesFromTime24(booking.time);
  if (startMin == null) return true;

  const durationH = Number(booking.duration ?? 1) || 1;
  const endMin = startMin + durationH * 60;

  const now = new Date();
  const nowMin =
    parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        hour: '2-digit',
        hour12: false,
      }).format(now),
      10,
    ) *
      60 +
    parseInt(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Manila',
        minute: '2-digit',
      }).format(now),
      10,
    );

  return endMin > nowMin;
}

/** Merge API + optimistic rows without clobbering good date/time with empty values. */
export function mergeBookingRows(
  existing: Record<string, unknown> | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing) return incoming;
  const pick = (key: string) => {
    const next = incoming[key];
    const prev = existing[key];
    if (next == null || next === '') return prev;
    return next;
  };
  return {
    ...existing,
    ...incoming,
    date: pick('date'),
    time: pick('time'),
    status: pick('status'),
    refCode: pick('refCode'),
    court: pick('court'),
    sport: pick('sport'),
    amount: pick('amount'),
    totalAmount: pick('totalAmount'),
    downpaymentAmount: pick('downpaymentAmount'),
    downpaymentPercentage: pick('downpaymentPercentage'),
    balanceDue: pick('balanceDue'),
    duration: pick('duration'),
  };
}

export function formatTimeAMPM(time24: unknown): string {
  const t = normalizeBookingTime(time24);
  if (!t) return '';
  const [h, m] = t.split(':');
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${m} ${ampm}`;
}

export function displayRefCode(refCode: unknown, fallbackId?: unknown): string {
  const raw = String(refCode || fallbackId || '').trim();
  if (!raw) return 'JRC-TICKET';
  return raw.startsWith('JRC-') ? raw : `JRC-${raw.slice(0, 6).toUpperCase()}`;
}

/** Normalize a booking row from API, realtime, or chat for My Bookings. */
export function normalizeBookingForDisplay(raw: Record<string, unknown>) {
  const courtIdStr = String(raw.court || raw.court_id || raw.courtId || '');
  const startMin = manilaMinutesFromTime24(raw.time ?? raw.start_time);
  const endMin = manilaMinutesFromTime24(raw.endTime ?? raw.end_time);
  const durationFromTimes =
    startMin != null && endMin != null && endMin > startMin
      ? (endMin - startMin) / 60
      : undefined;
  return {
    ...raw,
    id: String(raw.id || ''),
    date: normalizeBookingDate(raw.date ?? raw.booking_date),
    time: normalizeBookingTime(raw.time ?? raw.start_time),
    duration: Number(raw.duration ?? raw.duration_hours ?? durationFromTimes ?? 1) || 1,
    court: String(raw.court || raw.court_name || courtIdStr || 'Court'),
    courtId: courtIdStr,
    sport: String(raw.sport || raw.sport_name || 'Sports'),
    status: mapDbStatusToUiStatus(raw.status),
    amount: Number(raw.amount ?? raw.totalAmount ?? raw.total_price ?? 0) || 0,
    totalAmount: Number(raw.totalAmount ?? raw.total_amount ?? raw.total_price ?? raw.amount ?? 0) || 0,
    downpaymentAmount:
      raw.downpaymentAmount ?? raw.downpayment_amount,
    downpaymentPercentage:
      raw.downpaymentPercentage ?? raw.downpayment_percentage,
    balanceDue:
      raw.balanceDue ?? raw.balance_due,
    paymentStatus: String(raw.paymentStatus ?? raw.payment_status ?? 'paid'),
    refCode: String(raw.refCode ?? raw.qr_code_token ?? raw.ref_code ?? raw.id ?? ''),
    cancellationRequested: Boolean(
      raw.cancellationRequested ?? raw.cancellation_requested,
    ),
    createdAt: String(raw.createdAt ?? raw.created_at ?? new Date().toISOString()),
  };
}
