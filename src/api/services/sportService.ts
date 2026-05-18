import { supabase } from './supabaseClient';

/** Insert or reactivate a sport by name so payment and coach flows can resolve it. */
export async function ensureSportByName(
  name: string,
  description?: string | null,
): Promise<{ id: string; name: string }> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Sport name is required');

  const { data: exact, error: exactErr } = await supabase
    .from('sports')
    .select('id, name, is_active')
    .eq('name', trimmed)
    .maybeSingle();
  if (exactErr) throw exactErr;
  if (exact?.id) {
    if (exact.is_active === false) {
      await supabase.from('sports').update({ is_active: true }).eq('id', exact.id);
    }
    return { id: exact.id, name: exact.name };
  }

  const { data: rows, error: listErr } = await supabase
    .from('sports')
    .select('id, name, is_active')
    .limit(300);
  if (listErr) throw listErr;

  const lower = trimmed.toLowerCase();
  const hit = rows?.find((s) => s.name?.toLowerCase() === lower);
  if (hit?.id) {
    if (hit.is_active === false) {
      await supabase.from('sports').update({ is_active: true }).eq('id', hit.id);
    }
    return { id: hit.id, name: hit.name };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('sports')
    .insert({
      name: trimmed,
      description: description?.trim() || `${trimmed} courts`,
      is_active: true,
    })
    .select('id, name')
    .single();
  if (insertErr) throw insertErr;
  return { id: inserted.id, name: inserted.name };
}
