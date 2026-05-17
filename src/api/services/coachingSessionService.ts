import { supabase } from './supabaseClient.ts';
import { resolveUserRowId } from './bookingService.ts';
import { emitRealtimeEvent } from '../middleware/realtimeMiddleware.ts';
import { RealtimeEventEmitter } from './realtimeEventEmitter.ts';

function defaultEndTimeFromStart(start: string): string {
  const parts = String(start || '09:00:00').split(':').map((p) => parseInt(p, 10));
  const h = parts[0] ?? 9;
  const m = parts[1] ?? 0;
  const s = parts[2] ?? 0;
  const nh = (h + 1) % 24;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(nh)}:${pad(m)}:${pad(s)}`;
}

function addHoursToTime(start: string, hours: number): string {
  const parts = String(start || '09:00:00').split(':').map((p) => parseInt(p, 10));
  const h = Number.isFinite(parts[0]) ? parts[0] : 9;
  const m = Number.isFinite(parts[1]) ? parts[1] : 0;
  const s = Number.isFinite(parts[2]) ? parts[2] : 0;
  const totalSeconds = h * 3600 + m * 60 + s + Math.round(Math.max(1, hours || 1) * 3600);
  const wrapped = ((totalSeconds % 86400) + 86400) % 86400;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(wrapped / 3600))}:${pad(Math.floor((wrapped % 3600) / 60))}:${pad(wrapped % 60)}`;
}

function durationHoursFromTimes(start?: string | null, end?: string | null): number | undefined {
  const parse = (value?: string | null) => {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
    if (!match) return undefined;
    return Number(match[1]) * 60 + Number(match[2]);
  };
  const startMin = parse(start);
  const endMin = parse(end);
  if (startMin == null || endMin == null || endMin <= startMin) return undefined;
  return (endMin - startMin) / 60;
}

/** DB has `notes` only — store proof URL + linked booking id in notes (same shape as updateSessionStatus). */
function notesFromProofAndLinked(paymentProofUrl?: string, linkedBookingId?: string): string | undefined {
  const parts: string[] = [];
  if (paymentProofUrl) parts.push(String(paymentProofUrl).trim());
  if (linkedBookingId) parts.push(`linked_booking:${String(linkedBookingId).trim()}`);
  return parts.length > 0 ? parts.join('\n') : undefined;
}

function linkedBookingIdFromNotes(notes?: string | null): string | undefined {
  const match = String(notes || '').match(/linked_booking:([0-9a-f-]+)/i);
  return match?.[1];
}

function isValidUuid(value: string | undefined | null): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function parseLatestRescheduleProposal(adminNotes?: string | null): {
  requestedDate: string;
  requestedTime: string;
  requestedEndTime?: string;
  reason?: string;
} | null {
  const matches = [...String(adminNotes || '').matchAll(/COACHING_RESCHEDULE_PROPOSED:(\{.*?\})(?=\n[A-Z_]+:|$)/gs)];
  const latest = matches[matches.length - 1]?.[1];
  if (!latest) return null;
  try {
    const parsed = JSON.parse(latest) as Record<string, unknown>;
    const requestedDate = typeof parsed.requestedDate === 'string' ? parsed.requestedDate : '';
    const requestedTime = typeof parsed.requestedTime === 'string' ? parsed.requestedTime : '';
    if (!requestedDate || !requestedTime) return null;
    return {
      requestedDate,
      requestedTime,
      requestedEndTime: typeof parsed.requestedEndTime === 'string' ? parsed.requestedEndTime : undefined,
      reason: typeof parsed.reason === 'string' ? parsed.reason : undefined,
    };
  } catch {
    return null;
  }
}

async function notifyUser(userId: string | undefined, eventType: string, title: string, message: string, extra?: Record<string, unknown>) {
  if (!userId) return;
  await RealtimeEventEmitter.notifyUser(userId, eventType, {
    title,
    message,
    type: eventType.includes('rejected') ? 'alert' : 'update',
    ...extra,
  });
}

export type CoachingSessionPayload = {
  coach_id: string;
  user_id: string;
  sport_id?: string;
  session_date: string;
  start_time: string;
  end_time?: string;
  duration_hours?: number;
  status?: 'pending' | 'pending_verification' | 'confirmed' | 'approved' | 'rejected' | 'cancelled' | 'completed';
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
  if (viewerEmail === 'user@jrc.com') return [];

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
    const requestedStatus = String(input.status || 'pending');
    const dbStatus =
      requestedStatus === 'confirmed' || requestedStatus === 'approved' || requestedStatus === 'completed'
        ? 'approved'
        : requestedStatus === 'cancelled'
          ? 'cancelled'
          : requestedStatus === 'rejected'
            ? 'rejected'
            : 'pending';

    if (input.linked_booking_id) {
      const linked = String(input.linked_booking_id).trim();
      const { data: existingLinked, error: linkedErr } = await supabase
        .from('coaching_sessions')
        .select('*')
        .ilike('notes', `%linked_booking:${linked}%`)
        .limit(1);
      if (linkedErr) throw linkedErr;
      if (existingLinked?.[0]) {
        if (dbStatus === 'approved' && existingLinked[0].status !== 'approved') {
          const { data: updated, error: updateErr } = await supabase
            .from('coaching_sessions')
            .update({ status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', existingLinked[0].id)
            .select('*')
            .single();
          if (updateErr) throw updateErr;
          return updated as CoachingSessionRow;
        }
        return existingLinked[0] as CoachingSessionRow;
      }
    }

    const { data: activePending, error: pendingErr } = await supabase
      .from('coaching_sessions')
      .select('id')
      .eq('user_id', user_id)
      .eq('coach_id', coach_id)
      .eq('status', 'pending')
      .limit(1);
    if (pendingErr) throw pendingErr;
    if ((activePending || []).length > 0) {
      throw new Error('You already have a pending request with this coach. Please wait for the coach to accept or decline before requesting them again.');
    }

    const { data: coachRow, error: coachErr } = await supabase
      .from('coaches')
      .select('id')
      .eq('id', coach_id)
      .maybeSingle();
    if (coachErr) throw coachErr;
    if (!coachRow?.id) {
      throw new Error(`Invalid coach_id: no coach row for ${coach_id}`);
    }

    const inputEndTime = input.end_time && String(input.end_time).trim();
    const end_time =
      inputEndTime && inputEndTime !== 'undefined'
        ? inputEndTime
        : input.duration_hours && Number(input.duration_hours) > 0
          ? addHoursToTime(input.start_time, Number(input.duration_hours))
          : defaultEndTimeFromStart(input.start_time);

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
      status: dbStatus,
    };
    if (notes) insertRow.notes = notes;

    const { data, error } = await supabase.from('coaching_sessions').insert([insertRow]).select('*').single();

    if (error) throw error;
    
    // Emit realtime event
    await emitRealtimeEvent('coaching_sessions', 'INSERT', data);

    const { data: coachOwnerRow } = await supabase
      .from('coaches')
      .select('user_id')
      .eq('id', coach_id)
      .maybeSingle();
    await notifyUser(
      coachOwnerRow?.user_id,
      'coaching_request_created',
      dbStatus === 'approved' ? 'New paid coaching session' : 'New coaching request',
      dbStatus === 'approved'
        ? 'A student paid the downpayment for an available coaching slot. The session is already accepted; request a reschedule only if you cannot attend.'
        : 'A student requested a coaching session. Open My Coaching to review the details.',
      { sessionId: data.id, studentId: user_id, sessionDate: input.session_date, startTime: input.start_time, status: dbStatus },
    );
    
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
    if (typeof update.start_time === 'string' && update.end_time === undefined) {
      const preservedDuration = durationHoursFromTimes(oldData?.start_time, oldData?.end_time) || 1;
      update.end_time = addHoursToTime(String(update.start_time), preservedDuration);
    }
    const { data, error } = await supabase.from('coaching_sessions').update(update).eq('id', id).select('*').single();

    if (error) throw error;
    
    // Emit realtime event
    await emitRealtimeEvent('coaching_sessions', 'UPDATE', data, oldData);

    const nextStatus = typeof update.status === 'string' ? String(update.status) : undefined;
    if (nextStatus === 'approved' || nextStatus === 'confirmed') {
      await notifyUser(
        data?.user_id,
        'coaching_request_approved',
        'Coach accepted your session',
        'Your coach accepted your reserved coaching booking. Open My Coaching to view your ticket.',
        { sessionId: data.id, status: nextStatus },
      );
    } else if (nextStatus === 'rejected') {
      await notifyUser(
        data?.user_id,
        'coaching_request_rejected',
        'Coach declined your session',
        'Your coaching request was declined. You can request another coach or choose a different time.',
        { sessionId: data.id, status: nextStatus },
      );
    }
    
    return data as CoachingSessionRow;
  },

  async updateSessionStatus(
    id: string,
    status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'approved' | 'completed',
    adminNotes?: string,
    staffId?: string,
  ): Promise<CoachingSessionRow> {
    // Map UI status → DB status
    // DB only knows: pending | approved | rejected | cancelled
    const dbStatus =
      status === 'confirmed' || status === 'approved' || status === 'completed'
        ? 'approved'
        : status === 'cancelled'
          ? 'cancelled'
          : status === 'rejected'
            ? 'rejected'
            : 'pending';

    let nextAdminNotes = adminNotes;
    if (status === 'completed' && !/COACHING_CHECKED_OUT|checked_out:/i.test(String(nextAdminNotes || ''))) {
      nextAdminNotes = `${nextAdminNotes || ''}\nCOACHING_CHECKED_OUT\nchecked_out:${new Date().toISOString()}`.trim();
    }

    const update: Record<string, unknown> = { status: dbStatus, updated_at: new Date().toISOString() };
    const acceptedReschedule = /COACHING_RESCHEDULE_ACCEPTED/i.test(String(nextAdminNotes || ''));
    const acceptedProposal = acceptedReschedule ? parseLatestRescheduleProposal(nextAdminNotes) : null;
    const { data: oldData } = await supabase.from('coaching_sessions').select('*').eq('id', id).single();
    if (acceptedProposal) {
      const preservedDuration =
        durationHoursFromTimes(oldData?.start_time, oldData?.end_time) ||
        1;
      update.session_date = acceptedProposal.requestedDate;
      update.start_time = acceptedProposal.requestedTime;
      update.end_time = acceptedProposal.requestedEndTime || addHoursToTime(acceptedProposal.requestedTime, preservedDuration);
    }
    if (nextAdminNotes !== undefined) update.admin_notes = nextAdminNotes;
    
    const { data, error } = await supabase
      .from('coaching_sessions')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    
    if (error) throw error;
    
    // Emit realtime event
    await emitRealtimeEvent('coaching_sessions', 'UPDATE', data, oldData);

    const linkedBookingId = linkedBookingIdFromNotes(data?.notes || oldData?.notes);
    const checkedIn = /COACHING_CHECKED_IN|checked_in:/i.test(String(nextAdminNotes || data?.admin_notes || ''));
    const rescheduleRequested = /COACHING_RESCHEDULE_(REQUESTED|PROPOSED)/i.test(String(nextAdminNotes || data?.admin_notes || ''));
    if (dbStatus === 'approved') {
      if (linkedBookingId) {
        const linkedStatus = status === 'completed'
          ? 'completed'
          : checkedIn
            ? 'checked_in'
            : 'confirmed';
        await supabase
          .from('bookings')
          .update({
            status: linkedStatus,
            ...(acceptedProposal ? {
              booking_date: acceptedProposal.requestedDate,
              start_time: acceptedProposal.requestedTime,
              end_time: String(update.end_time || acceptedProposal.requestedEndTime || oldData?.end_time || data?.end_time),
            } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', linkedBookingId)
          .in('status', ['pending', 'pending_payment', 'confirmed', 'pending_verification', 'checked_in', 'rescheduled']);
      }
      if (linkedBookingId && checkedIn && isValidUuid(staffId) && !/checked_in:/i.test(String(oldData?.admin_notes || ''))) {
        await supabase.from('staff_operations').insert({
          staff_id: staffId,
          booking_id: linkedBookingId,
          action: 'coaching_check_in',
          notes: `Coaching session checked in at ${new Date().toISOString()}`,
        });
      }
      if (rescheduleRequested && !/COACHING_RESCHEDULE_(REQUESTED|PROPOSED)/i.test(String(oldData?.admin_notes || ''))) {
        const { data: coachRow } = await supabase.from('coaches').select('user_id').eq('id', data?.coach_id).maybeSingle();
        if (linkedBookingId) {
          await supabase.from('staff_operations').insert({
            staff_id: isValidUuid(coachRow?.user_id) ? coachRow?.user_id : null,
            booking_id: linkedBookingId,
            action: 'coaching_reschedule_requested',
            notes: `Coach requested reschedule for coaching session ${data.id} at ${new Date().toISOString()}`,
          });
        }
        await notifyUser(
          data?.user_id,
          'coaching_reschedule_requested',
          'Coach requested a reschedule',
          'Your paid coaching ticket remains active. The front desk will help coordinate a new schedule or process the refund path if no suitable slot is available.',
          { sessionId: data.id, status: 'reschedule_requested', linkedBookingId, targetTab: 'coaching', targetSub: 'mycoaching' },
        );
        await notifyUser(
          coachRow?.user_id,
          'coaching_reschedule_requested_coach',
          'Reschedule request sent',
          'The student and front desk were notified. Keep the ticket active until staff confirms a new slot or refund handling.',
          { sessionId: data.id, status: 'reschedule_requested', linkedBookingId, targetTab: 'coaching', targetSub: 'mycoaching' },
        );
      }
      if (acceptedReschedule && !/COACHING_RESCHEDULE_ACCEPTED/i.test(String(oldData?.admin_notes || ''))) {
        const { data: coachRow } = await supabase.from('coaches').select('user_id').eq('id', data?.coach_id).maybeSingle();
        await notifyUser(
          coachRow?.user_id,
          'coaching_reschedule_accepted_coach',
          'Student accepted the new schedule',
          'The coaching ticket and linked booking have been moved to the proposed schedule.',
          { sessionId: data.id, status: 'confirmed', linkedBookingId, targetTab: 'coaching', targetSub: 'mycoaching' },
        );
      }
      if (oldData?.status !== 'approved') {
        const { data: coachRow } = await supabase.from('coaches').select('name, user_id').eq('id', data?.coach_id).maybeSingle();
        const facility = linkedBookingId ? await supabase
          .from('bookings')
          .select('courts(name)')
          .eq('id', linkedBookingId)
          .maybeSingle() : null;
        const facilityName = (facility as any)?.data?.courts?.name || 'the reserved facility';
        await notifyUser(
          data?.user_id,
          'coaching_request_approved',
          'Coaching booking confirmed',
          `Your downpayment confirmed the coaching session at ${facilityName}. Please present your ticket and settle the remaining balance at the front desk before check-in.`,
          { sessionId: data.id, status: dbStatus, linkedBookingId, targetTab: 'coaching', targetSub: 'mycoaching' },
        );
        await notifyUser(
          coachRow?.user_id,
          'coaching_request_approved_coach',
          'Paid coaching session confirmed',
          `A student paid the downpayment for your available slot at ${facilityName}. Request a reschedule only if you cannot attend.`,
          { sessionId: data.id, status: dbStatus, linkedBookingId, targetTab: 'coaching', targetSub: 'mycoaching' },
        );
      }
      if (status === 'completed') {
        const { data: coachRow } = await supabase.from('coaches').select('user_id').eq('id', data?.coach_id).maybeSingle();
        await notifyUser(
          data?.user_id,
          'coaching_session_completed',
          'Coaching session completed',
          'Your coaching session has been checked out by the front desk. You can now rate your coach.',
          { sessionId: data.id, status: 'completed', linkedBookingId, targetTab: 'coaching', targetSub: 'mycoaching' },
        );
        await notifyUser(
          coachRow?.user_id,
          'coaching_session_completed_coach',
          'Coaching session completed',
          'Front desk marked your coaching session as completed. Any student review will appear in My Coaching.',
          { sessionId: data.id, status: 'completed', linkedBookingId, targetTab: 'coaching', targetSub: 'mycoaching' },
        );
        if (linkedBookingId && isValidUuid(staffId)) {
          await supabase.from('staff_operations').insert({
            staff_id: staffId,
            booking_id: linkedBookingId,
            action: 'coaching_check_out',
            notes: `Coaching session checked out at ${new Date().toISOString()}`,
          });
        }
      }
    } else if (dbStatus === 'rejected' || dbStatus === 'cancelled') {
      if (linkedBookingId) {
        await supabase
          .from('bookings')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', linkedBookingId)
          .in('status', ['pending', 'confirmed', 'pending_verification']);
      }
      await notifyUser(
        data?.user_id,
        'coaching_request_rejected',
        dbStatus === 'cancelled' ? 'Coaching session cancelled' : 'Coach declined your session',
        dbStatus === 'cancelled'
          ? 'Your coaching session was cancelled.'
          : 'Your coaching request was declined. The linked court reservation was released.',
        { sessionId: data.id, status: dbStatus, linkedBookingId, targetTab: 'coaching', targetSub: 'mycoaching' },
      );
    }
    
    return data as CoachingSessionRow;
  },

  async submitReview(id: string, userId: string, rating: number, comment?: string): Promise<CoachingSessionRow> {
    const reviewer_id = await resolveUserRowId(String(userId));
    const { data: session, error: sErr } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (sErr) throw sErr;
    if (!session) throw new Error('Coaching session not found');
    if (String(session.user_id) !== reviewer_id) throw new Error('Only the student can review this coach.');
    if (!/COACHING_CHECKED_OUT|checked_out:/i.test(String(session.admin_notes || ''))) {
      throw new Error('Reviews open after front desk checkout.');
    }
    const cleanRating = Math.max(1, Math.min(5, Math.round(Number(rating || 0))));
    const linkedBookingId = linkedBookingIdFromNotes(session.notes);
    await supabase.from('reviews').insert({
      reviewer_id,
      coach_id: session.coach_id,
      booking_id: linkedBookingId || null,
      rating: cleanRating,
      comment: String(comment || '').trim() || null,
    });
    const reviewedAt = new Date().toISOString();
    const reviewNote = `COACHING_REVIEW:${JSON.stringify({ rating: cleanRating, comment: String(comment || '').trim(), reviewedAt })}`;
    const adminNotes = `${session.admin_notes || ''}\n${reviewNote}`.trim();
    const { data, error } = await supabase
      .from('coaching_sessions')
      .update({ admin_notes: adminNotes, updated_at: reviewedAt })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;

    const { data: coachRow } = await supabase.from('coaches').select('user_id').eq('id', session.coach_id).maybeSingle();
    await notifyUser(
      coachRow?.user_id,
      'coaching_review_received',
      'New coaching review',
      `A student rated your coaching session ${cleanRating}/5.`,
      { sessionId: id, rating: cleanRating, targetTab: 'coaching', targetSub: 'mycoaching' },
    );

    await emitRealtimeEvent('coaching_sessions', 'UPDATE', data, session);
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
