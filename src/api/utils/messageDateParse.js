/**
 * Extract booking date/time intent from concierge chat (English + Tagalog/Taglish).
 * All calendar math uses Asia/Manila via helpers from aiContext.js.
 */
import { addManilaDays, manilaDateKey, manilaDayOfWeek } from './aiContext.js';

const TIMEZONE = 'Asia/Manila';

/** @returns {string} HH:mm (24h) */
export function normalizeTime24(raw) {
  if (!raw) return '12:00';
  const s = String(raw).trim().toLowerCase();
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = m12[2] ? parseInt(m12[2], 10) : 0;
    const ap = m12[3].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    return `${String(parseInt(m24[1], 10)).padStart(2, '0')}:${m24[2]}`;
  }
  const hOnly = s.match(/^(\d{1,2})\s*(pm|pm|am|am)$/i) || s.match(/^(\d{1,2})(pm|am)$/i);
  if (hOnly) {
    let h = parseInt(hOnly[1], 10);
    const ap = hOnly[2].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:00`;
  }
  return '12:00';
}

function parseIsoDateInText(text) {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (slash) {
    return `${slash[3]}-${String(slash[1]).padStart(2, '0')}-${String(slash[2]).padStart(2, '0')}`;
  }
  return null;
}

const MONTH_NAMES = {
  january: 1, jan: 1, enero: 1,
  february: 2, feb: 2, pebrero: 2,
  march: 3, mar: 3, marzo: 3,
  april: 4, apr: 4, abril: 4,
  may: 5, mayo: 5,
  june: 6, jun: 6, hunyo: 6,
  july: 7, jul: 7, hulyo: 7,
  august: 8, aug: 8, agosto: 8,
  september: 9, sep: 9, sept: 9, setyembre: 9,
  october: 10, oct: 10, oktubre: 10,
  november: 11, nov: 11, nobyembre: 11,
  december: 12, dec: 12, disyembre: 12,
};

function parseNamedMonthDay(text, todayKey) {
  const [y0, m0, d0] = todayKey.split('-').map(Number);
  const re = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec|enero|pebrero|marzo|abril|mayo|hunyo|hulyo|agosto|setyembre|oktubre|nobyembre|disyembre)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d{2}))?\b/i;
  const m = text.match(re);
  if (!m) return null;
  const month = MONTH_NAMES[m[1].toLowerCase()];
  if (!month) return null;
  const day = parseInt(m[2], 10);
  const year = m[3] ? parseInt(m[3], 10) : y0;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const WEEKDAY_OFFSET = {
  sunday: 0, sun: 0, linggo: 0,
  monday: 1, mon: 1, lunes: 1,
  tuesday: 2, tue: 2, tues: 2, martes: 2,
  wednesday: 3, wed: 3, miyerkules: 3, mierkules: 3,
  thursday: 4, thu: 4, thurs: 4, huwebes: 4,
  friday: 5, fri: 5, biyernes: 5, viernes: 5,
  saturday: 6, sat: 6, sabado: 6,
};

function nextWeekdayFrom(todayKey, targetDow) {
  const current = manilaDayOfWeek(todayKey);
  let delta = (targetDow - current + 7) % 7;
  if (delta === 0) delta = 7;
  return addManilaDays(todayKey, delta);
}

function parseWeekdayName(text, todayKey) {
  const lower = text.toLowerCase();
  for (const [name, dow] of Object.entries(WEEKDAY_OFFSET)) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(lower)) {
      return nextWeekdayFrom(todayKey, dow);
    }
  }
  return null;
}

function parseRelativeDate(text, todayKey) {
  const lower = text.toLowerCase();
  if (/\b(bukas|tomorrow|next day)\b/.test(lower)) return addManilaDays(todayKey, 1);
  if (/\b(yesterday|kahapon)\b/.test(lower)) return addManilaDays(todayKey, -1);
  if (/\b(today|ngayon|ngayong araw|ngayong gabi|this day|tonight)\b/.test(lower)) return todayKey;
  const inDays = lower.match(/\b(?:in|after)\s+(\d+)\s+days?\b/);
  if (inDays) return addManilaDays(todayKey, parseInt(inDays[1], 10));
  return null;
}

function parseTimeFromText(text) {
  const lower = text.toLowerCase();
  if (/\b(ngayong gabi|tonight|this evening|mamayang gabi)\b/.test(lower)) {
    return '19:00';
  }
  const patterns = [
    /\b(?:at|@|ng|alas[- ]?)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i,
    /\b(\d{1,2}):(\d{2})\b/,
    /\b(\d{1,2})\s*(pm|am)\b/i,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (m) {
      if (m[3] && !m[3].match(/am|pm/i) && m[2] && m[2].length === 2 && !m[4]) {
        return normalizeTime24(`${m[1]}:${m[2]}`);
      }
      const hour = m[1];
      const min = m[2] && m[2].length <= 2 ? m[2] : '00';
      const ap = m[3] || m[4] || '';
      return normalizeTime24(`${hour}:${min}${ap}`);
    }
  }
  return null;
}

/**
 * @param {string} message
 * @param {{ today?: string, explicitDate?: string, explicitTime?: string }} [overrides]
 * @returns {{ date: string, time: string | null, source: string }}
 */
export function extractDateAndTimeFromMessage(message, overrides = {}) {
  const today = overrides.today ?? manilaDateKey();
  const text = String(message || '');

  if (overrides.explicitDate && /^\d{4}-\d{2}-\d{2}$/.test(overrides.explicitDate)) {
    return {
      date: overrides.explicitDate,
      time: overrides.explicitTime ? normalizeTime24(overrides.explicitTime) : parseTimeFromText(text),
      source: 'request_body',
    };
  }

  let date =
    parseIsoDateInText(text) ||
    parseNamedMonthDay(text, today) ||
    parseRelativeDate(text, today) ||
    parseWeekdayName(text, today) ||
    null;

  let source = 'default_today';
  if (date) {
    source = 'message';
  } else {
    date = today;
  }

  const time = parseTimeFromText(text);
  return { date, time, source };
}
