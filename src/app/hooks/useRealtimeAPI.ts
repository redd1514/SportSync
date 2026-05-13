/**
 * Enhanced API Hooks with Realtime Integration
 * Combines traditional API calls with real-time updates
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';
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
export const useRealtimeBookingAPI = (userId: string, options?: UseRealtimeAPIOptions) => {
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiBookings, setApiBookings] = useState<any[]>([]);
  const cacheRef = useRef<any[]>([]);

  const normalizeBooking = useCallback((b: any) => ({
    id: b.id,
    date: b.date || b.booking_date || '',
    time: b.time || b.start_time || '',
    duration: b.duration || b.duration_hours || 1,
    court: b.court || b.court_id || '',
    sport: b.sport || 'Court Booking',
    status: b.status || 'pending',
    amount: b.amount || b.total_price || 0,
    paymentStatus: b.paymentStatus || b.payment_status || 'pending',
    customerName: b.customerName || b.customer_name || 'Customer',
    customerPhone: b.customerPhone || b.customer_phone || '',
    cancellationRequested: b.cancellationRequested || b.cancellation_requested || false,
    cancellationReason: b.cancellationReason || b.cancellation_reason || '',
    createdAt: b.createdAt || b.created_at || new Date().toISOString(),
  }), []);

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
    return () => {
      if (options?.invalidateOnUnmount) {
        cacheInvalidationManager.invalidate(
          cacheInvalidationManager.getKey('bookings', { userId })
        );
      }
    };
  }, [userId, options?.invalidateOnUnmount]);

  const normalizedRealtime = (Array.isArray(realtimeBookings) ? realtimeBookings : []).map(normalizeBooking);
  const bookings = normalizedRealtime.length > 0 ? normalizedRealtime : apiBookings;

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

  const normalizeSession = useCallback((s: any) => ({
    id: s.id,
    userId: s.userId || s.user_id || '',
    userName: s.userName || 'User',
    coachId: s.coachId || s.coach_id || '',
    coachName: s.coachName || 'Coach',
    sport: s.sport || 'Sports',
    requestedDate: s.requestedDate || s.session_date || '',
    requestedTime: s.requestedTime || s.start_time || '',
    message: s.message || s.notes || '',
    durationHours: s.durationHours || s.duration_hours || 1,
    status: s.status || 'pending',
    paymentProofUrl: s.paymentProofUrl || s.payment_proof_url,
    linkedBookingId: s.linkedBookingId || s.linked_booking_id,
    viewerIsStudent: s.viewerIsStudent,
    viewerIsCoachForThisSession: s.viewerIsCoachForThisSession,
  }), []);

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
