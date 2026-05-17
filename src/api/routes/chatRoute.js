/**
 * JRC SportSync AI concierge — Gemini + PostgreSQL context (Hono router).
 */
import { Hono } from 'hono';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { buildSportSyncAiKnowledge, getPgPool, manilaDateKey } from '../utils/aiContext.js';
import { extractDateAndTimeFromMessage, normalizeTime24 } from '../utils/messageDateParse.js';
import { messageLooksLikeBooking, tryConciergeBooking } from '../services/aiBookingService.js';
import { findUserRow } from '../services/userRowQuery.ts';
import { isUserRowSuspended, resolveBearer } from '../auth/resolveBearer.ts';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const JRC_CONCIERGE_SYSTEM = `You are the JRC SportSync Concierge — a helpful, professional assistant for JRC Ballpark / SportSync court bookings.

You receive KNOWLEDGE JSON with:
- requestedDate and requestedTime: the date/time inferred from the user's message (Asia/Manila).
- courts: each active court with hourly_rates (rate_per_hour in PHP) and rate_per_hour_php for the requested slot.
- pricingBySport: facility rate card when needed.
- existingBookings: ALL confirmed/checked_in bookings on requestedDate ONLY.

CRITICAL AVAILABILITY RULE:
- existingBookings is authoritative for that date. If it is an empty array [], there are NO confirmed bookings on file for that date — courts are available unless a specific overlap is listed.
- If a specific court and time slot is NOT listed in existingBookings with an overlapping start_time–end_time, the court is AVAILABLE at that time.
- Never say you "don't have data" when existingBookings is present (even if empty). An empty list means slots are open.

PRICING RULE:
- Always quote rates using hourly_rates / rate_per_hour_php from courts in KNOWLEDGE for the requested date and time.
- State totals in Philippine Peso (₱). For a 1-hour slot, total ≈ rate_per_hour_php unless the user asks for a different duration.

LANGUAGE:
- If the user writes in Tagalog or Taglish, respond in helpful Taglish/Filipino.
- If they write in English only, respond in English.

BOOKING:
- When BOOKING_RESULT shows needsPayment:true, the slot is held as pending until PayMongo downpayment is paid. Tell the user to tap "Pay downpayment" in chat (GCash, card, or Maya). After payment, the booking is confirmed and appears in My Bookings with a QR ticket.
- When BOOKING_RESULT shows needsLogin, ask them to log in first to complete a booking.
- When BOOKING_RESULT shows ok:false with error, explain clearly (e.g. slot taken, missing court name).

Be concise, accurate, and never invent courts or bookings not in KNOWLEDGE.`;

function normalizeGeminiApiKey(raw) {
  if (raw == null) return '';
  let k = String(raw).trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  return k.replace(/^\uFEFF/, '');
}

/** Bearer auth, or trusted body userId+userEmail when client is logged in but token missing (dev-friendly). */
async function resolveChatAuth(c, body) {
  const fromBearer = c.get('auth');
  if (fromBearer?.userId) return fromBearer;

  const headerAuth = await resolveBearer(c.req.header('Authorization'));
  if (headerAuth?.userId) return headerAuth;

  const uid = typeof body.userId === 'string' ? body.userId.trim() : '';
  const email = typeof body.userEmail === 'string' ? body.userEmail.trim().toLowerCase() : '';
  if (!uid || !email) return null;

  const row = await findUserRow(uid);
  if (!row || isUserRowSuspended(row)) return null;
  const rowEmail = String(row.email || '').trim().toLowerCase();
  if (rowEmail && rowEmail !== email) return null;

  return {
    userId: String(row.id),
    email: String(row.email || email),
    dbRole: String(row.role || 'user'),
    appRole: 'user',
  };
}

function formatTime12h(time24) {
  const [hRaw, mRaw = '0'] = String(time24 || '12:00').split(':');
  let h = parseInt(hRaw, 10);
  const m = parseInt(mRaw, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function formatManilaDateLong(dateKey) {
  const [y, m, d] = String(dateKey || '').split('-').map(Number);
  if (!y || !m || !d) return dateKey || '';
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Deterministic Taglish confirmation — does not depend on Gemini. */
export function buildConciergeBookingSuccessReply(bookingResult) {
  const b = bookingResult.booking || {};
  const court = b.court || bookingResult.intent?.court_name || 'your court';
  const dateKey = b.date || bookingResult.intent?.booking_date || '';
  const time24 = String(b.time || bookingResult.intent?.start_time || '12:00').slice(0, 5);
  const duration = Number(b.duration ?? bookingResult.intent?.duration_hours ?? 1);
  const amount = Number(b.amount ?? 0);
  const ref = b.refCode || bookingResult.refCode || '';
  const hoursLabel = duration === 1 ? 'hour' : 'hours';

  return `Okay, kumpirmado na ang booking mo!

Na-reserve ang **${court}** sa **${formatManilaDateLong(dateKey)}, ${formatTime12h(time24)}** for **${duration} ${hoursLabel}**. Ang total price ay **₱${amount}**.

Ang reference code mo ay **${ref}**. Makikita mo rin ito sa My Bookings, kasama ang scannable QR ticket.`;
}

/** Taglish reply when checkout is ready — booking stays pending until PayMongo payment. */
export function buildConciergePaymentPendingReply(bookingResult) {
  const intent = bookingResult.intent || {};
  const pay = bookingResult.payment || {};
  const court = intent.court_name || 'your court';
  const dateKey = intent.booking_date || '';
  const time24 = String(intent.start_time || '12:00').slice(0, 5);
  const duration = Number(intent.duration_hours ?? 1);
  const hoursLabel = duration === 1 ? 'hour' : 'hours';
  const total = Number(pay.totalPrice ?? 0);
  const down = Number(pay.downpaymentAmount ?? 0);
  const pct = Number(pay.downpaymentPercentage ?? 50);
  const ref = bookingResult.refCode || '';

  return `Naka-hold na ang **${court}** sa **${formatManilaDateLong(dateKey)}, ${formatTime12h(time24)}** (${duration} ${hoursLabel}).

Para ma-confirm ang reservation, kailangan mo munang bayaran ang **${pct}% downpayment (₱${down})** ng total na **₱${total}** via PayMongo (GCash, card, o Maya).

Reference: **${ref}**. Tap **Pay downpayment** sa chat para mag-checkout. Pagkatapos ng bayad, lalabas na ito sa My Bookings kasama ang QR ticket.`;
}

function formatGeminiSdkError(err) {
  if (!err) return 'Unknown error';
  const bits = [String(err.message || err)];
  if (typeof err.status === 'number') bits.push(`status=${err.status}`);
  if (err.statusText) bits.push(String(err.statusText));
  if (err.errorDetails != null) {
    try {
      bits.push(`errorDetails=${JSON.stringify(err.errorDetails)}`);
    } catch {
      bits.push('errorDetails=[unserializable]');
    }
  }
  if (err.cause) bits.push(`cause=${err.cause}`);
  return bits.join(' | ');
}

/**
 * @param {string} userMessage
 * @param {object} knowledge
 * @param {object | null} bookingResult
 */
export async function runGeminiConcierge(userMessage, knowledge, bookingResult = null) {
  const apiKey = normalizeGeminiApiKey(process.env.GEMINI_API_KEY);
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not configured');
    err.code = 'GEMINI_CONFIG';
    throw err;
  }

  const modelId = (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
  const requestOpts = { timeout: 120_000 };

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    {
      model: modelId,
      systemInstruction: JRC_CONCIERGE_SYSTEM,
    },
    requestOpts,
  );

  const knowledgeText = JSON.stringify(knowledge, null, 2);
  const prompt = [
    'KNOWLEDGE (authoritative):',
    knowledgeText,
    '',
    `The user is asking about date=${knowledge.requestedDate}, time=${knowledge.requestedTime} (Manila).`,
    `existingBookings count for that date: ${knowledge.existingBookings?.length ?? 0}.`,
    knowledge.existingBookings?.length === 0
      ? 'existingBookings is EMPTY — you may confirm courts are available if no conflict applies.'
      : '',
    bookingResult
      ? `BOOKING_RESULT (system — authoritative):\n${JSON.stringify(bookingResult, null, 2)}`
      : '',
    '',
    'USER MESSAGE:',
    userMessage,
  ]
    .filter(Boolean)
    .join('\n');

  const result = await model.generateContent(prompt, requestOpts);
  const text = result.response?.text();
  if (!text || !String(text).trim()) {
    const err = new Error('Empty response from Gemini');
    err.code = 'GEMINI_EMPTY';
    throw err;
  }
  return String(text).trim();
}

const chat = new Hono();

chat.post('/', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return c.json({ error: 'message is required (non-empty string)', code: 'BAD_REQUEST' }, 400);
    }

    const today = manilaDateKey();
    const explicitDate =
      typeof body.bookingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.bookingDate)
        ? body.bookingDate
        : undefined;
    const explicitTime =
      typeof body.bookingTime === 'string' ? normalizeTime24(body.bookingTime) : undefined;

    const { date: requestedDate, time: parsedTime, source: dateSource } = extractDateAndTimeFromMessage(
      message,
      { today, explicitDate, explicitTime },
    );
    const requestedTime = parsedTime ?? explicitTime ?? '12:00';

    let knowledge;
    try {
      const pool = getPgPool();
      knowledge = await buildSportSyncAiKnowledge(pool, {
        requestedDate,
        requestedTime,
      });
    } catch (dbErr) {
      console.error('[chatRoute] database context error:', dbErr?.message || dbErr);
      return c.json(
        {
          error: 'Could not load facility knowledge from the database.',
          code: 'DB_CONTEXT_FAILED',
          details: process.env.NODE_ENV === 'development' ? String(dbErr?.message || dbErr) : undefined,
        },
        503,
      );
    }

    const auth = await resolveChatAuth(c, body);
    let bookingResult = null;
    if (messageLooksLikeBooking(message)) {
      if (auth?.userId) {
        const userRow = await findUserRow(auth.userId);
        const returnBaseUrl =
          typeof body.returnBaseUrl === 'string' ? body.returnBaseUrl.trim() : '';
        bookingResult = await tryConciergeBooking({
          message,
          courts: knowledge.courts,
          userId: auth.userId,
          userEmail: auth.email,
          customerName: String(
            body.userName || userRow?.full_name || auth.email || 'Customer',
          ),
          customerPhone: String(userRow?.phone || body.userPhone || ''),
          dateOverrides: { today, explicitDate, explicitTime },
          returnBaseUrl,
        });
      } else {
        bookingResult = await tryConciergeBooking({
          message,
          courts: knowledge.courts,
          userId: null,
          dateOverrides: { today, explicitDate, explicitTime },
        });
      }
    }

    let reply;
    if (bookingResult?.needsPayment) {
      reply = buildConciergePaymentPendingReply(bookingResult);
    } else if (bookingResult?.ok) {
      reply = buildConciergeBookingSuccessReply(bookingResult);
    } else if (bookingResult?.needsLogin) {
      reply =
        'Para makapag-book sa chat, mag-log in muna. Pagkatapos, sabihin lang ulit ang court, petsa, oras, at tagal ng session.';
    } else if (bookingResult && !bookingResult.skipped && bookingResult.error) {
      reply = bookingResult.error;
    }

    if (!reply) {
      try {
        reply = await runGeminiConcierge(message, knowledge, bookingResult);
      } catch (aiErr) {
        const full = formatGeminiSdkError(aiErr);
        console.error('[chatRoute] Gemini error:', full);
        if (bookingResult && !bookingResult.skipped && bookingResult.error) {
          reply = bookingResult.error;
        } else {
          const code = aiErr?.code === 'GEMINI_CONFIG' ? 'GEMINI_CONFIG' : 'GEMINI_FAILED';
          const status = code === 'GEMINI_CONFIG' ? 503 : 502;
          const debug =
            process.env.NODE_ENV === 'development' ||
            String(process.env.GEMINI_DEBUG || '').toLowerCase() === 'true';
          return c.json(
            {
              error: 'Assistant is temporarily unavailable.',
              code,
              model: (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim(),
              details: debug ? full : undefined,
            },
            status,
          );
        }
      }
    }

    return c.json({
      reply,
      requestedDate: knowledge.requestedDate,
      requestedTime: knowledge.requestedTime,
      dateSource,
      booking: bookingResult?.ok ? bookingResult.booking : null,
      bookingError:
        bookingResult?.ok || bookingResult?.needsPayment
          ? null
          : bookingResult?.error || null,
      needsLogin: Boolean(bookingResult?.needsLogin),
      needsPayment: Boolean(bookingResult?.needsPayment),
      paymentCheckout: bookingResult?.needsPayment ? bookingResult.payment : null,
      meta: {
        courtsCount: knowledge.courts?.length ?? 0,
        existingBookingsCount: knowledge.existingBookings?.length ?? 0,
        bookingsOverlappingRequestedTime: knowledge.bookingsOverlappingRequestedTime?.length ?? 0,
        bookingAttempted: Boolean(bookingResult && !bookingResult.skipped),
      },
    });
  } catch (err) {
    console.error('[chatRoute] unhandled error:', err?.message || err);
    return c.json({ error: 'Internal Server Error', code: 'INTERNAL' }, 500);
  }
});

export default chat;
