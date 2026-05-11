import { supabase } from './supabaseClient.ts';

const ALLOWED_KEYS = new Set([
  'coaching_requests',
  'facility_maps_v2',
  'sport_addons_v1',
  'system_settings_v1',
]);

export const appKvService = {
  allowedKeys: ALLOWED_KEYS,

  isAllowed(key: string): boolean {
    return ALLOWED_KEYS.has(key);
  },

  async get<T = unknown>(key: string): Promise<T | null> {
    if (!this.isAllowed(key)) throw new Error('Invalid app data key');
    const { data, error } = await supabase.from('app_kv_store').select('value').eq('key', key).maybeSingle();
    if (error) throw error;
    if (!data?.value) return null;
    return data.value as T;
  },

  async set(key: string, value: unknown): Promise<void> {
    if (!this.isAllowed(key)) throw new Error('Invalid app data key');
    const { error } = await supabase.from('app_kv_store').upsert(
      { key, value: value as object, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );
    if (error) throw error;
  },
};
