import { supabase } from './supabaseClient.ts';
import { resolveUserRowId } from './bookingService.ts';
import { emitRealtimeEvent } from '../middleware/realtimeMiddleware.ts';

function defaultEndTimeFromStart(start: string): string {
  const parts = String(start || '09:00:00').split(':').map((p) => parseInt(p, 10));
  const h = parts[0] ?? 9;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  const nh = (h + 1) % 24;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(nh)}:${pad(m)}:${pad(s)}`;
}

/** DB has `notes` only — store proof URL + linked booking id in notes (same shape as updateSessionStatus). */
function notesFromProofAndLinked(paymentProofUrl?: string, linkedBookingId?: string): string | undefined {
  const parts: string[] = [];
  if (paymentProofUrl) parts.push(String(paymentProofUrl).trim());
  if (linkedBookingId) parts.push(`linked_booking:${String(linkedBookingId).trim()}`);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

export type CoachingSessionPayload = {
  coach_id: string;
  user_id: string;
  sport_id?: string;
  session_date: string;
  start_time: string;
  end_time?: string;
  duration_hours?: number;
  status?: 'pending' | 'pending_verification' | 'confirmed' | 'rejected';
  payment_proof_url?: string;
  linked_booking_id?: string;
};

export type CoachingSessionRow = CoachingSessionPayload & {
  id: string;
  created_at: string;
  updated_at?: string;
};

/**
 * Coach profile row ids for this viewer: `coaches.user_id = usersTableId`, or the coach's
 * linked `users.email` matches the viewer's email (covers mismatched `user_id` vs demo sync).
 */
export async function listCoachProfileIdsForViewer(usersTableId: string): Promise<string[]> {
  const { data: viewerUser, error: vuErr } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', usersTableId)
    .maybeSingle();
  if (vuErr) throw vuErr;

  const viewerEmail = (viewerUser?.email || '').trim().toLowerCase();

  const { data: coachRows, error: cErr } = await supabase.from('coaches').select('id, user_id, users(email)');
  if (cErr) throw cErr;

  const ids = new Set<string>();
  for (const raw of coachRows || []) {
    const row = raw as {
      id: string;
      user_id: string;
      users?: { email?: string } | { email?: string }[] | null;
    };
    if (!row?.id) continue;

    if (String(row.user_id) === String(usersTableId)) {
      ids.add(row.id);
      continue;
    }

    if (viewerEmail) {
      const u = row.users;
      const coachUserEmail = (Array.isArray(u) ? u[0]?.email : u?.email) || '';
      if (coachUserEmail && viewerEmail === String(coachUserEmail).trim().toLowerCase()) {
        ids.add(row.id);
      }
    }
  }

  return Array.from(ids);
}

export const coachingSessionService = {
  async listSessions(): Promise<CoachingSessionRow[]> {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select('*')
      .order('session_date', { ascending: false });
    
    if (error) throw error;
    return (data || []) as CoachingSessionRow[];
  },

  async getSessionsByUserId(userId: string): Promise<CoachingSessionRow[]> {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('session_date', { ascending: false });
    
    if (error) throw error;
    return (data || []) as CoachingSessionRow[];
  },

  async getSessionsByCoachId(coachId: string): Promise<CoachingSessionRow[]> {
    const { data, error } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('coach_id', coachId)
      .order('session_date', { ascending: false });
    
    if (error) throw error;
    return (data || []) as CoachingSessionRow[];
  },

  /** Sessions where this user is the student OR owns the coach profile for the session. */
  async listSessionsForParticipant(usersTableId: string): Promise<CoachingSessionRow[]> {
    const coachIds = await listCoachProfileIdsForViewer(usersTableId);

    const { data: asStudent, error: e1 } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('user_id', usersTableId)
      .order('session_date', { ascending: false });
    if (e1) throw e1;

    let asCoach: CoachingSessionRow[] = [];
    if (coachIds.length > 0) {
      const { data: coachSessions, error: e2 } = await supabase
        .from('coaching_sessions')
        .select('*')
        .in('coach_id', coachIds)
        .order('session_date', { ascending: false });
      if (e2) throw e2;
      asCoach = (coachSessions || []) as CoachingSessionRow[];
    }

    const byId = new Map<string, CoachingSessionRow>();
    for (const r of asStudent || []) byId.set(r.id, r as CoachingSessionRow);
    for (const r of asCoach) byId.set(r.id, r);
    return Array.from(byId.values()).sort((a, b) =>
      String(b.session_date || '').localeCompare(String(a.session_date || ''))
    );
  },

  async createSession(input: CoachingSessionPayload): Promise<CoachingSessionRow> {
    const user_id = await resolveUserRowId(String(input.user_id));
    const coach_id = String(input.coach_id).trim();

    const { data: coachRow, error: coachErr } = await supabase
      .from('coaches')
      .select('id')
      .eq('id', coach_id)
      .maybeSingle();
    if (coachErr) throw coachErr;
    if (!coachRow?.id) {
      throw new Error(`Invalid coach_id: no coach row for ${coach_id}`);
    }

    const end_time = (input.end_time && String(input.end_time).trim()) || defaultEndTimeFromStart(input.start_time);

    // If sport_id is not provided, get it from coach_specializations
    let sportId = input.sport_id;

    if (!sportId && coach_id) {
      const { data: specs, error: specError } = await supabase
        .from('coach_specializations')
        .select('sport_id')
        .eq('coach_id', coach_id)
        .limit(1);

      if (!specError && specs && specs.length > 0) {
        sportId = specs[0].sport_id;
      } else {
        const { data: sports, error: sportsError } = await supabase
          .from('sports')
          .select('id')
          .limit(1);

        if (!sportsError && sports && sports.length > 0) {
          sportId = sports[0].id;
        } else {
          throw new Error('No sport found for coach');
        }
      }
    }

    const notes = notesFromProofAndLinked(input.payment_proof_url, input.linked_booking_id);
    const insertRow: Record<string, unknown> = {
      user_id,
      coach_id,
      sport_id: sportId,
      session_date: input.session_date,
      start_time: input.start_time,
      end_time,
      status: input.status || 'pending',
    };
    if (notes) insertRow.notes = notes;

    const { data, error } = await supabase.from('coaching_sessions').insert([insertRow]).select('*').single();

    if (error) throw error;
    
    // Emit realtime event
    await emitRealtimeEvent('coaching_sessions', 'INSERT', data);
    
    return data as CoachingSessionRow;
  },

  async updateSession(id: string, input: Partial<CoachingSessionPayload>): Promise<CoachingSessionRow> {
    const { payment_proof_url, linked_booking_id, duration_hours: _ignoreGenerated, ...rest } = input;

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    const keys: (keyof Pick<
      CoachingSessionPayload,
      'coach_id' | 'user_id' | 'sport_id' | 'session_date' | 'start_time' | 'end_time' | 'status'
    >)[] = ['coach_id', 'user_id', 'sport_id', 'session_date', 'start_time', 'end_time', 'status'];
    for (const k of keys) {
      if (rest[k] !== undefined) update[k] = rest[k];
    }

    const extraNotes = notesFromProofAndLinked(payment_proof_url, linked_booking_id);
    if (extraNotes) update.notes = extraNotes;

    const { data: oldData } = await supabase.from('coaching_sessions').select('*').eq('id', id).single();
    const { data, error } = await supabase.from('coaching_sessions').update(update).eq('id', id).select('*').single();

    if (error) throw error;
    
    // Emit realtime event
    await emitRealtimeEvent('coaching_sessions', 'UPDATE', data, oldData);
    
    return data as CoachingSessionRow;
  },

  async updateSessionStatus(
    id: string,
    status: 'pending' | 'pending_verification' | 'confirmed' | 'rejected' | 'cancelled' | 'approved' | 'scheduled' | 'completed',
    paymentProofUrl?: string,
    linkedBookingId?: string
  ): Promise<CoachingSessionRow> {
    const dbStatus =
      status === 'confirmed'
        ? 'approved'
        : status === 'pending_verification'
          ? 'pending'
          : status === 'cancelled'
            ? 'cancelled'
            : status === 'rejected'
              ? 'rejected'
              : status === 'approved' || status === 'scheduled' || status === 'completed' || status === 'pending'
                ? status
                : 'pending';
    const update: Record<string, unknown> = { status: dbStatus, updated_at: new Date().toISOString() };
    const n = notesFromProofAndLinked(paymentProofUrl, linkedBookingId);
    if (n) update.notes = n;
    
    const { data: oldData } = await supabase.from('coaching_sessions').select('*').eq('id', id).single();
    const { data, error } = await supabase
      .from('coaching_sessions')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) throw error;
    
    // Emit realtime event
    await emitRealtimeEvent('coaching_sessions', 'UPDATE', data, oldData);
    
    return data as CoachingSessionRow;
  },

  async deleteSession(id: string): Promise<void> {
    const { data: deletedData } = await supabase.from('coaching_sessions').select('*').eq('id', id).single();
    const { error } = await supabase
      .from('coaching_sessions')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    // Emit realtime event
    if (deletedData) {
      await emitRealtimeEvent('coaching_sessions', 'DELETE', deletedData);
    }
  },
};
