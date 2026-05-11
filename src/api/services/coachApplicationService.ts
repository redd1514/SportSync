import { createHash } from 'crypto';
import { supabase } from './supabaseClient.ts';

function toStableUuid(input: string): string {
  const hex = createHash('sha256').update(input).digest('hex').slice(0, 32);
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolveApplicantUserId(raw: string | undefined): Promise<string | null> {
  if (!raw || raw === 'guest') return null;
  if (isUuid(raw)) {
    const byId = await supabase.from('users').select('id').eq('id', raw).maybeSingle();
    if (byId.data?.id) return byId.data.id;
  }
  const authId = isUuid(raw) ? raw : toStableUuid(raw);
  const byAuth = await supabase.from('users').select('id').eq('auth_id', authId).maybeSingle();
  return byAuth.data?.id ?? null;
}

export type CoachApplicationRow = {
  id: string;
  applicant_user_id: string | null;
  user_name: string;
  user_email: string;
  sport: string;
  experience: string;
  bio: string;
  availability: string[];
  requested_rate: number;
  certifications: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
};

export type CoachApplicationPayload = {
  userId?: string;
  userName: string;
  userEmail: string;
  sport: string;
  experience?: string;
  bio: string;
  availability: string[];
  requestedRate: number;
  certifications?: string;
};

function rowToClient(row: CoachApplicationRow) {
  return {
    id: row.id,
    userId: row.applicant_user_id || '',
    userName: row.user_name,
    userEmail: row.user_email,
    sport: row.sport,
    experience: row.experience || '',
    bio: row.bio || '',
    availability: Array.isArray(row.availability) ? row.availability : [],
    requestedRate: Number(row.requested_rate) || 0,
    certifications: row.certifications || '',
    status: row.status,
    submittedAt: row.submitted_at,
  };
}

export const coachApplicationService = {
  async list(): Promise<ReturnType<typeof rowToClient>[]> {
    const { data, error } = await supabase
      .from('coach_applications')
      .select('*')
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((r: CoachApplicationRow) => rowToClient(r));
  },

  async create(input: CoachApplicationPayload) {
    const applicant_user_id = await resolveApplicantUserId(input.userId);
    const { data, error } = await supabase
      .from('coach_applications')
      .insert([
        {
          applicant_user_id,
          user_name: String(input.userName || '').trim(),
          user_email: String(input.userEmail || '').trim(),
          sport: String(input.sport || '').trim(),
          experience: String(input.experience || ''),
          bio: String(input.bio || ''),
          availability: Array.isArray(input.availability) ? input.availability : [],
          requested_rate: Number(input.requestedRate) || 0,
          certifications: String(input.certifications || ''),
          status: 'pending',
        },
      ])
      .select('*')
      .single();
    if (error) throw error;
    return rowToClient(data as CoachApplicationRow);
  },

  async updateStatus(id: string, status: 'pending' | 'approved' | 'rejected') {
    const { data, error } = await supabase
      .from('coach_applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('Application not found');
    return rowToClient(data as CoachApplicationRow);
  },
};
