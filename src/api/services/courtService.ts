import { supabase } from './supabaseClient';
import { ensureSportByName } from './sportService.ts';

type CourtRow = { id: string; name: string; sport_id?: string };

async function defaultFacilityId(): Promise<string> {
  const { data: facility, error } = await supabase
    .from('facility_config')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (facility?.id) return facility.id as string;

  const { data: created, error: insertErr } = await supabase
    .from('facility_config')
    .insert({ facility_name: 'JRC Ballpark', timezone: 'Asia/Manila' })
    .select('id')
    .single();
  if (insertErr) throw insertErr;
  return created.id as string;
}

function sportNameFromRow(row: {
  sports?: { name?: string } | { name?: string }[] | null;
}): string {
  const sports = row.sports;
  if (Array.isArray(sports)) return String(sports[0]?.name || '');
  return String(sports?.name || '');
}

async function findCourtByNameAndSport(
  courtName: string,
  sportId: string,
): Promise<CourtRow | undefined> {
  const name = courtName.trim();
  const { data: rows, error } = await supabase
    .from('courts')
    .select('id, name, sport_id, sports!inner(name)')
    .ilike('name', name)
    .eq('sport_id', sportId);
  if (error) throw error;
  if (rows?.length === 1) return rows[0] as CourtRow;
  if ((rows?.length || 0) > 1) {
    throw new Error(`Multiple courts named "${name}" for this sport. Rename courts in the facility map.`);
  }

  const numMatch = name.match(/^(.+?)\s+(\d+)$/i);
  if (!numMatch) return undefined;

  const fuzzyName = `${numMatch[1].trim()} ${numMatch[2]}`;
  const { data: fuzzy, error: fuzzyErr } = await supabase
    .from('courts')
    .select('id, name, sport_id, sports!inner(name)')
    .ilike('name', fuzzyName)
    .eq('sport_id', sportId);
  if (fuzzyErr) throw fuzzyErr;
  return (fuzzy || [])[0] as CourtRow | undefined;
}

/** Ensure a court row exists for facility-map / checkout names (e.g. "Squash 1"). */
export async function ensureCourtByName(
  courtName: string,
  sportName: string,
): Promise<{ id: string; name: string }> {
  const name = courtName.trim();
  const sportLabel = sportName.trim();
  if (!name) throw new Error('Court name is required');
  if (!sportLabel) throw new Error('Sport name is required');

  const sport = await ensureSportByName(sportLabel);
  const existing = await findCourtByNameAndSport(name, sport.id);
  if (existing?.id) {
    if (existing.name !== name) {
      await supabase.from('courts').update({ name, is_active: true }).eq('id', existing.id);
    }
    return { id: existing.id, name };
  }

  const facilityId = await defaultFacilityId();
  const { data: inserted, error: insertErr } = await supabase
    .from('courts')
    .insert({
      facility_id: facilityId,
      name,
      sport_id: sport.id,
      capacity: 10,
      is_active: true,
    })
    .select('id, name')
    .single();
  if (insertErr) throw insertErr;
  return { id: inserted.id, name: inserted.name };
}

/** Resolve court id for checkout; creates the court row when missing. */
export async function resolveCourtId(courtName: string, sportName: string): Promise<string> {
  const name = courtName.trim();
  const sport = sportName.trim();

  const { data: rows, error } = await supabase
    .from('courts')
    .select('id, name, sports!inner(name)')
    .ilike('name', name);
  if (error) throw error;

  if (rows?.length === 1) {
    const rowSport = sportNameFromRow(rows[0]);
    if (!sport || rowSport.toLowerCase() === sport.toLowerCase()) {
      return rows[0].id as string;
    }
  }

  if ((rows?.length || 0) > 1 && sport) {
    const bySport = rows!.find((r) => sportNameFromRow(r).toLowerCase() === sport.toLowerCase());
    if (bySport?.id) return bySport.id as string;
    throw new Error(`Multiple courts named "${name}" — specify sport.`);
  }

  if ((rows?.length || 0) > 1) {
    return rows![0].id as string;
  }

  const ensured = await ensureCourtByName(name, sport || sportNameFromRow(rows?.[0] || {}) || 'General');
  return ensured.id;
}
