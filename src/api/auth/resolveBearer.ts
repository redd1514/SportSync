import type { ApiAuthContext, AppRole, DbUserRole } from './types.ts';
import { verifySportsyncDemoJwt } from './apiJwt.ts';
import { supabase } from '../services/supabaseClient.ts';
import { findUserRow } from '../services/userRowQuery.ts';

function normalizeDbRole(r: string | undefined): DbUserRole {
  const x = String(r || 'user').toLowerCase();
  if (x === 'admin' || x === 'staff' || x === 'user') return x;
  return 'user';
}

async function deriveAppRole(userId: string, dbRole: DbUserRole): Promise<AppRole> {
  if (dbRole === 'admin') return 'admin';
  if (dbRole === 'staff') return 'staff';
  const { data } = await supabase.from('coaches').select('id').eq('user_id', userId).maybeSingle();
  if (data?.id) return 'coach';
  return 'user';
}

async function buildContextFromUserRow(row: Record<string, any>, supabaseAuthUserId?: string): Promise<ApiAuthContext> {
  const userId = String(row.id);
  const email = String(row.email || '');
  const dbRole = normalizeDbRole(row.role);
  const appRole = await deriveAppRole(userId, dbRole);
  return { userId, email, dbRole, appRole, supabaseAuthUserId };
}

export function isUserRowSuspended(row: Record<string, any> | null | undefined): boolean {
  if (!row) return false;
  if (row.is_active === false) return true;

  const status = String(row.account_status ?? row.accountStatus ?? row.status ?? '').trim().toLowerCase();
  return status === 'suspended' || status === 'inactive';
}

export async function resolveBearerUserRow(authHeader: string | undefined): Promise<Record<string, any> | null> {
  const m = authHeader?.match(/^Bearer\s+(.+)$/i);
  const raw = m?.[1]?.trim();
  if (!raw) return null;

  const secret = getJwtSecret();
  if (secret && raw.split('.').length === 3) {
    const demo = verifySportsyncDemoJwt(raw, secret);
    if (demo) {
      return (await findUserRow(demo.sub)) as Record<string, any> | null;
    }
  }

  const { data, error } = await supabase.auth.getUser(raw);
  if (error || !data.user) return null;

  const authUid = data.user.id;
  const { data: rowByAuthId } = await supabase.from('users').select('*').eq('auth_id', authUid).maybeSingle();
  if (rowByAuthId) return rowByAuthId as Record<string, any>;

  const { data: rowById } = await supabase.from('users').select('*').eq('id', authUid).maybeSingle();
  if (rowById) return rowById as Record<string, any>;

  return null;
}

export function getJwtSecret(): string {
  return String(process.env.SPORTSYNC_API_JWT_SECRET || '').trim();
}

export async function resolveBearer(authHeader: string | undefined): Promise<ApiAuthContext | null> {
  const row = await resolveBearerUserRow(authHeader);
  if (!row || isUserRowSuspended(row)) return null;

  const authUid = String(row.auth_id || row.id || '');
  return buildContextFromUserRow(row, authUid || undefined);
}
