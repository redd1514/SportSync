import { Hono } from 'hono';
import { supabase } from '../services/supabaseClient.ts';
import { listStaffOperationsRecent, refundLoyaltyRedemptionForUnstartedBooking } from '../services/deskBookingService.ts';
import { RealtimeEventEmitter } from '../services/realtimeEventEmitter.ts';

const staffRouter = new Hono();

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function sendUserNotification(bookingId: string, staffId: string, title: string, desc: string, type: 'update' | 'alert' = 'update') {
  try {
    const { data: b } = await supabase.from('bookings').select('user_id').eq('id', bookingId).maybeSingle();
    if (!b?.user_id) return;
    await RealtimeEventEmitter.notifyUser(String(b.user_id), 'front_desk_update', {
      title,
      message: desc,
      type,
      bookingId,
      staffId: isUuid(staffId) ? staffId : null,
    });
  } catch (e) {
    console.error('[sendUserNotification] error:', e);
  }
}

async function sendCoachingNotification(sessionId: string, title: string, desc: string, type: 'update' | 'alert' = 'update') {
  try {
    const { data: s } = await supabase.from('coaching_sessions').select('user_id, coach_id').eq('id', sessionId).maybeSingle();
    if (s?.user_id) {
      await RealtimeEventEmitter.notifyUser(String(s.user_id), 'coaching_front_desk_update', {
        title,
        message: desc,
        type,
        sessionId,
      });
    }
    if (s?.coach_id) {
      const { data: coach } = await supabase.from('coaches').select('user_id').eq('id', s.coach_id).maybeSingle();
      if (coach?.user_id) {
        await RealtimeEventEmitter.notifyUser(String(coach.user_id), 'coaching_front_desk_update', {
          title,
          message: desc,
          type,
          sessionId,
        });
      }
    }
  } catch (e) {
    console.error('[sendCoachingNotification] error:', e);
  }
}

async function syncLinkedCoachingSessionFromBooking(
  bookingId: string,
  update: { status?: 'approved' | 'cancelled'; sessionDate?: string; startTime?: string; endTime?: string; note: string },
) {
  const { data: sessions, error } = await supabase
    .from('coaching_sessions')
    .select('id, admin_notes')
    .ilike('notes', `%linked_booking:${bookingId}%`);
  if (error) throw error;

  for (const session of sessions || []) {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      admin_notes: `${(session as any).admin_notes || ''}\n${update.note}`.trim(),
    };
    if (update.status) patch.status = update.status;
    if (update.sessionDate) patch.session_date = update.sessionDate;
    if (update.startTime) patch.start_time = update.startTime;
    if (update.endTime) patch.end_time = update.endTime;

    const { error: updateErr } = await supabase
      .from('coaching_sessions')
      .update(patch)
      .eq('id', (session as any).id);
    if (updateErr) throw updateErr;
  }
}

async function countActionableBookingRequests() {
  const { data: reqRows } = await supabase
    .from('booking_requests')
    .select('id, booking_id')
    .eq('status', 'pending')
    .limit(500);
  const bookingIds = [...new Set((reqRows || []).map((r: any) => r.booking_id).filter(Boolean))];
  if (!bookingIds.length) return 0;
  const { data: bookRows } = await supabase
    .from('bookings')
    .select('id,status')
    .in('id', bookingIds)
    .in('status', ['confirmed', 'pending', 'pending_verification', 'rescheduled']);
  const active = new Set((bookRows || []).map((b: any) => b.id));
  return (reqRows || []).filter((r: any) => active.has(r.booking_id)).length;
}

/** KPIs for Live Operations + raw staff_operations rows for Activity tab */
staffRouter.get('/operations', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];

  try {
    const [{ data: payRows }, { data: bookRows }, pendingRequests, ops] = await Promise.all([
      supabase.from('payments').select('amount, created_at, completed_at').eq('status', 'completed').limit(800),
      supabase
        .from('bookings')
        .select('id')
        .eq('booking_date', date)
        .not('status', 'eq', 'cancelled'),
      countActionableBookingRequests(),
      listStaffOperationsRecent(100),
    ]);

    let revenue = 0;
    for (const p of payRows ?? []) {
      const ts =
        (p as { completed_at?: string }).completed_at ||
        (p as { created_at?: string }).created_at ||
        '';
      const day = ts.slice(0, 10);
      if (day === date) revenue += Number((p as { amount?: number }).amount ?? 0);
    }

    const bookingsCount = bookRows?.length ?? 0;
    return c.json({
      date,
      bookingsCount,
      revenue,
      activeCourts: null,
      pendingRequests,
      operations: ops,
    });
  } catch (e: any) {
    console.error('[staff/operations]', e?.message);
    return c.json({
      date,
      bookingsCount: 0,
      revenue: 0,
      activeCourts: null,
      pendingRequests: 0,
      operations: [],
    });
  }
});

// Pending booking change requests for Front Desk Inbox (cancel + reschedule)
staffRouter.get('/requests/pending', async (c) => {
  try {
    const { data: reqs, error: reqErr } = await supabase
      .from('booking_requests')
      .select('id, booking_id, reason, status, request_type, requested_new_date, requested_new_start_time, requested_new_end_time')
      .eq('status', 'pending')
      .limit(300);
    if (reqErr) throw reqErr;

    const bookingIds = [...new Set((reqs || []).map((r: any) => r.booking_id))].filter(Boolean);
    const bookingsMap: Record<string, any> = {};
    if (bookingIds.length) {
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, booking_date, start_time, end_time, court_id, user_id, status')
        .in('id', bookingIds);
      for (const b of bookings || []) bookingsMap[b.id] = b;
    }

    const userIds = [...new Set(Object.values(bookingsMap).map((b: any) => b.user_id))].filter(Boolean);
    const usersMap: Record<string, any> = {};
    if (userIds.length) {
      const { data: users } = await supabase.from('users').select('id, full_name, email').in('id', userIds);
      for (const u of users || []) usersMap[u.id] = u;
    }

    const courtIds = [...new Set(Object.values(bookingsMap).map((b: any) => b.court_id))].filter(Boolean);
    const courtsMap: Record<string, any> = {};
    if (courtIds.length) {
      const { data: courts } = await supabase.from('courts').select('id, name').in('id', courtIds);
      for (const ct of courts || []) courtsMap[ct.id] = ct;
    }

    const cancellations: any[] = [];
    const reschedules: any[] = [];

    for (const r of reqs || []) {
      const b = bookingsMap[r.booking_id];
      if (!b || ['cancelled', 'checked_in', 'completed', 'rejected'].includes(String(b.status || ''))) continue;
      const u = b ? usersMap[b.user_id] : null;
      const court = b ? courtsMap[b.court_id] : null;
      const base = {
        id: r.id,
        bookingId: r.booking_id,
        customerName: u?.full_name || u?.email || 'Customer',
        date: b?.booking_date || '',
        time: b?.start_time || '',
        endTime: b?.end_time || '',
        court: court?.name || b?.court_id || 'Court',
        reason: r.reason || '',
        status: r.status,
        requestType: r.request_type,
        requestedNewDate: r.requested_new_date || null,
        requestedNewStartTime: r.requested_new_start_time || null,
        requestedNewEndTime: r.requested_new_end_time || null,
        availabilityStatus: 'not_checked',
        availabilityMessage: '',
      };
      if (r.request_type === 'reschedule') {
        if (b?.court_id && r.requested_new_date && r.requested_new_start_time && r.requested_new_end_time) {
          const { data: conflicts } = await supabase
            .from('bookings')
            .select('id, start_time, end_time, status')
            .eq('court_id', b.court_id)
            .eq('booking_date', r.requested_new_date)
            .neq('id', r.booking_id)
            .in('status', ['confirmed', 'checked_in', 'pending', 'pending_verification', 'rescheduled']);
          const overlap = (conflicts || []).some((row: any) =>
            String(row.start_time) < String(r.requested_new_end_time) &&
            String(row.end_time) > String(r.requested_new_start_time),
          );
          base.availabilityStatus = overlap ? 'conflict' : 'available';
          base.availabilityMessage = overlap
            ? 'Requested slot conflicts with another booking on this court.'
            : 'Requested slot is available on this court.';
        } else if (r.request_type === 'reschedule') {
          base.availabilityStatus = 'incomplete';
          base.availabilityMessage = 'Requested schedule is incomplete.';
        }
        reschedules.push(base);
      }
      else cancellations.push(base);
    }

    const { data: coachingRows } = await supabase
      .from('coaching_sessions')
      .select('id, user_id, coach_id, session_date, start_time, end_time, status, admin_notes, notes')
      .eq('status', 'approved')
      .limit(300);

    const coachingUserIds = [...new Set((coachingRows || []).map((r: any) => r.user_id).filter(Boolean))];
    const coachingCoachIds = [...new Set((coachingRows || []).map((r: any) => r.coach_id).filter(Boolean))];
    const coachingUsers: Record<string, any> = {};
    const coachingCoaches: Record<string, any> = {};
    if (coachingUserIds.length) {
      const { data: users } = await supabase.from('users').select('id, full_name, email').in('id', coachingUserIds);
      for (const u of users || []) coachingUsers[u.id] = u;
    }
    if (coachingCoachIds.length) {
      const { data: coaches } = await supabase.from('coaches').select('id, name, sport').in('id', coachingCoachIds);
      for (const coach of coaches || []) coachingCoaches[coach.id] = coach;
    }
    const coaching = (coachingRows || [])
      .filter((row: any) => !/PAYMENT_VERIFIED|COACHING_CHECKED_IN|checked_in:/i.test(String(row.admin_notes || row.notes || '')))
      .map((row: any) => {
        const coach = coachingCoaches[row.coach_id];
        const student = coachingUsers[row.user_id];
        return {
          id: row.id,
          userName: student?.full_name || student?.email || 'Student',
          coachName: coach?.name || 'Coach',
          sport: coach?.sport || 'Sports',
          requestedDate: row.session_date,
          requestedTime: row.start_time,
          status: 'confirmed',
          isReal: true,
        };
      });

    return c.json({ cancellations, reschedules, coaching });
  } catch (e: any) {
    console.error('[staff/requests/pending]', e?.message);
    return c.json({ cancellations: [], reschedules: [], coaching: [] }, 200);
  }
});

staffRouter.put('/requests/:id/cancel/approve', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const staffId = String((body as any).staff_id || '').trim();

    const { data: br, error: brErr } = await supabase
      .from('booking_requests')
      .select('booking_id, request_type, status')
      .eq('id', id)
      .maybeSingle();
    if (brErr) throw brErr;
    if (!br) return c.json({ error: 'Request not found' }, 404);
    if (br.request_type !== 'cancellation') return c.json({ error: 'Not a cancellation request' }, 400);
    if (br.status !== 'pending') return c.json({ error: 'Request already processed' }, 400);

    await supabase
      .from('booking_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: isUuid(staffId) ? staffId : null,
      })
      .eq('id', id);

    if (br.booking_id) {
      await refundLoyaltyRedemptionForUnstartedBooking(br.booking_id);
      await supabase.from('bookings').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', br.booking_id);
      await syncLinkedCoachingSessionFromBooking(br.booking_id, {
        status: 'cancelled',
        note: `COACHING_LINKED_BOOKING_CANCELLED\nlinked_booking_cancelled:${new Date().toISOString()}`,
      });
      if (isUuid(staffId)) {
        await supabase.from('staff_operations').insert({
          staff_id: staffId,
          booking_id: br.booking_id,
          action: 'cancel_request_approved',
          notes: null,
        });
      }
      await sendUserNotification(br.booking_id, staffId, 'Cancellation Approved', 'Your booking cancellation request has been approved by the staff.');
      const { data: linkedSessions } = await supabase
        .from('coaching_sessions')
        .select('id')
        .ilike('notes', `%linked_booking:${br.booking_id}%`);
      await Promise.all((linkedSessions || []).map((session: any) =>
        sendCoachingNotification(
          session.id,
          'Coaching booking cancelled',
          'The linked court booking was cancelled. The coaching session has been cancelled as well.',
          'alert',
        )
      ));
    }

    return c.json({ success: true, id });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Approve failed' }, 400);
  }
});

staffRouter.put('/requests/:id/cancel/reject', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const staffId = String((body as any).staff_id || '').trim();
    const reason = String((body as any).reason || '').trim();

    const { data: br, error: brErr } = await supabase
      .from('booking_requests')
      .select('booking_id, request_type, status')
      .eq('id', id)
      .maybeSingle();
    if (brErr) throw brErr;
    if (!br) return c.json({ error: 'Request not found' }, 404);
    if (br.request_type !== 'cancellation') return c.json({ error: 'Not a cancellation request' }, 400);
    if (br.status !== 'pending') return c.json({ error: 'Request already processed' }, 400);

    await supabase
      .from('booking_requests')
      .update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        processed_by: isUuid(staffId) ? staffId : null,
      })
      .eq('id', id);

    if (br.booking_id && isUuid(staffId)) {
      await supabase.from('staff_operations').insert({
        staff_id: staffId,
        booking_id: br.booking_id,
        action: 'cancel_request_rejected',
        notes: reason || null,
      });
      await sendUserNotification(br.booking_id, staffId, 'Cancellation Declined', `Your cancellation request was declined. Reason: ${reason || 'Not specified'}`, 'alert');
    }

    return c.json({ success: true, id });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Reject failed' }, 400);
  }
});

staffRouter.put('/requests/:id/reschedule/approve', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const staffId = String((body as any).staff_id || '').trim();

    const { data: br, error: brErr } = await supabase
      .from('booking_requests')
      .select('booking_id, request_type, status, requested_new_date, requested_new_start_time, requested_new_end_time')
      .eq('id', id)
      .maybeSingle();
    if (brErr) throw brErr;
    if (!br) return c.json({ error: 'Request not found' }, 404);
    if (br.request_type !== 'reschedule') return c.json({ error: 'Not a reschedule request' }, 400);
    if (br.status !== 'pending') return c.json({ error: 'Request already processed' }, 400);
    if (!br.requested_new_date || !br.requested_new_start_time || !br.requested_new_end_time) {
      return c.json({ error: 'Requested schedule is incomplete.' }, 400);
    }
    const toMinutes = (value: string) => {
      const [h = '0', m = '0'] = String(value || '').slice(0, 5).split(':');
      return Number(h) * 60 + Number(m);
    };
    if (toMinutes(br.requested_new_start_time) < 7 * 60 || toMinutes(br.requested_new_end_time) > 23 * 60) {
      return c.json({ error: 'Requested schedule must fit within facility hours: 7:00 AM to 11:00 PM.' }, 400);
    }

    const { data: currentBooking, error: currentErr } = await supabase
      .from('bookings')
      .select('id,court_id,status')
      .eq('id', br.booking_id)
      .maybeSingle();
    if (currentErr) throw currentErr;
    if (!currentBooking) return c.json({ error: 'Booking not found' }, 404);

    const { data: conflicts, error: conflictErr } = await supabase
      .from('bookings')
      .select('id,start_time,end_time,status')
      .eq('court_id', currentBooking.court_id)
      .eq('booking_date', br.requested_new_date)
      .neq('id', br.booking_id)
      .in('status', ['confirmed', 'checked_in', 'pending', 'pending_verification', 'rescheduled']);
    if (conflictErr) throw conflictErr;

    const hasOverlap = (conflicts || []).some((row: any) =>
      String(row.start_time) < String(br.requested_new_end_time) &&
      String(row.end_time) > String(br.requested_new_start_time),
    );
    if (hasOverlap) {
      return c.json({ error: 'Requested time conflicts with another booking on the same court.' }, 409);
    }

    await supabase
      .from('booking_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        processed_by: isUuid(staffId) ? staffId : null,
      })
      .eq('id', id);

    if (br.booking_id) {
      await supabase
        .from('bookings')
        .update({
          booking_date: br.requested_new_date,
          start_time: br.requested_new_start_time,
          end_time: br.requested_new_end_time,
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', br.booking_id);
      await syncLinkedCoachingSessionFromBooking(br.booking_id, {
        status: 'approved',
        sessionDate: br.requested_new_date,
        startTime: br.requested_new_start_time,
        endTime: br.requested_new_end_time,
        note: `COACHING_LINKED_BOOKING_RESCHEDULED\nlinked_booking_rescheduled:${new Date().toISOString()}`,
      });

      if (isUuid(staffId)) {
        await supabase.from('staff_operations').insert({
          staff_id: staffId,
          booking_id: br.booking_id,
          action: 'reschedule_request_approved',
          notes: null,
        });
      }
      await sendUserNotification(br.booking_id, staffId, 'Reschedule Approved', `Your booking has been successfully rescheduled to ${br.requested_new_date} at ${br.requested_new_start_time}.`);
      const { data: linkedSessions } = await supabase
        .from('coaching_sessions')
        .select('id')
        .ilike('notes', `%linked_booking:${br.booking_id}%`);
      await Promise.all((linkedSessions || []).map((session: any) =>
        sendCoachingNotification(
          session.id,
          'Coaching booking rescheduled',
          `The linked coaching booking moved to ${br.requested_new_date} at ${br.requested_new_start_time}.`,
        )
      ));
    }

    return c.json({ success: true, id });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Approve failed' }, 400);
  }
});

staffRouter.put('/requests/:id/reschedule/reject', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const staffId = String((body as any).staff_id || '').trim();
    const reason = String((body as any).reason || '').trim();

    const { data: br, error: brErr } = await supabase
      .from('booking_requests')
      .select('booking_id, request_type, status')
      .eq('id', id)
      .maybeSingle();
    if (brErr) throw brErr;
    if (!br) return c.json({ error: 'Request not found' }, 404);
    if (br.request_type !== 'reschedule') return c.json({ error: 'Not a reschedule request' }, 400);
    if (br.status !== 'pending') return c.json({ error: 'Request already processed' }, 400);

    await supabase
      .from('booking_requests')
      .update({
        status: 'rejected',
        processed_at: new Date().toISOString(),
        processed_by: isUuid(staffId) ? staffId : null,
      })
      .eq('id', id);

    if (br.booking_id && isUuid(staffId)) {
      await supabase.from('staff_operations').insert({
        staff_id: staffId,
        booking_id: br.booking_id,
        action: 'reschedule_request_rejected',
        notes: reason || null,
      });
      await sendUserNotification(br.booking_id, staffId, 'Reschedule Declined', `Your reschedule request was declined. Reason: ${reason || 'Not specified'}`, 'alert');
    }

    return c.json({ success: true, id });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Reject failed' }, 400);
  }
});

staffRouter.put('/requests/:id/coaching/verify', async (c) => {
  try {
    const id = c.req.param('id');
    const { data: session, error: fetchErr } = await supabase
      .from('coaching_sessions')
      .select('id, status, admin_notes')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!session) return c.json({ error: 'Coaching session not found' }, 404);
    if (session.status !== 'approved') return c.json({ error: 'This coaching ticket is not ready for front desk check-in yet.' }, 400);

    const note = `${session.admin_notes || ''}\nPAYMENT_VERIFIED_MANUAL\nCOACHING_CHECKED_IN\nCoaching payment verified at the front desk before session check-in.`.trim();
    const { error } = await supabase
      .from('coaching_sessions')
      .update({ admin_notes: note, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    await sendCoachingNotification(
      id,
      'Coaching payment verified',
      'Front desk verified your manual coaching payment. Your coaching ticket is cleared for check-in.',
    );

    return c.json({ success: true, id });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Coaching verification failed' }, 400);
  }
});

staffRouter.put('/requests/:id/coaching/reject', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const reason = String((body as any).reason || '').trim();
    const { data: session, error: fetchErr } = await supabase
      .from('coaching_sessions')
      .select('id, status, admin_notes')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!session) return c.json({ error: 'Coaching session not found' }, 404);

    const note = `${session.admin_notes || ''}\nPAYMENT_REVIEW_REJECTED:${reason || 'Not specified'}`.trim();
    const { error } = await supabase
      .from('coaching_sessions')
      .update({ admin_notes: note, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;

    await sendCoachingNotification(
      id,
      'Coaching payment needs review',
      `Front desk could not verify the coaching payment. Reason: ${reason || 'Not specified'}`,
      'alert',
    );

    return c.json({ success: true, id });
  } catch (e: any) {
    return c.json({ error: e?.message || 'Coaching rejection failed' }, 400);
  }
});

export default staffRouter;
