import { supabase } from './supabaseClient.ts';
import { findUserRow, isUuid } from './userRowQuery.ts';
import { isCourtSlotAvailable } from './deskBookingService.ts';
import { coachingSessionService } from './coachingSessionService.ts';
import { resolveCourtId as resolveOrCreateCourtId } from './courtService.ts';

export type CheckoutInput = {
  court: string;
  sport: string;
  booking_date: string;
  start_time: string;
  duration_hours: number;
  total_price: number;
  customer_name?: string;
  customer_phone?: string;
  add_ons?: string;
  ref_code?: string;
  facility_map_id?: string | null;
  downpayment_percentage?: number;
  loyalty_points_redeemed?: number;
  loyalty_discount?: number;
  success_url?: string;
  cancel_url?: string;
  source?: string;
  coach_id?: string;
  coach_name?: string;
  coaching_student_id?: string;
  coach_fee?: number;
  court_amount?: number;
  total_due?: number;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

export function normalizeStartTime(t: string): string {
  const raw = t.trim();
  if (/^\d{1,2}:\d{2}/.test(raw)) {
    const p = raw.split(':').map((x) => parseInt(x, 10));
    const h = p[0] ?? 0;
    const m = p[1] ?? 0;
    return `${pad2(h)}:${pad2(m)}:00`;
  }
  const hour = parseInt(raw, 10);
  if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
    return `${pad2(hour)}:00:00`;
  }
  throw new Error(`Invalid start time: "${t}"`);
}

function endTimeFromStartAndDuration(startHms: string, durationHours: number): string {
  const [h, m] = startHms.split(':').map((x) => parseInt(x, 10));
  const startM = (h ?? 0) * 60 + (m ?? 0);
  const endM = startM + durationHours * 60;
  const eh = Math.floor(endM / 60) % 24;
  const em = endM % 60;
  return `${pad2(eh)}:${pad2(em)}:00`;
}

function genRefCode(): string {
  return `JRC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function appendQueryParam(url: string, key: string, value: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set(key, value);
    return u.toString();
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  }
}

async function resolveUserRowId(userId: string): Promise<string> {
  const row = await findUserRow(userId);
  if (row?.id) return String(row.id);
  if (isUuid(userId)) return userId;
  throw new Error('User profile not found. Please sign out and sign in again.');
}

export async function createPaymongoCourtCheckout(
  authUserId: string,
  authEmail: string,
  input: CheckoutInput,
) {
  const paymongoSecret = String(process.env.PAYMONGO_SECRET_KEY || '').trim();
  if (!paymongoSecret) {
    throw new Error('PayMongo is not configured on the server (PAYMONGO_SECRET_KEY).');
  }

  const {
    court,
    sport,
    booking_date,
    start_time,
    duration_hours,
    total_price,
    customer_name,
    customer_phone,
    add_ons,
    ref_code,
    facility_map_id,
    downpayment_percentage = 50,
    loyalty_points_redeemed = 0,
    loyalty_discount = 0,
    success_url,
    cancel_url,
    source = 'online_paymongo',
    coach_id,
    coach_name,
    coaching_student_id,
    coach_fee,
    court_amount,
    total_due,
  } = input;

  if (!court || !sport || !booking_date || !start_time) {
    throw new Error('court, sport, booking_date, and start_time are required');
  }
  const duration = Number(duration_hours);
  if (!Number.isFinite(duration) || duration < 1) {
    throw new Error('duration_hours must be at least 1');
  }
  const total = Math.max(0, Number(total_price));
  if (total <= 0) {
    throw new Error('total_price must be greater than zero');
  }

  const resolvedUserId = await resolveUserRowId(authUserId);
  const courtId = await resolveOrCreateCourtId(court, sport);
  const startNorm = normalizeStartTime(start_time);
  const endNorm = endTimeFromStartAndDuration(startNorm, duration);

  const available = await isCourtSlotAvailable(courtId, booking_date, startNorm, endNorm);
  if (!available) {
    throw new Error(
      `Sorry, ${court} is already booked on ${booking_date} for that time slot.`,
    );
  }

  const ref = (ref_code || genRefCode()).toUpperCase();
  const loyaltyPointsRedeemed = Math.max(0, Number(loyalty_points_redeemed || 0));
  const loyaltyDiscount = Math.max(0, Number(loyalty_discount || 0));
  if (loyaltyPointsRedeemed > 0) {
    const { data: u } = await supabase.from('users').select('loyalty_points').eq('id', resolvedUserId).maybeSingle();
    if (Number(u?.loyalty_points || 0) < loyaltyPointsRedeemed) {
      throw new Error('Not enough loyalty points for this reward.');
    }
  }
  const pct = Math.min(100, Math.max(1, Number(downpayment_percentage) || 50));
  const downpaymentAmount = Math.round((total * pct) / 100 * 100) / 100;
  const amountCentavos = Math.round(downpaymentAmount * 100);

  if (amountCentavos < 100) {
    throw new Error('Downpayment must be at least ₱1.00');
  }

  const notes = JSON.stringify({
    refCode: ref,
    customerName: customer_name ?? '',
    customerPhone: customer_phone ?? '',
    sport,
    addOns: add_ons ?? '',
    source,
    paymentMethod: 'paymongo',
    downpaymentPercentage: pct,
    downpaymentAmount,
    totalPrice: total,
    balanceDue: Math.round((total - downpaymentAmount) * 100) / 100,
    ...(loyaltyPointsRedeemed > 0 ? { loyaltyPointsRedeemed, loyaltyDiscount } : {}),
    ...(coach_id ? {
      coachId: String(coach_id),
      coachName: String(coach_name || '').trim(),
      coachFee: Math.max(0, Number(coach_fee || 0)),
      courtAmount: Math.max(0, Number(court_amount ?? total - Number(coach_fee || 0))),
      totalDue: Math.max(0, Number(total_due ?? total)),
    } : {}),
    ...(facility_map_id ? { facilityMapId: facility_map_id } : {}),
  });

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert({
      user_id: resolvedUserId,
      court_id: courtId,
      booking_date,
      start_time: startNorm,
      end_time: endNorm,
      status: 'pending',
      base_price: total,
      total_price: total,
      notes,
      qr_code_token: ref,
    })
    .select('id')
    .single();

  if (bookingErr) throw new Error(bookingErr.message);

  const bookingId = booking!.id as string;

  if (loyaltyPointsRedeemed > 0) {
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

  const { data: paymentRow, error: paymentErr } = await supabase
    .from('payments')
    .insert({
      user_id: resolvedUserId,
      booking_id: bookingId,
      amount: downpaymentAmount,
      payment_method: 'paymongo',
      status: 'pending',
      transaction_id: `PM-${ref}-${Date.now()}`,
    })
    .select('id')
    .single();

  if (paymentErr) {
    if (loyaltyPointsRedeemed > 0) {
      const { data: u } = await supabase.from('users').select('loyalty_points').eq('id', resolvedUserId).maybeSingle();
      await supabase.from('users').update({ loyalty_points: Number(u?.loyalty_points || 0) + loyaltyPointsRedeemed }).eq('id', resolvedUserId);
      await supabase.from('loyalty_transactions').insert({
        user_id: resolvedUserId,
        points_change: loyaltyPointsRedeemed,
        transaction_type: 'redemption_refund',
        reference_id: bookingId,
      });
    }
    await supabase.from('bookings').delete().eq('id', bookingId);
    throw new Error(paymentErr.message);
  }

  const paymentId = paymentRow!.id as string;
  const appOrigin = process.env.APP_URL || 'http://localhost:5173';
  const baseSuccess = appendQueryParam(success_url || `${appOrigin}/?payment=success`, 'booking_id', bookingId);
  const baseCancel = appendQueryParam(cancel_url || `${appOrigin}/?payment=cancelled`, 'booking_id', bookingId);

  const billingEmail = (authEmail || '').trim() || 'customer@sportsync.local';

  const checkoutPayload = {
    data: {
      attributes: {
        billing: {
          name: customer_name || 'Sportsync Customer',
          email: billingEmail,
        },
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        line_items: [
          {
            amount: amountCentavos,
            currency: 'PHP',
            name: `${sport} court downpayment (${pct}%)`,
            quantity: 1,
            description: `${court} · ${booking_date} ${startNorm.slice(0, 5)} · ${ref}`.slice(0, 255),
          },
        ],
        payment_method_types: ['gcash', 'card', 'paymaya'],
        description: `Sportsync downpayment (${pct}% of PHP ${total})`,
        statement_descriptor: 'SPORTSYNC',
        success_url: baseSuccess,
        cancel_url: baseCancel,
        reference_number: ref,
        metadata: {
          bookingId: String(bookingId),
          paymentId: String(paymentId),
          refCode: String(ref),
          type: 'court_downpayment',
        },
      },
    },
  };

  const pmRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${paymongoSecret}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(checkoutPayload),
  });

  const pmData = (await pmRes.json().catch(() => ({}))) as {
    data?: { id?: string; attributes?: { checkout_url?: string } };
    errors?: Array<{ detail?: string; title?: string; code?: string }>;
  };

  if (!pmRes.ok) {
    if (loyaltyPointsRedeemed > 0) {
      const { data: u } = await supabase.from('users').select('loyalty_points').eq('id', resolvedUserId).maybeSingle();
      await supabase.from('users').update({ loyalty_points: Number(u?.loyalty_points || 0) + loyaltyPointsRedeemed }).eq('id', resolvedUserId);
      await supabase.from('loyalty_transactions').insert({
        user_id: resolvedUserId,
        points_change: loyaltyPointsRedeemed,
        transaction_type: 'redemption_refund',
        reference_id: bookingId,
      });
    }
    await supabase.from('payments').delete().eq('id', paymentId);
    await supabase.from('bookings').delete().eq('id', bookingId);
    const errMsg =
      pmData?.errors?.[0]?.detail ||
      pmData?.errors?.[0]?.title ||
      pmData?.errors?.[0]?.code ||
      `PayMongo rejected checkout (HTTP ${pmRes.status})`;
    console.error('[paymongoCheckout] PayMongo error:', pmData);
    throw new Error(errMsg);
  }

  const checkoutUrl = pmData?.data?.attributes?.checkout_url;
  const sessionId = pmData?.data?.id;

  if (!checkoutUrl) {
    throw new Error('PayMongo did not return a checkout URL');
  }

  await supabase
    .from('payments')
    .update({
      paymongo_reference_id: sessionId,
      status: 'processing',
    })
    .eq('id', paymentId);

  let coachingSessionId: string | undefined;
  if (coach_id) {
    const coachFee = Math.max(0, Number(coach_fee || 0));
    const courtAmount = Math.max(0, Number(court_amount ?? total - coachFee));
    const totalDue = Math.max(0, Number(total_due ?? total));
    const proof = `COACHING_BOOKING:${JSON.stringify({
      linkedBookingId: bookingId,
      court,
      courtAmount,
      coachFee,
      totalDue,
      paidBy: 'student',
      bookingQr: ref,
    })}`;
    const session = await coachingSessionService.createSession({
      coach_id: String(coach_id),
      user_id: String(coaching_student_id || resolvedUserId),
      sport_id: undefined,
      session_date: booking_date,
      start_time: startNorm,
      end_time: endNorm,
      status: 'pending',
      linked_booking_id: bookingId,
      payment_proof_url: proof,
    });
    coachingSessionId = session.id;
  }

  return {
    checkoutUrl,
    bookingId,
    paymentId,
    coachingSessionId,
    refCode: ref,
    downpaymentAmount,
    totalPrice: total,
    downpaymentPercentage: pct,
    balanceDue: Math.round((total - downpaymentAmount) * 100) / 100,
  };
}

function parseBookingNotes(notes: string | null | undefined): Record<string, unknown> {
  try {
    return notes ? (JSON.parse(notes) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

type BookingRowForResume = {
  id: string;
  user_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number | null;
  notes: string | null;
  qr_code_token: string | null;
  courts?: { name?: string; sports?: { name?: string } | { name?: string }[] | null } | null;
};

/** New PayMongo session for an existing unpaid court booking (e.g. AI concierge). */
export async function resumePaymongoCourtCheckout(
  authUserId: string,
  authEmail: string,
  bookingId: string,
  urls?: { success_url?: string; cancel_url?: string },
) {
  const paymongoSecret = String(process.env.PAYMONGO_SECRET_KEY || '').trim();
  if (!paymongoSecret) {
    throw new Error('PayMongo is not configured on the server (PAYMONGO_SECRET_KEY).');
  }

  const resolvedUserId = await resolveUserRowId(authUserId);

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select(
      `id, user_id, booking_date, start_time, end_time, status, total_price, notes, qr_code_token,
       courts ( name, sports ( name ) )`,
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingErr) throw new Error(bookingErr.message);
  const row = booking as BookingRowForResume | null;
  if (!row) throw new Error('Booking not found');
  if (String(row.user_id) !== resolvedUserId) {
    throw new Error('You can only pay for your own bookings.');
  }
  if (String(row.status || '').toLowerCase() !== 'pending') {
    throw new Error('This booking is no longer awaiting payment.');
  }

  const meta = parseBookingNotes(row.notes);
  const total = Math.max(0, Number(meta.totalPrice ?? row.total_price ?? 0));
  if (total <= 0) throw new Error('Booking total is invalid.');

  const pct = Math.min(100, Math.max(1, Number(meta.downpaymentPercentage) || 50));
  const downpaymentAmount =
    meta.downpaymentAmount != null
      ? Math.round(Number(meta.downpaymentAmount) * 100) / 100
      : Math.round((total * pct) / 100 * 100) / 100;
  const amountCentavos = Math.round(downpaymentAmount * 100);
  if (amountCentavos < 100) throw new Error('Downpayment must be at least ₱1.00');

  const ref = String(row.qr_code_token || meta.refCode || genRefCode()).toUpperCase();
  const courtName = String(row.courts?.name || meta.court || 'Court');
  const sportRel = row.courts?.sports;
  const sportName = String(
    (Array.isArray(sportRel) ? sportRel[0]?.name : sportRel?.name) || meta.sport || 'Sports',
  );
  const startLabel = String(row.start_time || '').slice(0, 5);

  const { data: paymentRows, error: payListErr } = await supabase
    .from('payments')
    .select('id, status')
    .eq('booking_id', bookingId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (payListErr) throw new Error(payListErr.message);

  let paymentId = paymentRows?.[0]?.id as string | undefined;
  if (!paymentId) {
    const { data: created, error: createPayErr } = await supabase
      .from('payments')
      .insert({
        user_id: resolvedUserId,
        booking_id: bookingId,
        amount: downpaymentAmount,
        payment_method: 'paymongo',
        status: 'pending',
        transaction_id: `PM-${ref}-${Date.now()}`,
      })
      .select('id')
      .single();
    if (createPayErr) throw new Error(createPayErr.message);
    paymentId = created!.id as string;
  }

  const appOrigin = process.env.APP_URL || 'http://localhost:5173';
  const baseSuccess = appendQueryParam(urls?.success_url || `${appOrigin}/?payment=success`, 'booking_id', bookingId);
  const baseCancel = appendQueryParam(urls?.cancel_url || `${appOrigin}/?payment=cancelled`, 'booking_id', bookingId);
  const billingEmail = (authEmail || '').trim() || 'customer@sportsync.local';

  const checkoutPayload = {
    data: {
      attributes: {
        billing: {
          name: String(meta.customerName || 'Sportsync Customer'),
          email: billingEmail,
        },
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        line_items: [
          {
            amount: amountCentavos,
            currency: 'PHP',
            name: `${sportName} court downpayment (${pct}%)`,
            quantity: 1,
            description: `${courtName} · ${row.booking_date} ${startLabel} · ${ref}`.slice(0, 255),
          },
        ],
        payment_method_types: ['gcash', 'card', 'paymaya'],
        description: `Sportsync downpayment (${pct}% of PHP ${total})`,
        statement_descriptor: 'SPORTSYNC',
        success_url: baseSuccess,
        cancel_url: baseCancel,
        reference_number: ref,
        metadata: {
          bookingId: String(bookingId),
          paymentId: String(paymentId),
          refCode: String(ref),
          type: 'court_downpayment',
        },
      },
    },
  };

  const pmRes = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${paymongoSecret}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(checkoutPayload),
  });

  const pmData = (await pmRes.json().catch(() => ({}))) as {
    data?: { id?: string; attributes?: { checkout_url?: string } };
    errors?: Array<{ detail?: string; title?: string; code?: string }>;
  };

  if (!pmRes.ok) {
    const errMsg =
      pmData?.errors?.[0]?.detail ||
      pmData?.errors?.[0]?.title ||
      pmData?.errors?.[0]?.code ||
      `PayMongo rejected checkout (HTTP ${pmRes.status})`;
    throw new Error(errMsg);
  }

  const checkoutUrl = pmData?.data?.attributes?.checkout_url;
  const sessionId = pmData?.data?.id;
  if (!checkoutUrl) throw new Error('PayMongo did not return a checkout URL');

  await supabase
    .from('payments')
    .update({
      paymongo_reference_id: sessionId,
      status: 'processing',
      amount: downpaymentAmount,
    })
    .eq('id', paymentId);

  return {
    checkoutUrl,
    bookingId,
    paymentId,
    refCode: ref,
    downpaymentAmount,
    totalPrice: total,
    downpaymentPercentage: pct,
    balanceDue: Math.round((total - downpaymentAmount) * 100) / 100,
  };
}
