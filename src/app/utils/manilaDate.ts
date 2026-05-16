export const MANILA_TIMEZONE = 'Asia/Manila';

export function getManilaDateKey(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: MANILA_TIMEZONE }).format(date);
}

export function getManilaDateKeyFromValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'string') {
    const normalized = value.trim();
    // If the string is exactly YYYY-MM-DD, return it directly.
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized;
    }
    // Otherwise, attempt to parse full ISO/timestamp and convert to Manila date key.
    try {
      const parsed = new Date(normalized);
      if (!Number.isNaN(parsed.getTime())) return getManilaDateKey(parsed);
    } catch {}
  }

  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return '';
  return getManilaDateKey(parsed);
}

export function isManilaDateBefore(value: unknown, compareKey: string = getManilaDateKey()): boolean {
  const key = getManilaDateKeyFromValue(value);
  return key ? key < compareKey : false;
}

export function formatManilaDateLabel(value: unknown): string {
  const key = getManilaDateKeyFromValue(value);
  if (!key) return String(value ?? '');

  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TIMEZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
