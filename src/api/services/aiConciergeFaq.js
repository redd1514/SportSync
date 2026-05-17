/**
 * Deterministic FAQ / price-quote replies for concierge chat (no booking side-effects).
 */
import {
  addonLineTotal,
  calcCourtPriceFromSettings,
  FACILITY_FAQ,
  sportKeyFromName,
} from '../utils/aiContext.js';
import { extractDateAndTimeFromMessage } from '../utils/messageDateParse.js';
import { matchCourtFromMessage, parseDurationHours, resolveAddonsFromMessage } from './aiBookingService.js';

function formatTime12h(time24) {
  const [hRaw, mRaw = '0'] = String(time24 || '12:00').split(':');
  let h = parseInt(hRaw, 10);
  const m = parseInt(mRaw, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${String(m).padStart(2, '0')} ${ap}`;
}

function formatHoursRange(businessHours) {
  const start = businessHours?.start || '06:00';
  const end = businessHours?.end || '23:00';
  return `${formatTime12h(start)} – ${formatTime12h(end)} daily (Asia/Manila)`;
}

/**
 * Build a price quote from message + knowledge (court rate + add-ons).
 */
export function buildPricingQuote(message, knowledge, dateOverrides = {}) {
  const { date, time } = extractDateAndTimeFromMessage(message, {
    today: knowledge.today,
    ...dateOverrides,
  });
  const bookingDate = date || knowledge.requestedDate;
  const startTime = time || knowledge.requestedTime || '12:00';
  const duration = parseDurationHours(message);
  const court = matchCourtFromMessage(message, knowledge.courts || []);
  const sport =
    court?.sport_name ||
    (/\bbasketball\b/i.test(message) ? 'Basketball' : null) ||
    (/\bvolleyball\b/i.test(message) ? 'Volleyball' : null) ||
    (/\bbadminton\b/i.test(message) ? 'Badminton' : null) ||
    (/\bpickleball\b/i.test(message) ? 'Pickleball' : null) ||
    (/\bbilliard/i.test(message) ? 'Billiards' : null) ||
    (/\b(table\s*tennis|ping\s*pong)\b/i.test(message) ? 'Table Tennis' : null) ||
    (/\btennis\b/i.test(message) ? 'Table Tennis' : null);

  if (!sport) return null;

  const rate = calcCourtPriceFromSettings(
    knowledge.courtRates || buildRatesFromKnowledge(knowledge),
    sport,
    bookingDate,
    startTime,
  );
  const courtSubtotal = Math.round(rate * duration);
  const { labels, total: addonTotal } = resolveAddonsFromMessage(
    message,
    sport,
    duration,
    knowledge.addonsBySport || {},
  );
  const total = courtSubtotal + addonTotal;

  return {
    sport,
    court_name: court?.court_name || null,
    booking_date: bookingDate,
    start_time: startTime,
    duration_hours: duration,
    rate_per_hour_php: rate,
    court_subtotal_php: courtSubtotal,
    addon_labels: labels,
    addon_subtotal_php: addonTotal,
    total_php: total,
  };
}

function buildRatesFromKnowledge(knowledge) {
  const out = {};
  for (const row of knowledge.pricingBySport || []) {
    const key = sportKeyFromName(row.sport_name);
    if (row.pricing_type === 'flat') {
      out[key] = { flat: row.rate_per_hour_php };
    } else {
      out[key] = {
        weekdayDay: row.weekday_day_php,
        weekdayEvening: row.weekday_evening_php,
        weekendDay: row.weekend_day_php,
        weekendEvening: row.weekend_evening_php,
      };
    }
  }
  return out;
}

function formatQuoteReply(quote, knowledge) {
  const lines = [];
  const courtLabel = quote.court_name || quote.sport;
  lines.push(
    `Para sa **${courtLabel}** sa **${quote.booking_date}**, ${formatTime12h(quote.start_time)} (${quote.duration_hours} ${quote.duration_hours === 1 ? 'hour' : 'hours'}):`,
  );
  lines.push(
    `• Court: ₱${quote.rate_per_hour_php.toLocaleString()}/hr × ${quote.duration_hours} = **₱${quote.court_subtotal_php.toLocaleString()}**`,
  );
  if (quote.addon_labels?.length) {
    for (const a of quote.addon_labels) {
      lines.push(`• ${a.label}: +₱${a.amount.toLocaleString()}`);
    }
  }
  lines.push(`\n**Estimated total: ₱${quote.total_php.toLocaleString()}**`);
  const pct = knowledge.downpaymentPercentage ?? 50;
  const down = Math.round((quote.total_php * pct) / 100);
  lines.push(
    `\nIto ay estimate lang — hindi pa ito booking. Kung gusto mo i-reserve, sabihin: "Book ${courtLabel} ${quote.booking_date} ${formatTime12h(quote.start_time)} for ${quote.duration_hours} hours".`,
  );
  lines.push(
    `Kung mag-book ka sa chat, ${pct}% downpayment (₱${down}) via GCash/card/Maya ang kailangan para ma-confirm.`,
  );
  return lines.join('\n');
}

/**
 * @returns {string | null} FAQ reply when message is informational (not a booking command).
 */
export function tryConciergeFaqReply(message, knowledge, dateOverrides = {}) {
  const m = String(message || '').trim();
  const lower = m.toLowerCase();
  const faq = knowledge.facilityFaq || FACILITY_FAQ;
  const hours = knowledge.businessHours;

  if (/\b(student\s+discount|discount\s+sa\s+student|estudyante)\b/i.test(lower)) {
    return faq.studentDiscount;
  }

  if (
    /\b(magbayad\s+agad|bayad\s+sa\s+facility|sa\s+mismong\s+facility|pay\s+on\s+site|pay\s+at\s+the\s+facility)\b/i.test(
      lower,
    )
  ) {
    return faq.paymentPolicy;
  }

  if (/\b(palitan|palitan\s+ang\s+oras|reschedule|baguhin\s+ang\s+oras)\b/i.test(lower) && /\?/.test(m)) {
    return faq.reschedulePolicy;
  }

  if (/\b(sementado|wooden|hardwood|floor|cimento)\b/i.test(lower) && /\bbasketball\b/i.test(lower)) {
    return faq.basketballFloor;
  }

  if (
    /\b(tennis|table\s*tennis|ping\s*pong)\b/i.test(lower) &&
    /\b(kasama|racket|raket|bola|ball|included)\b/i.test(lower)
  ) {
    return faq.tennisNote + ' ' + faq.equipmentIncluded;
  }

  if (/\b(kasama|included|dala\s+na)\b/i.test(lower) && /\b(racket|raket|bola|ball)\b/i.test(lower)) {
    return faq.equipmentIncluded;
  }

  if (
    /\b(oras|open|close|bukas|nagbubukas|nagsasara|operating\s+hours|business\s+hours)\b/i.test(lower) &&
    (/\?/.test(m) || /\b(what|anong|kailan)\b/i.test(lower))
  ) {
    return `Bukas kami araw-araw, ${formatHoursRange(hours)}.\n\nPeak hours kadalasan weekdays 5–9 PM — mas mainam mag-book nang maaga.`;
  }

  if (/\b(fully\s+booked|punong-puno|punong\s+puno|booked\s+ba|may\s+slot\s+pa)\b/i.test(lower) && /\?/.test(m)) {
    const count = knowledge.bookingsOnRequestedDateCount ?? 0;
    const courts = knowledge.activeCourtCount ?? 0;
    const date = knowledge.requestedDate;
    if (count === 0) {
      return `Sa records namin, walang confirmed booking pa sa **${date}** — maraming courts pa ang available sa iba't ibang oras. Sabihin lang ang sport, petsa, at oras para sa specific availability.`;
    }
    return `${knowledge.fullyBookedHint || ''}\n\nSa **${date}**: ${count} confirmed booking(s) sa ${courts} active courts. Hindi ibig sabihin puno na lahat — depende sa oras at court. Sabihin ang sport at oras para mas specific ang sagot.`;
  }

  if (
    /\b(magkano|how\s+much|hm\b|presyo|gagastos|aabutin|magkano\s+aabutin)\b/i.test(lower) ||
    (/\b(rate|price|total)\b/i.test(lower) && /\?/.test(m))
  ) {
    const quote = buildPricingQuote(m, knowledge, dateOverrides);
    if (quote) return formatQuoteReply(quote, knowledge);
  }

  if (
    /\b(add|dagdag|idagdag)\b/i.test(lower) &&
    /\b(add.?on|addon|racket|raket|ball|bola)\b/i.test(lower) &&
    /\b(badminton|basketball|volleyball|pickleball|billiard|tennis|table)\b/i.test(lower)
  ) {
    const quote = buildPricingQuote(m, knowledge, dateOverrides);
    if (quote?.addon_labels?.length) {
      return (
        `Add-on estimate para sa **${quote.sport}**:\n` +
        quote.addon_labels.map((a) => `• ${a.label}: ₱${a.amount.toLocaleString()}`).join('\n') +
        `\n\nIdagdag ito sa court fee kapag nag-book. Sabihin: "Book ${quote.sport} … with racket" para ma-include sa total.`
      );
    }
  }

  return null;
}
