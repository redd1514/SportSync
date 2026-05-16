/**
 * Enhanced API Hooks with Realtime Integration
 * Combines traditional API calls with real-time updates
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';
import { mergeBookingRows, normalizeBookingForDisplay } from '../utils/bookingDisplay';
import { cacheInvalidationManager } from '../utils/realtime/cacheInvalidationManager';
import {
  useRealtimeBookingData,
  useRealtimeCoachingSessionData,
  useRealtimeNotificationData,
} from './useRealtimeData';

export interface UseRealtimeAPIOptions {
  /** Auto-fetch initial data */
  autoFetch?: boolean;
  /** Use cache if available */
  useCache?: boolean;
  /** Invalidate cache on unmount */
  invalidateOnUnmount?: boolean;
}

/**
 * Enhanced booking API with realtime sync
 */

const COURT_UUID_MAP: Record<string, {name: string, sport: string}> = {
  '71ef892a-d708-4afa-a945-3668f1bba623': { name: 'Badminton 1', sport: 'Badminton' },
  '717b1e0f-a58c-48aa-90f4-1552681c3e3c': { name: 'Table Tennis 2', sport: 'Table Tennis' },
  '2334d4b2-6495-4a0a-ba6f-c0778125cda2': { name: 'Billiards 2', sport: 'Billiards' },
  '1782a805-1605-4f12-881a-4d7c6f406f7a': { name: 'Table Tennis 3', sport: 'Table Tennis' },
  'f235e0c6-1bf8-416c-b880-85835ef6b2ae': { name: 'Billiards 4', sport: 'Billiards' },
  'a0acebdd-a6de-46d6-8ae1-0e62b91ca679': { name: 'Badminton 2', sport: 'Badminton' },
  'df145909-f3f1-4b3b-9276-fb131a5e79ed': { name: 'Badminton 3', sport: 'Badminton' },
  '9974c2bc-439d-4f05-86de-acdaeb30097f': { name: 'Billiards 3', sport: 'Billiards' },
  '77c813e9-f952-4364-8b67-8466b87b10aa': { name: 'Basketball 1', sport: 'Basketball' },
  '04eeb810-d218-4a63-9b63-47a7e83ca302': { name: 'Volleyball 1', sport: 'Volleyball' },
  'f7939718-a28e-4e48-b0fb-163d45cc5375': { name: 'Pickleball 2', sport: 'Pickleball' },
  '8d13ba51-7f45-426f-bf05-ab874989efd3': { name: 'Pickleball 1', sport: 'Pickleball' },
  'cfa2ac3d-8c34-490a-b18b-e7c21da56dbf': { name: 'Table Tennis 1', sport: 'Table Tennis' },
  '6eef54d4-1eb8-45f4-b3bd-ab4c2e588aa6': { name: 'Table Tennis 4', sport: 'Table Tennis' },
  '72f6a182-0c5c-4745-9125-c8f44eebb484': { name: 'Pickleball 3', sport: 'Pickleball' },
  'bb302e36-d5a4-43c0-93ff-af36a645591a': { name: 'Billiards 1', sport: 'Billiards' },
};

export const useRealtimeBookingAPI = (userId: string, options?: UseRealtimeAPIOptions) => {
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiBookings, setApiBookings] = useState<any[]>([]);
  const cacheRef = useRef<any[]>([]);

  const normalizeBooking = useCallback((b: any) => {
    const courtIdStr = String(b.court || b.court_id || b.courtId || '');
    const courtInfo = COURT_UUID_MAP[courtIdStr] || { name: courtIdStr, sport: 'Court Booking' };
    const base = normalizeBookingForDisplay(b);
    return {
      ...base,
      court: courtInfo.name !== courtIdStr ? courtInfo.name : base.court,
      courtId: courtIdStr,
      sport: base.sport !== 'Sports' ? base.sport : courtInfo.sport,
      customerName: b.customerName || b.customer_name || 'Customer',
      customerPhone: b.customerPhone || b.customer_phone || '',
      cancellationReason: b.cancellationReason || b.cancellation_reason || '',
      checkInStatus: b.checkInStatus || b.check_in_status || (b.status === 'checked_in' ? 'checked_in' : 'none'),
      checkOutStatus: b.checkOutStatus || b.check_out_status || (b.status === 'completed' ? 'checked_out' : 'none'),
      checkInTime: b.checkInTime || b.check_in_time,
      checkOutTime: b.checkOutTime || b.check_out_time,
      facilityMapId: b.facilityMapId || b.facility_map_id,
      userId: b.user_id || b.userId || '',
    };
  }, []);

  const { data: realtimeBookings, isConnected, ...realtimeState } = useRealtimeBookingData(
    userId,
    {
      initialData: cacheRef.current,
      mergeStrategy: 'smart',
      optimistic: true,
    }
  );

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await apiFetch(`/api/bookings/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch bookings');
      const bookings = await response.json();
      const normalized = Array.isArray(bookings) ? bookings.map(normalizeBooking) : [];
      cacheRef.current = normalized;
      setApiBookings(normalized);
      return normalized;
    } catch (err: any) {
      setApiError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, normalizeBooking]);

  const createBooking = useCallback(async (data: any) => {
    try {
      setApiError(null);
      const optimistic = { id: `temp-${Date.now()}`, ...data };

      // Optimistic update
      realtimeState.optimisticUpdate?.(optimistic.id, optimistic);

      const response = await apiFetch(`/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Booking failed');
      }

      const booking = await response.json();

      // Commit update
      realtimeState.commitUpdate?.(optimistic.id);

      // Invalidate cache
      cacheInvalidationManager.invalidate(
        cacheInvalidationManager.getKey('bookings', { userId })
      );

      return booking;
    } catch (err: any) {
      setApiError(err.message);
      throw err;
    }
  }, [userId, realtimeState]);

  const cancelBooking = useCallback(
    async (bookingId: string, reason?: string) => {
      try {
        setApiError(null);

        const response = await apiFetch(`/api/bookings/${bookingId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });

        if (!response.ok) throw new Error('Failed to cancel booking');

        // Invalidate cache
        cacheInvalidationManager.invalidate(
          cacheInvalidationManager.getKey('booking', { id: bookingId })
        );

        return await response.json();
      } catch (err: any) {
        setApiError(err.message);
        throw err;
      }
    },
    []
  );

  useEffect(() => {
    if (options?.autoFetch) {
      fetchBookings();
    }
  }, [userId, options?.autoFetch, fetchBookings]);

  useEffect(() => {
    const onRefresh = () => {
      if (userId) void fetchBookings();
    };
    window.addEventListener('sportsync:bookings-refresh', onRefresh);
    return () => window.removeEventListener('sportsync:bookings-refresh', onRefresh);
  }, [userId, fetchBookings]);

  useEffect(() => {
    return () => {
      if (options?.invalidateOnUnmount) {
        cacheInvalidationManager.invalidate(
          cacheInvalidationManager.getKey('bookings', { userId })
        );
      }
    };
  }, [userId, options?.invalidateOnUnmount]);

  const normalizedRealtime = (Array.isArray(realtimeBookings) ? realtimeBookings : []).map(normalizeBooking);
  const mergedById = new Map<string, any>();
  apiBookings.forEach((booking) => {
    if (booking?.id) mergedById.set(String(booking.id), booking);
  });
  normalizedRealtime.forEach((booking) => {
    if (!booking?.id) return;
    const existing = mergedById.get(String(booking.id));
    mergedById.set(String(booking.id), { ...existing, ...booking });
  });
  const bookings = useMemo(() => {
    const byId = new Map<string, ReturnType<typeof normalizeBooking>>();
    normalizedRealtime.forEach((b) => {
      if (b?.id) byId.set(String(b.id), b);
    });
    apiBookings.forEach((b) => {
      if (!b?.id) return;
      const id = String(b.id);
      byId.set(id, mergeBookingRows(byId.get(id), b) as ReturnType<typeof normalizeBooking>);
    });
    return Array.from(byId.values());
  }, [normalizedRealtime, apiBookings]);

  return {
    bookings,
    fetchBookings,
    createBooking,
    cancelBooking,
    loading,
    apiError,
    isConnected,
    ...realtimeState,
  };
};

/**
 * Enhanced coaching API with realtime sync
 */
export const useRealtimeCoachingAPI = (
  userId: string,
  role: 'user' | 'coach' | 'admin',
  options?: UseRealtimeAPIOptions
) => {
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiSessions, setApiSessions] = useState<any[]>([]);
  const cacheRef = useRef<any[]>([]);

  const normalizeSession = useCallback((s: any) => {
    // Map DB status to UI status
    const dbStatus = s.status || 'pending';
    let uiStatus: 'pending' | 'confirmed' | 'rejected' = 'pending';
    if (dbStatus === 'approved' || dbStatus === 'scheduled' || dbStatus === 'completed') uiStatus = 'confirmed';
    else if (dbStatus === 'rejected' || dbStatus === 'cancelled') uiStatus = 'rejected';

    return {
      id: s.id,
      userId: s.userId || s.user_id || '',
      userName: s.userName || 'User',
      coachId: s.coachId || s.coach_id || '',
      coachName: s.coachName || 'Coach',
      sport: s.sport || 'Sports',
      requestedDate: s.requestedDate || s.session_date || '',
      requestedTime: s.requestedTime || s.start_time || '',
      endTime: s.endTime || s.end_time,
      message: s.message || s.notes || '',
      adminNotes: s.adminNotes || s.admin_notes,
      durationHours: s.durationHours ?? (typeof s.duration_hours === 'number' ? s.duration_hours : undefined),
      status: uiStatus,
      viewerIsStudent: s.viewerIsStudent,
      viewerIsCoachForThisSession: s.viewerIsCoachForThisSession,
    };
  }, []);

  const { data: realtimeSessions, isConnected, ...realtimeState } =
    useRealtimeCoachingSessionData(userId, role, {
      initialData: cacheRef.current,
      mergeStrategy: 'smart',
      optimistic: true,
    });

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await apiFetch(`/api/users/${userId}/coaching-sessions`);
      if (!response.ok) throw new Error('Failed to fetch sessions');
      const sessions = await response.json();
      const normalized = Array.isArray(sessions) ? sessions.map(normalizeSession) : [];
      cacheRef.current = normalized;
      setApiSessions(normalized);
      return normalized;
    } catch (err: any) {
      setApiError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId, normalizeSession]);

  const requestSession = useCallback(async (data: any) => {
    try {
      setApiError(null);

      const response = await apiFetch(`/api/coaching-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to request session');

      const session = await response.json();

      // Invalidate cache
      cacheInvalidationManager.invalidate(
        cacheInvalidationManager.getKey('coaching_sessions', { userId, role })
      );

      return session;
    } catch (err: any) {
      setApiError(err.message);
      throw err;
    }
  }, [userId, role]);

  const updateSessionStatus = useCallback(
    async (sessionId: string, status: string) => {
      try {
        setApiError(null);

        // Optimistic update
        realtimeState.optimisticUpdate?.(sessionId, { status });

        const response = await apiFetch(
          `/api/coaching-sessions/${encodeURIComponent(sessionId)}/status`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }
        );

        if (!response.ok) {
          realtimeState.revertUpdate?.(sessionId);
          throw new Error('Failed to update session');
        }

        const session = await response.json();

        // Commit update
        realtimeState.commitUpdate?.(sessionId);

        // Invalidate cache
        cacheInvalidationManager.invalidate(
          cacheInvalidationManager.getKey('coaching_session', { id: sessionId })
        );

        return session;
      } catch (err: any) {
        setApiError(err.message);
        throw err;
      }
    },
    [realtimeState]
  );

  useEffect(() => {
    if (options?.autoFetch) {
      fetchSessions();
    }
  }, [userId, options?.autoFetch, fetchSessions]);

  useEffect(() => {
    return () => {
      if (options?.invalidateOnUnmount) {
        cacheInvalidationManager.invalidate(
          cacheInvalidationManager.getKey('coaching_sessions', { userId, role })
        );
      }
    };
  }, [userId, role, options?.invalidateOnUnmount]);

  const normalizedRealtime = (Array.isArray(realtimeSessions) ? realtimeSessions : []).map(normalizeSession);
  const sessions = normalizedRealtime.length > 0 ? normalizedRealtime : apiSessions;

  return {
    sessions,
    fetchSessions,
    requestSession,
    updateSessionStatus,
    loading,
    apiError,
    isConnected,
    ...realtimeState,
  };
};

/**
 * Enhanced notification API with realtime sync
 */
export const useRealtimeNotificationAPI = (userId: string) => {
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: realtimeNotifications, unreadCount, isConnected } =
    useRealtimeNotificationData(userId);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await apiFetch(`/api/notifications/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch notifications');
      return await response.json();
    } catch (err: any) {
      setApiError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      setApiError(null);

      const response = await apiFetch(`/api/notifications/${notificationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      });

      if (!response.ok) throw new Error('Failed to mark as read');

      // Invalidate cache
      cacheInvalidationManager.invalidate(
        cacheInvalidationManager.getKey('notifications', { userId })
      );

      return await response.json();
    } catch (err: any) {
      setApiError(err.message);
      throw err;
    }
  }, [userId]);

  const markAllAsRead = useCallback(async () => {
    try {
      setApiError(null);

      const response = await apiFetch(`/api/notifications/${userId}/mark-all-read`, {
        method: 'PUT',
      });

      if (!response.ok) throw new Error('Failed to mark all as read');

      // Invalidate cache
      cacheInvalidationManager.invalidate(
        cacheInvalidationManager.getKey('notifications', { userId })
      );

      return await response.json();
    } catch (err: any) {
      setApiError(err.message);
      throw err;
    }
  }, [userId]);

  return {
    notifications: realtimeNotifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    loading,
    apiError,
    isConnected,
  };
};
