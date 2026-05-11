/** Human-readable ticket reference for QR and verify tab */
export function genRefCode(): string {
  return `JRC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Normalize scanner / paste input so verify matches typed ref codes.
 * Supports: plain JRC-xxx, JSON legacy payloads, ?ref= URLs, UUID booking ids.
 */
export function normalizeTicketScanInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (UUID_RE.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  const refParam = trimmed.match(/[?&]ref=([^&\s#]+)/i);
  if (refParam?.[1]) {
    try {
      return decodeURIComponent(refParam[1]).trim().toUpperCase();
    } catch {
      return refParam[1].trim().toUpperCase();
    }
  }

  if (trimmed.startsWith('{') && trimmed.includes('"ref"')) {
    try {
      const parsed = JSON.parse(trimmed) as { ref?: string };
      if (parsed?.ref && typeof parsed.ref === 'string') {
        return parsed.ref.trim().toUpperCase();
      }
    } catch {
      /* ignore */
    }
  }

  return trimmed.toUpperCase();
}

export function isUuidString(s: string): boolean {
  return UUID_RE.test(s.trim());
}
