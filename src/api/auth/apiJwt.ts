import { createHmac, timingSafeEqual } from 'crypto';

const DEMO_TYP = 'sportsync_demo';

function b64urlEncodeJson(obj: object): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function b64urlDecodeToString(s: string): string {
  return Buffer.from(s, 'base64url').toString('utf8');
}

export function signSportsyncDemoJwt(
  claims: { sub: string; email: string },
  secret: string,
  ttlSeconds = 7 * 24 * 60 * 60
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64urlEncodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = b64urlEncodeJson({
    typ: DEMO_TYP,
    sub: claims.sub,
    email: claims.email,
    iat: now,
    exp: now + ttlSeconds,
  });
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export function verifySportsyncDemoJwt(token: string, secret: string): { sub: string; email: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !secret) return null;
  const [h, p, s] = parts;
  const expected = createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  try {
    const sigBuf = Buffer.from(s, 'base64url');
    const expBuf = Buffer.from(expected, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null;
  } catch {
    return null;
  }
  let payload: { typ?: string; sub?: string; email?: string; exp?: number };
  try {
    payload = JSON.parse(b64urlDecodeToString(p)) as typeof payload;
  } catch {
    return null;
  }
  if (payload.typ !== DEMO_TYP || !payload.sub || !payload.email) return null;
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) return null;
  return { sub: String(payload.sub), email: String(payload.email) };
}
