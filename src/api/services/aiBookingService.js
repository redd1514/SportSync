/**
 * Parse booking intent from concierge chat and create DB bookings for logged-in users.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  addonLineTotal,
  calcCourtPriceFromSettings,
  fetchSystemCourtRates,
  getPgPool,
  sportKeyFromName,
} from '../utils/aiContext.js';
import { extractDateAndTimeFromMessage, normalizeTime24 } from '../utils/messageDateParse.js';
import { normalizeStartTime } from './deskBookingService.ts';
import { createPaymongoCourtCheckout } from './paymongoCheckoutService.ts';

const DURATION_RE =
  /\b(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|oras|h)\b|(?:for|ng)\s+(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|oras)\b/i;

function normalizeGeminiApiKey(raw) {
  if (raw == null) return '';
  return String(raw).trim().replace(/^\uFEFF/, '');
}

/** Informational questions — answer only, do not create bookings. */
export function messageIsInformationalQuery(message) {
  const m = String(message || '').trim();
  const lower = m.toLowerCase();

  if (/\b(magkano|how\s+much|hm\b|presyo|gagastos|aabutin|magkano\s+aabutin)\b/i.test(lower)) return true;
  if (/\b(pwede\s+ba|may\s+.+\s+ba|kailangan\s+ba|mayroon\s+ba|meron\s+ba)\b/i.test(lower) && /\?/.test(m))
    return true;
  if (/\b(palitan|reschedule|baguhin\s+ang\s+oras)\b/i.test(lower) && /\?/.test(m)) return true;
  if (/\b(student\s+discount|discount\s+sa\s+student|estudyante)\b/i.test(lower)) return true;
  if (
    /\b(oras|open|close|bukas|nagbubukas|nagsasara|operating\s+hours)\b/i.test(lower) &&
    (/\?/.test(m) || /\b(anong|what)\b/i.test(lower))
  )
    return true;
  if (/\b(fully\s+booked|punong-puno|punong\s+puno|booked\s+ba)\b/i.test(lower) && /\?/.test(m)) return true;
  if (/\b(sementado|wooden|hardwood|floor|cimento)\b/i.test(lower) && /\?/.test(m)) return true;
  if (/\b(magbayad\s+agad|bayad\s+sa\s+facility|pay\s+on\s+site)\b/i.test(lower)) return true;
  if (/\b(kasama|included)\b/i.test(lower) && /\b(racket|raket|bola|ball)\b/i.test(lower)) return true;

  if (/\b(pag|kapag|kung)\s+(?:ako\s+)?(?:ay\s+)?nag-?book\b/i.test(lower) && /\?/.test(m)) return true;

  return false;
}

/** Explicit booking command (not "booking ko" in a policy question). */
export function messageHasExplicitBookingCommand(message) {
  const lower = String(message || '').toLowerCase();
  if (/^\s*(book|reserve|mag-?book|i-?book)\b/i.test(lower)) return true;
  if (/\bgusto\s+kong\s+mag-?book\b/i.test(lower)) return true;
  if (/\b(magpa-?book|pa-?book)\b/i.test(lower)) return true;
  if (/\b(iskedyul|schedule)\s+(me\s+)?(a\s+)?(the\s+)?(basketball|volleyball|badminton|court)/i.test(lower))
    return true;
  if (/\b(book|reserve)\s+(me\s+)?(a\s+)?(the\s+)?(basketball|volleyball|badminton|pickleball|billiard|table)/i.test(lower))
    return true;
  if (/\b(book|reserve)\s+(basketball|volleyball|badminton|pickleball|billiard|table)\s*\d/i.test(lower))
    return true;
  if (/\bmag-?book\s+(ako\s+)?(ng\s+)?/i.test(lower) && !/\bpag\s+(?:ako\s+)?(?:ay\s+)?nag-?book\b/i.test(lower))
    return true;
  if (/\b(add|dagdag|idagdag)\b.*\b(add.?on|racket|raket)\b/i.test(lower) && /\b(book|reserve|mag-?book)\b/i.test(lower))
    return true;
  return false;
}

export function messageLooksLikeBooking(message) {
  const m = String(message || '');
  if (messageIsInformationalQuery(m) && !messageHasExplicitBookingCommand(m)) return false;
  return messageHasExplicitBookingCommand(m);
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

const ADDON_KEYWORDS = [
  { re: /\b(racket|raket)\b/i, ids: ['racket'] },
  { re: /\b(shuttle|shuttlecock)\b/i, ids: ['shuttle_f', 'shuttle_p'] },
  { re: /\bball\b|\bbola\b/i, ids: ['ball', 'ball_r'] },
  { re: /\bpaddle\b/i, ids: ['paddle'] },
  { re: /\b(light|ilaw|lights)\b/i, ids: ['lights'] },
  { re: /\bscoreboard\b/i, ids: ['scoreboard'] },
  { re: /\b(ac|aircon|air con)\b/i, ids: ['aircon'] },
];

/**
 * Match add-ons from message against sport catalog; returns labels and peso total.
 * @param {Record<string, Array<{ id: string; label: string; price: number; perHour?: boolean; note?: string }>>} addonsBySport
 */
export function resolveAddonsFromMessage(message, sportName, durationHours, addonsBySport) {
  const sport = String(sportName || '').trim();
  const catalog = addonsBySport?.[sport] || [];
  const lower = String(message || '').toLowerCase();
  const wantsAddon =
    /\b(add.?on|addon|dagdag|idagdag|kasama|with|including)\b/i.test(lower) ||
    ADDON_KEYWORDS.some((k) => k.re.test(lower));
  if (!wantsAddon || !catalog.length) {
    return { labels: [], total: 0, summary: '' };
  }

  const matched = [];
  const seen = new Set();
  for (const kw of ADDON_KEYWORDS) {
    if (!kw.re.test(lower)) continue;
    for (const id of kw.ids) {
      const addon = catalog.find((a) => a.id === id);
      if (addon && !seen.has(addon.id)) {
        seen.add(addon.id);
        const amount = addonLineTotal(addon, durationHours);
        matched.push({ label: addon.label, amount, addon });
      }
    }
  }

  if (matched.length === 0 && /\b(racket|raket)\b/i.test(lower)) {
    const racket = catalog.find((a) => /racket/i.test(a.label));
    if (racket) {
      const amount = addonLineTotal(racket, durationHours);
      matched.push({ label: racket.label, amount, addon: racket });
    }
  }

  const total = matched.reduce((s, x) => s + x.amount, 0);
  const summary = matched.map((x) => x.label).join(' | ');
  return { labels: matched, total, summary };
}

function parseAddonsFromMessage(message, sportName, durationHours, addonsBySport) {
  if (sportName && addonsBySport) {
    return resolveAddonsFromMessage(message, sportName, durationHours, addonsBySport).summary;
  }
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
export function extractBookingIntentRules(message, courts, dateOverrides = {}, addonsBySport = null) {
  if (!messageLooksLikeBooking(message)) {
    return { wantsToBook: false };
  }
  const { date, time } = extractDateAndTimeFromMessage(message, dateOverrides);
  const duration = parseDurationHours(message);
  const court = matchCourtFromMessage(message, courts);
  if (!court) {
    const sportGuess =
      (/\bbadminton\b/i.test(message) && 'Badminton') ||
      (/\bbasketball\b/i.test(message) && 'Basketball') ||
      null;
    const addonInfo = sportGuess
      ? resolveAddonsFromMessage(message, sportGuess, duration, addonsBySport || {})
      : { summary: parseAddonsFromMessage(message) };
    return {
      wantsToBook: true,
      booking_date: date,
      start_time: time || '12:00',
      duration_hours: duration,
      add_ons: addonInfo.summary || parseAddonsFromMessage(message),
      addon_total_php: addonInfo.total || 0,
      missing: ['court'],
    };
  }
  const addonInfo = resolveAddonsFromMessage(message, court.sport_name, duration, addonsBySport || {});
  return {
    wantsToBook: true,
    court_name: court.court_name,
    sport: court.sport_name,
    booking_date: date,
    start_time: time || '12:00',
    duration_hours: duration,
    add_ons: addonInfo.summary || parseAddonsFromMessage(message, court.sport_name, duration, addonsBySport),
    addon_total_php: addonInfo.total || 0,
    missing: [],
  };
}

/**
 * Gemini JSON extraction when rules miss court/time.
 */
export async function extractBookingIntentWithGemini(message, courts, dateOverrides = {}, addonsBySport = null) {
  const apiKey = normalizeGeminiApiKey(process.env.GEMINI_API_KEY);
  if (!apiKey) return extractBookingIntentRules(message, courts, dateOverrides, addonsBySport);

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
    const rules = extractBookingIntentRules(message, courts, dateOverrides, addonsBySport);
    const schedule = extractDateAndTimeFromMessage(message, dateOverrides);
    const sport = parsed.sport || rules.sport || null;
    const duration = Number(parsed.duration_hours) || rules.duration_hours || 1;
    const addonInfo = sport
      ? resolveAddonsFromMessage(message, sport, duration, addonsBySport || {})
      : { summary: rules.add_ons || '', total: rules.addon_total_php || 0 };
    return {
      wantsToBook: messageLooksLikeBooking(message) && Boolean(parsed.wantsToBook ?? rules.wantsToBook),
      court_name: parsed.court_name || rules.court_name || null,
      sport,
      booking_date: schedule.date || rules.booking_date,
      start_time: schedule.time
        ? normalizeTime24(schedule.time)
        : parsed.start_time
          ? normalizeTime24(parsed.start_time)
          : rules.start_time,
      duration_hours: duration,
      add_ons: addonInfo.summary || parsed.add_ons || rules.add_ons || '',
      addon_total_php: addonInfo.total || rules.addon_total_php || 0,
      missing: [],
    };
  } catch {
    return extractBookingIntentRules(message, courts, dateOverrides, addonsBySport);
  }
}

async function resolveIntent(message, courts, dateOverrides, addonsBySport = null) {
  const rules = extractBookingIntentRules(message, courts, dateOverrides, addonsBySport);
  if (rules.wantsToBook && rules.court_name && rules.start_time) return rules;
  const gemini = await extractBookingIntentWithGemini(message, courts, dateOverrides, addonsBySport);
  if (!gemini.court_name) {
    gemini.missing = ['court'];
  } else if (!gemini.start_time) {
    gemini.missing = ['time'];
  } else {
    gemini.missing = [];
  }
  return gemini;
}

function computeTotalPrice(courtRates, intent, addonsBySport = null) {
  const rate = calcCourtPriceFromSettings(
    courtRates,
    intent.sport,
    intent.booking_date,
    intent.start_time,
  );
  const hours = intent.duration_hours || 1;
  const courtSubtotal = Math.round(rate * hours);
  let addonTotal = Number(intent.addon_total_php) || 0;
  if (!addonTotal && intent.sport && addonsBySport) {
    const resolved = resolveAddonsFromMessage(
      intent._sourceMessage || '',
      intent.sport,
      hours,
      addonsBySport,
    );
    addonTotal = resolved.total;
    if (!intent.add_ons && resolved.summary) intent.add_ons = resolved.summary;
  }
  return courtSubtotal + addonTotal;
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
  addonsBySport = null,
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

  let intent = await resolveIntent(message, courts, dateOverrides, addonsBySport);
  intent = applyMessageScheduleToIntent(message, intent, dateOverrides);
  intent._sourceMessage = message;
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
  if (intent.sport && addonsBySport) {
    const addonResolved = resolveAddonsFromMessage(
      message,
      intent.sport,
      intent.duration_hours || 1,
      addonsBySport,
    );
    intent.addon_total_php = addonResolved.total;
    if (addonResolved.summary) intent.add_ons = addonResolved.summary;
  }

  const total = computeTotalPrice(courtRates, intent, addonsBySport);
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
