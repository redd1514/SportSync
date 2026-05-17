/**
 * Parse booking intent from concierge chat and create DB bookings for logged-in users.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  calcCourtPriceFromSettings,
  fetchSystemCourtRates,
  getPgPool,
  sportKeyFromName,
} from '../utils/aiContext.js';
import { extractDateAndTimeFromMessage, normalizeTime24 } from '../utils/messageDateParse.js';
import { normalizeStartTime } from './deskBookingService.ts';
import { createPaymongoCourtCheckout } from './paymongoCheckoutService.ts';

const BOOKING_INTENT_RE =
  /\b(book|booking|reserve|reservation|mag-?book|i-?book|gusto\s+kong\s+mag-?book|magpa-?book|pa-?book|schedule|iskedyul)\b/i;

const DURATION_RE =
  /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|oras|h)\b|(?:for|ng)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|oras)\b/i;

function normalizeGeminiApiKey(raw) {
  if (raw == null) return '';
  return String(raw).trim().replace(/^\uFEFF/, '');
}

export function messageLooksLikeBooking(message) {
  return BOOKING_INTENT_RE.test(String(message || ''));
}

export function parseDurationHours(message) {
  const m = String(message || '').match(DURATION_RE);
  if (!m) return 1;
  const n = parseFloat(m[1] || m[2]);
  if (Number.isNaN(n) || n <= 0) return 1;
  return Math.min(8, Math.max(0.5, Math.round(n * 2) / 2));
}

const COURT_SPORT_NUM_RE =
  /\b(basketball|volleyball|badminton|pickleball|billiards?|table\s*tennis|ping\s*pong)\s*#?\s*(\d+)\b/i;

const SPORT_ALIAS_PATTERNS = [
  [/basket\s*ball/, 'basketball'],
  [/table\s*tennis|ping\s*[- ]?pong/, 'table tennis'],
  [/pickle\s*ball/, 'pickleball'],
];

function sportKeyFromAlias(text) {
  const lower = String(text || '').toLowerCase();
  for (const [re, sport] of SPORT_ALIAS_PATTERNS) {
    if (re.test(lower)) return sport;
  }
  return null;
}

/** Always derive Manila booking date/time from the user message (Taglish-safe). */
export function applyMessageScheduleToIntent(message, intent, dateOverrides = {}) {
  const { date, time } = extractDateAndTimeFromMessage(message, dateOverrides);
  if (date) intent.booking_date = date;
  if (time) intent.start_time = normalizeTime24(time);
  return intent;
}

/** Normalize user/Gemini court label to a DB court_name from the active list. */
export function canonicalCourtName(requested, courts) {
  let q = String(requested || '').trim();
  if (!q) return q;
  const list = Array.isArray(courts) ? courts : [];
  const aliasSport = sportKeyFromAlias(q);
  if (aliasSport) {
    const courtNum =
      q.match(new RegExp(`${aliasSport.replace(/\s+/g, '\\s*')}(?:\\s+court)?\\s*(\\d+)`, 'i'))?.[1] ||
      q.match(/\bcourt\s*(\d+)\b/i)?.[1];
    if (courtNum) q = `${aliasSport} ${courtNum}`;
  }
  const lower = q.toLowerCase();
  const exact = list.find((c) => String(c.court_name || '').toLowerCase() === lower);
  if (exact) return exact.court_name;

  const numMatch = lower.match(COURT_SPORT_NUM_RE);
  if (numMatch) {
    const sportWord = numMatch[1].toLowerCase().replace(/\s+/g, ' ');
    const num = numMatch[2];
    const sportKey = sportWord.startsWith('billiard')
      ? 'billiards'
      : sportWord.includes('table') || sportWord.includes('ping')
        ? 'table tennis'
        : sportWord;
    const byNum = list.filter((c) => {
      const cn = String(c.court_name || '').toLowerCase();
      const sn = sportKeyFromName(c.sport_name);
      return sn === sportKeyFromName(sportKey) && new RegExp(`\\b${num}\\b`).test(cn);
    });
    if (byNum.length === 1) return byNum[0].court_name;
    const titled =
      sportKey === 'table tennis'
        ? `Table Tennis ${num}`
        : `${sportKey.charAt(0).toUpperCase()}${sportKey.slice(1)} ${num}`;
    const titledHit = list.find((c) => String(c.court_name || '').toLowerCase() === titled.toLowerCase());
    if (titledHit) return titledHit.court_name;
  }

  let best = null;
  let bestScore = 0;
  for (const c of list) {
    const cn = String(c.court_name || '').toLowerCase();
    if (!cn) continue;
    if (lower.includes(cn) || cn.includes(lower)) {
      const score = cn.length;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
  }
  return best?.court_name || q;
}

/** Fuzzy-match court name from user text against active courts list. */
export function matchCourtFromMessage(message, courts) {
  const text = String(message || '').toLowerCase();
  const list = Array.isArray(courts) ? courts : [];

  const numMatch = text.match(COURT_SPORT_NUM_RE);
  if (numMatch) {
    const canonical = canonicalCourtName(`${numMatch[1]} ${numMatch[2]}`, list);
    const hit = list.find((c) => String(c.court_name || '').toLowerCase() === canonical.toLowerCase());
    if (hit) return hit;
  }

  const aliasSport = sportKeyFromAlias(text);
  if (aliasSport) {
    const courtNum =
      text.match(new RegExp(`${aliasSport.replace(/\s+/g, '\\s*')}(?:\\s+court)?\\s*(\\d+)`, 'i'))?.[1] ||
      text.match(/\bcourt\s*(\d+)\b/i)?.[1] ||
      text.match(/\b(\d+)\s*(?:st|nd|rd|th)?\s*court\b/i)?.[1];
    if (courtNum) {
      const canonical = canonicalCourtName(`${aliasSport} ${courtNum}`, list);
      const hit = list.find(
        (c) => String(c.court_name || '').toLowerCase() === canonical.toLowerCase(),
      );
      if (hit) return hit;
    }
    const sameSport = list.filter(
      (x) => sportKeyFromName(x.sport_name) === sportKeyFromName(aliasSport),
    );
    if (sameSport.length === 1) return sameSport[0];
  }

  let best = null;
  let bestScore = 0;
  for (const c of list) {
    const name = String(c.court_name || '').trim();
    if (!name) continue;
    const lower = name.toLowerCase();
    if (text.includes(lower)) {
      const score = lower.length;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
  }
  if (best) return best;

  for (const c of list) {
    const sport = String(c.sport_name || '').toLowerCase();
    if (!sport) continue;
    if (text.includes(sport)) {
      const sameSport = list.filter((x) => sportKeyFromName(x.sport_name) === sportKeyFromName(sport));
      if (sameSport.length === 1) return sameSport[0];
      if (sameSport.length > 0 && !best) best = sameSport[0];
    }
  }
  return best;
}

function parseAddonsFromMessage(message) {
  const parts = [];
  const lower = String(message || '').toLowerCase();
  if (/ball|bola/.test(lower)) parts.push('Ball rental');
  if (/racket|raket/.test(lower)) parts.push('Racket rental');
  if (/paddle/.test(lower)) parts.push('Paddle rental');
  if (/light|ilaw|lights/.test(lower)) parts.push('Lighting');
  if (/scoreboard/.test(lower)) parts.push('Scoreboard');
  if (/ac|aircon|air con/.test(lower)) parts.push('AC');
  return parts.join(' | ');
}

/**
 * Rule-based extraction (fast path).
 */
export function extractBookingIntentRules(message, courts, dateOverrides = {}) {
  if (!messageLooksLikeBooking(message)) {
    return { wantsToBook: false };
  }
  const { date, time } = extractDateAndTimeFromMessage(message, dateOverrides);
  const court = matchCourtFromMessage(message, courts);
  if (!court) {
    return {
      wantsToBook: true,
      booking_date: date,
      start_time: time || '12:00',
      duration_hours: parseDurationHours(message),
      add_ons: parseAddonsFromMessage(message),
      missing: ['court'],
    };
  }
  return {
    wantsToBook: true,
    court_name: court.court_name,
    sport: court.sport_name,
    booking_date: date,
    start_time: time || '12:00',
    duration_hours: parseDurationHours(message),
    add_ons: parseAddonsFromMessage(message),
    missing: [],
  };
}

/**
 * Gemini JSON extraction when rules miss court/time.
 */
export async function extractBookingIntentWithGemini(message, courts, dateOverrides = {}) {
  const apiKey = normalizeGeminiApiKey(process.env.GEMINI_API_KEY);
  if (!apiKey) return extractBookingIntentRules(message, courts, dateOverrides);

  const courtList = (courts || [])
    .map((c) => `${c.court_name} (${c.sport_name})`)
    .join(', ');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
    generationConfig: { responseMimeType: 'application/json' },
  });

  const prompt = `Extract booking fields from the user message for a sports facility.
Active courts: ${courtList || 'none'}
Return JSON only:
{
  "wantsToBook": boolean,
  "court_name": string or null,
  "sport": string or null,
  "booking_date": "YYYY-MM-DD" or null,
  "start_time": "HH:MM" 24h or null,
  "duration_hours": number,
  "add_ons": string or ""
}
User message: ${message}`;

  try {
    const result = await model.generateContent(prompt, { timeout: 45_000 });
    const raw = result.response?.text();
    const parsed = JSON.parse(raw || '{}');
    const rules = extractBookingIntentRules(message, courts, dateOverrides);
    const schedule = extractDateAndTimeFromMessage(message, dateOverrides);
    return {
      wantsToBook: Boolean(parsed.wantsToBook ?? rules.wantsToBook),
      court_name: parsed.court_name || rules.court_name || null,
      sport: parsed.sport || rules.sport || null,
      booking_date: schedule.date || rules.booking_date,
      start_time: schedule.time
        ? normalizeTime24(schedule.time)
        : parsed.start_time
          ? normalizeTime24(parsed.start_time)
          : rules.start_time,
      duration_hours: Number(parsed.duration_hours) || rules.duration_hours || 1,
      add_ons: parsed.add_ons || rules.add_ons || '',
      missing: [],
    };
  } catch {
    return extractBookingIntentRules(message, courts, dateOverrides);
  }
}

async function resolveIntent(message, courts, dateOverrides) {
  const rules = extractBookingIntentRules(message, courts, dateOverrides);
  if (rules.wantsToBook && rules.court_name && rules.start_time) return rules;
  const gemini = await extractBookingIntentWithGemini(message, courts, dateOverrides);
  if (!gemini.court_name) {
    gemini.missing = ['court'];
  } else if (!gemini.start_time) {
    gemini.missing = ['time'];
  } else {
    gemini.missing = [];
  }
  return gemini;
}

function computeTotalPrice(courtRates, intent) {
  const rate = calcCourtPriceFromSettings(
    courtRates,
    intent.sport,
    intent.booking_date,
    intent.start_time,
  );
  const hours = intent.duration_hours || 1;
  return Math.round(rate * hours);
}

/**
 * Create booking when intent is complete and user is authenticated.
 * @returns {Promise<{ ok: boolean, booking?: object, error?: string, intent?: object, needsLogin?: boolean }>}
 */
export async function tryConciergeBooking({
  message,
  courts,
  userId,
  userEmail,
  customerName,
  customerPhone,
  dateOverrides = {},
  returnBaseUrl,
}) {
  if (!messageLooksLikeBooking(message)) {
    return { ok: false, skipped: true };
  }

  if (!userId) {
    return {
      ok: false,
      needsLogin: true,
      error: 'Please log in to book a court through the AI concierge.',
    };
  }

  let intent = await resolveIntent(message, courts, dateOverrides);
  intent = applyMessageScheduleToIntent(message, intent, dateOverrides);
  if (!intent.wantsToBook) {
    return { ok: false, skipped: true };
  }

  if (intent.court_name) {
    intent.court_name = canonicalCourtName(intent.court_name, courts);
    const matched = courts.find(
      (c) => String(c.court_name || '').toLowerCase() === intent.court_name.toLowerCase(),
    );
    if (matched?.sport_name) intent.sport = matched.sport_name;
  }

  if (intent.missing?.includes('court')) {
    return {
      ok: false,
      error: 'Which court would you like? Tell me the court name (e.g. Basketball 1, Badminton 2).',
      intent,
    };
  }
  if (intent.missing?.includes('time')) {
    return {
      ok: false,
      error: 'What time should I book? (e.g. 3pm, 15:00)',
      intent,
    };
  }

  let courtRates;
  let downpaymentPercentage = 50;
  try {
    const settings = await fetchSystemCourtRates(getPgPool());
    courtRates = settings.courtRates;
    downpaymentPercentage = settings.downpaymentPercentage ?? 50;
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not load pricing', intent };
  }
  const total = computeTotalPrice(courtRates, intent);
  const startNorm = normalizeStartTime(intent.start_time);
  const duration = intent.duration_hours || 1;
  const base = typeof returnBaseUrl === 'string' ? returnBaseUrl.trim().replace(/\/$/, '') : '';

  try {
    const checkout = await createPaymongoCourtCheckout(userId, userEmail || '', {
      court: intent.court_name,
      sport: intent.sport,
      booking_date: intent.booking_date,
      start_time: startNorm,
      duration_hours: duration,
      total_price: total,
      customer_name: customerName || 'Customer',
      customer_phone: customerPhone || '',
      add_ons: intent.add_ons || 'AI Concierge Booking',
      downpayment_percentage: downpaymentPercentage,
      source: 'ai_concierge',
      ...(base
        ? {
            success_url: `${base}?payment=success`,
            cancel_url: `${base}?payment=cancelled`,
          }
        : {}),
    });

    return {
      ok: false,
      needsPayment: true,
      intent,
      refCode: checkout.refCode,
      payment: {
        checkoutUrl: checkout.checkoutUrl,
        bookingId: checkout.bookingId,
        downpaymentAmount: checkout.downpaymentAmount,
        totalPrice: checkout.totalPrice,
        downpaymentPercentage: checkout.downpaymentPercentage,
        balanceDue: checkout.balanceDue,
      },
    };
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not start PayMongo checkout', intent };
  }
}
