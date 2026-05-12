import { createHash } from 'crypto';
import { supabase } from './supabaseClient.ts';

export function toStableUuid(input: string): string {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function findUserRow(id: string) {
  const byId = await supabase.from('users').select('*').eq('id', id).maybeSingle();
  if (byId.data) return byId.data;

  const byAuthId = await supabase.from('users').select('*').eq('auth_id', id).maybeSingle();
  if (byAuthId.data) return byAuthId.data;

  if (!isUuid(id)) {
    const synthetic = toStableUuid(id);
    const bySynthetic = await supabase.from('users').select('*').eq('auth_id', synthetic).maybeSingle();
    if (bySynthetic.data) return bySynthetic.data;
  }

  return null;
}
