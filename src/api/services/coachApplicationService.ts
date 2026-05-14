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
  photo_url?: string | null;
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
  photoUrl?: string | null;
  photo_url?: string | null;
  applicationType?: 'new' | 'change_request' | 'removal_request';
  requestDetails?: string;
};

function packCertifications(
  text: string,
  meta?: { photoUrl?: string | null; applicationType?: string; requestDetails?: string },
): string {
  if (!meta?.photoUrl && !meta?.applicationType && !meta?.requestDetails) return text;
  return JSON.stringify({
    text,
    photoUrl: meta?.photoUrl || '',
    applicationType: meta?.applicationType || 'new',
    requestDetails: meta?.requestDetails || '',
  });
}

function unpackCertifications(raw: string | undefined | null): {
  text: string;
  photoUrl: string;
  applicationType: 'new' | 'change_request' | 'removal_request';
  requestDetails: string;
} {
  const value = String(raw || '');
  try {
    const parsed = JSON.parse(value) as {
      text?: unknown;
      photoUrl?: unknown;
      applicationType?: unknown;
      requestDetails?: unknown;
    };
    if (parsed && typeof parsed === 'object') {
      const rawType = String(parsed.applicationType || 'new');
      return {
        text: typeof parsed.text === 'string' ? parsed.text : '',
        photoUrl: typeof parsed.photoUrl === 'string' ? parsed.photoUrl : '',
        applicationType:
          rawType === 'change_request' || rawType === 'removal_request'
            ? rawType
            : 'new',
        requestDetails: typeof parsed.requestDetails === 'string' ? parsed.requestDetails : '',
      };
    }
  } catch {
    /* plain legacy certifications text */
  }
  return { text: value, photoUrl: '', applicationType: 'new', requestDetails: '' };
}

function rowToClient(row: CoachApplicationRow) {
  const certs = unpackCertifications(row.certifications);
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
    certifications: certs.text,
    photoUrl: row.photo_url || certs.photoUrl || '',
    applicationType: certs.applicationType,
    requestDetails: certs.requestDetails,
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
    const photoUrl = input.photoUrl || input.photo_url || null;
    const applicationType = input.applicationType || 'new';

    if (applicationType === 'new') {
      const email = String(input.userEmail || '').trim();
      if (applicant_user_id || email) {
        let query = supabase
          .from('coach_applications')
          .select('id, certifications, status')
          .in('status', ['pending', 'approved']);
        if (applicant_user_id) query = query.eq('applicant_user_id', applicant_user_id);
        else query = query.ilike('user_email', email);
        const { data: existing, error: existingErr } = await query.limit(20);
        if (existingErr) throw existingErr;
        const duplicate = (existing || []).some((row: { certifications?: string | null }) =>
          unpackCertifications(row.certifications).applicationType === 'new',
        );
        if (duplicate) {
          throw new Error('You already have an active coach application. Please wait for admin review instead of submitting another one.');
        }
      }
    }

    const baseInsert = {
      applicant_user_id,
      user_name: String(input.userName || '').trim(),
      user_email: String(input.userEmail || '').trim(),
      sport: String(input.sport || '').trim(),
      experience: String(input.experience || ''),
      bio: String(input.bio || ''),
      availability: Array.isArray(input.availability) ? input.availability : [],
      requested_rate: Number(input.requestedRate) || 0,
      certifications: packCertifications(String(input.certifications || ''), {
        photoUrl,
        applicationType,
        requestDetails: input.requestDetails,
      }),
      status: 'pending' as const,
    };

    const { data, error } = await supabase
      .from('coach_applications')
      .insert([
        {
          ...baseInsert,
          photo_url: photoUrl,
        },
      ])
      .select('*')
      .single();
    if (error) {
      const missingPhotoColumn = String(error.message || '').toLowerCase().includes('photo_url');
      if (!missingPhotoColumn) throw error;
      const fallback = await supabase
        .from('coach_applications')
        .insert([baseInsert])
        .select('*')
        .single();
      if (fallback.error) throw fallback.error;
      return rowToClient(fallback.data as CoachApplicationRow);
    }
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
