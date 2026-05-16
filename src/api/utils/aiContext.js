/**
 * SportSync AI knowledge layer — direct PostgreSQL reads via `pg`.
 * Requires DATABASE_URL (Supabase: Project Settings → Database → Connection string URI).
 */
import pg from 'pg';

const { Pool } = pg;

const SYSTEM_SETTINGS_KV_KEY = 'system_settings_v1';

/** Default rates when hourly_rates rows and KV settings are missing. */
const DEFAULT_COURT_RATES = {
  basketball: { weekdayDay: 450, weekdayEvening: 750, weekendDay: 550, weekendEvening: 850 },
  volleyball: { weekdayDay: 450, weekdayEvening: 750, weekendDay: 550, weekendEvening: 850 },
  badminton: { flat: 300 },
  pickleball: { flat: 300 },
  billiards: { flat: 100 },
  tableTennis: { flat: 100 },
};

/** @type {pg.Pool | null} */
let _pool = null;

/**
 * @returns {pg.Pool}
 */
export function getPgPool() {
  const conn = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
  if (!conn) {
    throw new Error(
      'DATABASE_URL (or SUPABASE_DB_URL) is not set. Add your Postgres connection string to .env for AI context queries.',
    );
  }
  if (!_pool) {
    _pool = new Pool({
      connectionString: conn,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return _pool;
}

/** Today in Asia/Manila as YYYY-MM-DD. */
export function manilaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(date);
}

/** @param {string} dateKey YYYY-MM-DD @param {number} days */
export function addManilaDays(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
  return manilaDateKey(anchor);
}

/** Map DB sport display name → system_settings courtRates key. */
export function sportKeyFromName(sportName) {
  const s = String(sportName || '').trim().toLowerCase();
  if (s === 'table tennis') return 'tableTennis';
  if (s === 'basketball') return 'basketball';
  if (s === 'volleyball') return 'volleyball';
  if (s === 'badminton') return 'badminton';
  if (s === 'pickleball') return 'pickleball';
  if (s === 'billiards') return 'billiards';
  return s.replace(/\s+/g, '');
}

/** 0=Sun … 6=Sat for a Manila calendar date. */
export function manilaDayOfWeek(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 4, 0, 0)).getUTCDay();
}

export function calcCourtPriceFromSettings(courtRates, sportName, dateStr, time24) {
  const sportKey = sportKeyFromName(sportName);
  const dayOfWeek = manilaDayOfWeek(dateStr);
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const hour = parseInt(String(time24 || '12:00').split(':')[0], 10);
  const isEvening = hour >= 18;

  const rates = courtRates?.[sportKey];
  if (!rates || typeof rates !== 'object') {
    if (sportKey === 'basketball' || sportKey === 'volleyball') {
      return isWeekend ? (isEvening ? 850 : 550) : (isEvening ? 750 : 450);
    }
    if (sportKey === 'badminton' || sportKey === 'pickleball') return 300;
    return 100;
  }

  if ('flat' in rates && rates.flat != null) return Number(rates.flat);

  const r = rates;
  if (isWeekend) return Number(isEvening ? r.weekendEvening : r.weekendDay);
  return Number(isEvening ? r.weekdayEvening : r.weekdayDay);
}

/**
 * @param {pg.Pool} pool
 */
export async function fetchSystemCourtRates(pool) {
  try {
    const res = await pool.query(
      `SELECT value FROM app_kv_store WHERE key = $1 LIMIT 1`,
      [SYSTEM_SETTINGS_KV_KEY],
    );
    const value = res.rows[0]?.value;
    if (value && typeof value === 'object' && value.courtRates) {
      return { courtRates: value.courtRates, businessHours: value.businessHours ?? null, source: 'app_kv_store' };
    }
  } catch (e) {
    console.warn('[aiContext] could not load system_settings_v1:', e?.message || e);
  }
  return { courtRates: DEFAULT_COURT_RATES, businessHours: { start: '06:00', end: '23:00' }, source: 'defaults' };
}

/**
 * Active courts LEFT JOIN hourly_rates (aggregated per court).
 * @param {pg.Pool} pool
 */
export async function fetchActiveCourtsWithRates(pool) {
  const res = await pool.query(
    `
    SELECT c.id::text AS court_id,
           c.name AS court_name,
           s.name AS sport_name,
           COALESCE(
             json_agg(
               json_build_object(
                 'day_type', hr.day_type,
                 'rate_per_hour', hr.rate_per_hour::text,
                 'start_time', hr.start_time::text,
                 'end_time', hr.end_time::text
               )
               ORDER BY hr.day_type, hr.start_time
             ) FILTER (WHERE hr.id IS NOT NULL),
             '[]'::json
           ) AS hourly_rates
    FROM courts c
    INNER JOIN sports s ON s.id = c.sport_id
    LEFT JOIN hourly_rates hr ON hr.court_id = c.id AND hr.is_active = true
    WHERE c.is_active = true
    GROUP BY c.id, c.name, s.name
    ORDER BY s.name, c.name
    `,
  );

  return res.rows.map((row) => {
    const hourlyRates = Array.isArray(row.hourly_rates)
      ? row.hourly_rates
      : typeof row.hourly_rates === 'string'
        ? JSON.parse(row.hourly_rates)
        : [];
    return {
      court_id: String(row.court_id),
      court_name: row.court_name,
      sport_name: row.sport_name,
      hourly_rates: hourlyRates,
      rates: hourlyRates,
    };
  });
}

/**
 * Confirmed / checked-in bookings for one calendar date (Manila YYYY-MM-DD).
 * @param {pg.Pool} pool
 * @param {string} bookingDate
 */
export async function fetchConfirmedBookingsForDate(pool, bookingDate) {
  const res = await pool.query(
    `
    SELECT b.id::text,
           c.name AS court_name,
           s.name AS sport_name,
           b.booking_date::text,
           b.start_time::text,
           b.end_time::text,
           b.status
    FROM bookings b
    INNER JOIN courts c ON c.id = b.court_id
    INNER JOIN sports s ON s.id = c.sport_id
    WHERE b.booking_date = $1::date
      AND b.status IN ('confirmed', 'checked_in')
    ORDER BY c.name, b.start_time
    `,
    [bookingDate],
  );
  return res.rows;
}

/** @deprecated use fetchConfirmedBookingsForDate */
export async function fetchTodaysConfirmedBookings(pool, bookingDate) {
  return fetchConfirmedBookingsForDate(pool, bookingDate);
}

/**
 * @param {Record<string, unknown>} courtRates
 * @param {string[]} sportNames
 */
export function buildPricingBySport(courtRates, sportNames) {
  const unique = [...new Set(sportNames.map((s) => String(s).trim()).filter(Boolean))];
  return unique.map((sport_name) => {
    const sportKey = sportKeyFromName(sport_name);
    const rates = courtRates?.[sportKey];
    if (rates && typeof rates === 'object' && 'flat' in rates) {
      return {
        sport_name,
        sport_key: sportKey,
        pricing_type: 'flat',
        rate_per_hour_php: Number(rates.flat),
      };
    }
    const r = rates && typeof rates === 'object' ? rates : DEFAULT_COURT_RATES[sportKey] ?? null;
    return {
      sport_name,
      sport_key: sportKey,
      pricing_type: 'tiered',
      weekday_day_php: r ? Number(r.weekdayDay) : null,
      weekday_evening_php: r ? Number(r.weekdayEvening) : null,
      weekend_day_php: r ? Number(r.weekendDay) : null,
      weekend_evening_php: r ? Number(r.weekendEvening) : null,
      evening_starts_at: '18:00',
      note: 'Evening = start time 6:00 PM or later. Weekend = Saturday/Sunday.',
    };
  });
}

function resolveRatePerHourForSlot(court, courtRates, dateStr, time24) {
  const dbRates = Array.isArray(court.hourly_rates) ? court.hourly_rates : [];
  if (dbRates.length > 0) {
    const first = dbRates[0];
    const n = Number(first.rate_per_hour);
    if (!Number.isNaN(n) && n > 0) return { rate: n, source: 'hourly_rates' };
  }
  return {
    rate: calcCourtPriceFromSettings(courtRates, court.sport_name, dateStr, time24),
    source: 'system_settings',
  };
}

/**
 * @param {Array<{ court_name: string, sport_name: string, hourly_rates?: unknown[] }>} courts
 * @param {Record<string, unknown>} courtRates
 * @param {string} dateStr
 * @param {string} time24
 */
export function enrichCourtsWithRatesForSlot(courts, courtRates, dateStr, time24) {
  return courts.map((c) => {
    const { rate, source } = resolveRatePerHourForSlot(c, courtRates, dateStr, time24);
    const hourly_rates =
      Array.isArray(c.hourly_rates) && c.hourly_rates.length > 0
        ? c.hourly_rates
        : [
            {
              day_type: 'facility_default',
              rate_per_hour: String(rate),
              source,
            },
          ];
    return {
      court_id: c.court_id,
      court_name: c.court_name,
      sport_name: c.sport_name,
      hourly_rates,
      rate_per_hour_php: rate,
      rate_source: source,
    };
  });
}

function toMinutesOfDay(timeStr) {
  const part = String(timeStr || '00:00').slice(0, 5);
  const [h, m] = part.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Bookings that overlap a requested start time (1-hour slot assumption for chat). */
export function filterBookingsOverlappingTime(bookings, time24, durationMinutes = 60) {
  const start = toMinutesOfDay(time24);
  const end = start + durationMinutes;
  return bookings.filter((b) => {
    const bStart = toMinutesOfDay(b.start_time);
    const bEnd = toMinutesOfDay(b.end_time);
    return start < bEnd && end > bStart;
  });
}

/**
 * @param {pg.Pool} [pool]
 * @param {{ requestedDate: string, requestedTime?: string | null }} opts
 */
export async function buildSportSyncAiKnowledge(pool, opts) {
  const p = pool ?? getPgPool();
  const today = manilaDateKey();
  const requestedDate = opts.requestedDate ?? today;
  const requestedTime = opts.requestedTime ?? '12:00';

  const [{ courtRates, businessHours, source }, courtsRaw, existingBookingsRaw] = await Promise.all([
    fetchSystemCourtRates(p),
    fetchActiveCourtsWithRates(p),
    fetchConfirmedBookingsForDate(p, requestedDate),
  ]);

  const existingBookings = Array.isArray(existingBookingsRaw) ? existingBookingsRaw : [];
  const courts = enrichCourtsWithRatesForSlot(courtsRaw, courtRates, requestedDate, requestedTime);
  const sportNames = courts.map((c) => c.sport_name);
  const pricingBySport = buildPricingBySport(courtRates, sportNames);

  const overlappingAtRequestedTime = requestedTime
    ? filterBookingsOverlappingTime(existingBookings, requestedTime)
    : existingBookings;

  return {
    generatedAt: new Date().toISOString(),
    timezone: 'Asia/Manila',
    today,
    requestedDate,
    requestedTime,
    businessHours,
    pricingSource: source,
    pricingBySport,
    courts,
    /** Primary availability list for Gemini — empty array means no conflicts on file for that date. */
    existingBookings,
    bookingsOnRequestedDateCount: existingBookings.length,
    bookingsOverlappingRequestedTime: overlappingAtRequestedTime,
    availabilityRule:
      'If a specific court and time slot is NOT listed in existingBookings (no overlapping start_time–end_time), the court is AVAILABLE for that slot.',
  };
}
