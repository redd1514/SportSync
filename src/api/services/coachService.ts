import { createHash } from 'crypto';
import { supabase } from './supabaseClient';
import { ensureSportByName } from './sportService.ts';

function toStableUuid(input: string): string {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

export type CoachHubPayload = {
  id: string;
  name: string;
  email?: string;
  sport: string;
  hourlyRate: number;
  description: string;
  availableDays: string[];
  timeRange: string;
  isAvailable: boolean;
  image?: string;
};

type CoachMeta = { availableDays: string[]; timeRange: string };

function parseCoachMeta(raw: string | null | undefined): CoachMeta {
  if (!raw || typeof raw !== 'string') return { availableDays: [], timeRange: '' };
  try {
    const j = JSON.parse(raw) as Partial<CoachMeta>;
    if (j && typeof j === 'object') {
      return {
        availableDays: Array.isArray(j.availableDays) ? j.availableDays : [],
        timeRange: typeof j.timeRange === 'string' ? j.timeRange : '',
      };
    }
  } catch {
    /* legacy plain text stored in certification_details */
  }
  return { availableDays: [], timeRange: '' };
}

function buildMetaJson(availableDays: string[], timeRange: string): string {
  return JSON.stringify({ availableDays: availableDays ?? [], timeRange: timeRange ?? '' });
}

async function resolveSportId(sportName: string): Promise<string> {
  const sport = await ensureSportByName(sportName);
  return sport.id;
}

async function findOrCreateCoachUser(params: {
  fullName: string;
  email?: string | null;
}): Promise<{ id: string; email: string }> {
  const slug = params.fullName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '')
    .slice(0, 40) || 'coach';
  const email =
    (params.email && String(params.email).trim()) ||
    `coach.${slug}.${Date.now()}@sportsync.app`;

  const { data: existing } = await supabase.from('users').select('id, email').eq('email', email).maybeSingle();
  if (existing?.id) return { id: existing.id, email: existing.email };

  const authId = toStableUuid(`coach-user:${email.toLowerCase()}`);
  const { data: inserted, error } = await supabase
    .from('users')
    .insert([
      {
        auth_id: authId,
        email,
        full_name: params.fullName,
        role: 'user',
        phone: null,
      },
    ])
    .select('id, email')
    .single();

  if (error) throw error;
  return { id: inserted.id, email: inserted.email };
}

function mapRowToHubPayload(row: any): CoachHubPayload {
  const rawU = row.users;
  const u = Array.isArray(rawU) ? rawU[0] || {} : rawU || {};
  const specs = Array.isArray(row.coach_specializations) ? row.coach_specializations : [];
  const firstSpec = specs[0];
  const sp = firstSpec?.sports;
  const sportRow = Array.isArray(sp) ? sp[0] : sp;
  const sportName = sportRow?.name || 'Sports';

  const meta = parseCoachMeta(row.certification_details);

  return {
    id: row.id,
    name: u.full_name || 'Coach',
    email: u.email || undefined,
    sport: sportName,
    hourlyRate: Number(row.hourly_rate) || 0,
    description: row.bio || '',
    availableDays: meta.availableDays,
    timeRange: meta.timeRange,
    isAvailable: row.is_available !== false,
    image: u.profile_picture_url || undefined,
  };
}

export const coachService = {
  async listCoaches(): Promise<CoachHubPayload[]> {
    const { data, error } = await supabase
      .from('coaches')
      .select(
        `
        id,
        bio,
        certification_details,
        hourly_rate,
        is_available,
        rating,
        review_count,
        users ( full_name, email, profile_picture_url ),
        coach_specializations ( sport_id, sports ( name ) )
      `
      )
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRowToHubPayload);
  },

  async createCoach(input: Omit<CoachHubPayload, 'id'>): Promise<CoachHubPayload> {
    const sportId = await resolveSportId(input.sport);
    const { id: userId, email } = await findOrCreateCoachUser({
      fullName: input.name,
      email: input.email,
    });

    const { data: existingCoach } = await supabase.from('coaches').select('id, is_available').eq('user_id', userId).maybeSingle();
    if (existingCoach?.id) {
      const metaJson = buildMetaJson(input.availableDays || [], input.timeRange || '');
      const { error: coachUpdateErr } = await supabase
        .from('coaches')
        .update({
          bio: input.description || '',
          certification_details: metaJson,
          hourly_rate: input.hourlyRate,
          is_available: input.isAvailable !== false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCoach.id);
      if (coachUpdateErr) throw coachUpdateErr;

      await supabase.from('coach_specializations').delete().eq('coach_id', existingCoach.id);
      const { error: specUpdateErr } = await supabase.from('coach_specializations').insert([
        { coach_id: existingCoach.id, sport_id: sportId, experience_years: 0 },
      ]);
      if (specUpdateErr) throw specUpdateErr;

      const userPatch: Record<string, unknown> = {
        full_name: input.name,
        email,
        role: 'user',
        updated_at: new Date().toISOString(),
      };
      if (input.image) userPatch.profile_picture_url = input.image;
      const { error: userUpdateErr } = await supabase.from('users').update(userPatch).eq('id', userId);
      if (userUpdateErr) throw userUpdateErr;

      const { data: hydrated, error: hErr } = await supabase
        .from('coaches')
        .select(
          `
          id,
          bio,
          certification_details,
          hourly_rate,
          is_available,
          rating,
          review_count,
          users ( full_name, email, profile_picture_url ),
          coach_specializations ( sport_id, sports ( name ) )
        `
        )
        .eq('id', existingCoach.id)
        .single();
      if (hErr) throw hErr;
      return mapRowToHubPayload(hydrated);
    }

    const metaJson = buildMetaJson(input.availableDays || [], input.timeRange || '');
    const { data: coachRow, error: coachErr } = await supabase
      .from('coaches')
      .insert([
        {
          user_id: userId,
          bio: input.description || '',
          certification_details: metaJson,
          hourly_rate: input.hourlyRate,
          is_available: input.isAvailable !== false,
        },
      ])
      .select('id')
      .single();

    if (coachErr) throw coachErr;

    const { error: specErr } = await supabase.from('coach_specializations').insert([
      {
        coach_id: coachRow.id,
        sport_id: sportId,
        experience_years: 0,
      },
    ]);

    if (specErr) {
      await supabase.from('coaches').delete().eq('id', coachRow.id);
      throw specErr;
    }

    const userPatch: Record<string, unknown> = { role: 'user', updated_at: new Date().toISOString() };
    if (input.image) userPatch.profile_picture_url = input.image;
    const { error: userPatchErr } = await supabase.from('users').update(userPatch).eq('id', userId);
    if (userPatchErr) throw userPatchErr;

    const { data: hydrated, error: hErr } = await supabase
      .from('coaches')
      .select(
        `
        id,
        bio,
        certification_details,
        hourly_rate,
        is_available,
        rating,
        review_count,
        users ( full_name, email, profile_picture_url ),
        coach_specializations ( sport_id, sports ( name ) )
      `
      )
      .eq('id', coachRow.id)
      .single();

    if (hErr) throw hErr;
    return mapRowToHubPayload(hydrated);
  },

  async updateCoach(id: string, input: Partial<Omit<CoachHubPayload, 'id'>>): Promise<CoachHubPayload> {
    const { data: existing, error: exErr } = await supabase
      .from('coaches')
      .select(
        `
        id,
        user_id,
        bio,
        certification_details,
        hourly_rate,
        is_available,
        users ( full_name, email, profile_picture_url ),
        coach_specializations ( sport_id, sports ( name ) )
      `
      )
      .eq('id', id)
      .maybeSingle();

    if (exErr) throw exErr;
    if (!existing) throw new Error('Coach not found');

    const prevMeta = parseCoachMeta(existing.certification_details);
    const metaJson = buildMetaJson(
      input.availableDays ?? prevMeta.availableDays,
      input.timeRange ?? prevMeta.timeRange
    );

    const patch: Record<string, unknown> = {
      certification_details: metaJson,
    };
    if (input.description !== undefined) patch.bio = input.description;
    if (input.hourlyRate !== undefined) patch.hourly_rate = input.hourlyRate;
    if (input.isAvailable !== undefined) patch.is_available = input.isAvailable;

    const { error: upErr } = await supabase.from('coaches').update(patch).eq('id', id);
    if (upErr) throw upErr;

    if (input.name !== undefined || input.email !== undefined || input.image !== undefined) {
      const uPatch: Record<string, unknown> = {};
      if (input.name !== undefined) uPatch.full_name = input.name;
      if (input.email !== undefined) uPatch.email = String(input.email).trim();
      if (input.image !== undefined) uPatch.profile_picture_url = input.image || null;
      if (Object.keys(uPatch).length) {
        const { error: uErr } = await supabase.from('users').update(uPatch).eq('id', existing.user_id);
        if (uErr) throw uErr;
      }
    }

    if (input.sport !== undefined) {
      const sportId = await resolveSportId(input.sport);
      await supabase.from('coach_specializations').delete().eq('coach_id', id);
      const { error: sErr } = await supabase.from('coach_specializations').insert([
        { coach_id: id, sport_id: sportId, experience_years: 0 },
      ]);
      if (sErr) throw sErr;
    }

    const { data: hydrated, error: hErr } = await supabase
      .from('coaches')
      .select(
        `
        id,
        bio,
        certification_details,
        hourly_rate,
        is_available,
        rating,
        review_count,
        users ( full_name, email, profile_picture_url ),
        coach_specializations ( sport_id, sports ( name ) )
      `
      )
      .eq('id', id)
      .single();

    if (hErr) throw hErr;
    return mapRowToHubPayload(hydrated);
  },

  async deleteCoach(id: string): Promise<void> {
    const { data: existing, error: existingErr } = await supabase
      .from('coaches')
      .select('user_id, users ( email )')
      .eq('id', id)
      .single();

    if (existingErr) throw existingErr;

    const { count, error: cErr } = await supabase
      .from('coaching_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', id);

    if (cErr) throw cErr;

    if ((count ?? 0) > 0) {
      const { error } = await supabase.from('coaches').update({ is_available: false }).eq('id', id);
      if (error) throw error;
      if ((existing as any)?.user_id) {
        const { error: userErr } = await supabase
          .from('users')
          .update({ role: 'user', updated_at: new Date().toISOString() })
          .eq('id', (existing as any).user_id)
          .eq('role', 'coach');
        if (userErr) throw userErr;
      }
      return;
    }

    const { error } = await supabase.from('coaches').delete().eq('id', id);
    if (error) throw error;
    if ((existing as any)?.user_id) {
      const { error: userErr } = await supabase
        .from('users')
        .update({ role: 'user', updated_at: new Date().toISOString() })
        .eq('id', (existing as any).user_id)
        .eq('role', 'coach');
      if (userErr) throw userErr;
    }
  },
};
