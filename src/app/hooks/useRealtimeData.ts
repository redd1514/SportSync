/**
 * Advanced Realtime Integration Hook
 * Combines data fetching, realtime updates, and cache invalidation
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  useRealtimeBookings,
  useRealtimeCoachingSessions,
  useRealtimeNotifications,
  useRealtimeAdminBookings,
  useRealtimeAdminCoachingSessions,
} from './useRealtimeSubscriptions';
import { cacheInvalidationManager } from '../utils/realtime/cacheInvalidationManager';

export interface UseRealtimeDataOptions {
  /** Initial data to populate */
  initialData?: any[];
  /** Fetch function to get initial data */
  fetch?: () => Promise<any[]>;
  /** Enable auto-sync */
  autoSync?: boolean;
  /** Sync interval in ms (if autoSync enabled) */
  syncInterval?: number;
  /** Merge strategy for updates */
  mergeStrategy?: 'replace' | 'merge' | 'smart';
  /** Enable optimistic updates */
  optimistic?: boolean;
}

/**
 * Hook for real-time booking data with cache management
 */
export function useRealtimeBookingData(
  userId: string,
  options?: UseRealtimeDataOptions
) {
  const [merged, setMerged] = useState(options?.initialData || []);
  const { data: realtimeData, isConnected, error } = useRealtimeBookings(userId);
  const pendingUpdates = useRef<Map<string, any>>(new Map());

  // Merge realtime data with initial data
  useEffect(() => {
    if (options?.mergeStrategy === 'replace') {
      setMerged(realtimeData);
    } else {
      // Smart merge: use realtime data but preserve local updates
      const merged = [...realtimeData];
      pendingUpdates.current.forEach((update, id) => {
        const index = merged.findIndex((item: any) => item.id === id);
        if (index !== -1) {
          merged[index] = { ...(merged[index] as any), ...update };
        }
      });
      setMerged(merged);
    }

    // Invalidate booking list cache
    cacheInvalidationManager.invalidate(
      cacheInvalidationManager.getKey('bookings', { userId })
    );
  }, [realtimeData, userId]);

  const optimisticUpdate = useCallback(
    (id: string, updates: Partial<any>) => {
      if (!options?.optimistic) return;

      pendingUpdates.current.set(id, updates);
      setMerged((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    [options?.optimistic]
  );

  const commitUpdate = useCallback((id: string) => {
    pendingUpdates.current.delete(id);
  }, []);

  const revertUpdate = useCallback((id: string) => {
    pendingUpdates.current.delete(id);
    // Trigger re-sync
    cacheInvalidationManager.invalidate(cacheInvalidationManager.getKey('booking', { id }));
  }, []);

  return {
    data: merged,
    realtimeData,
    isConnected,
    error,
    optimisticUpdate,
    commitUpdate,
    revertUpdate,
    hasPendingUpdates: pendingUpdates.current.size > 0,
  };
}

/**
 * Hook for real-time coaching sessions with cache management
 */
export function useRealtimeCoachingSessionData(
  userId: string,
  role: 'user' | 'coach' | 'admin',
  options?: UseRealtimeDataOptions
) {
  const [merged, setMerged] = useState(options?.initialData || []);
  const { data: realtimeData, isConnected, error } = useRealtimeCoachingSessions(userId, role);
  const pendingUpdates = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (options?.mergeStrategy === 'replace') {
      setMerged(realtimeData);
    } else {
      const merged = [...realtimeData];
      pendingUpdates.current.forEach((update, id) => {
        const index = merged.findIndex((item: any) => item.id === id);
        if (index !== -1) {
          merged[index] = { ...(merged[index] as any), ...update };
        }
      });
      setMerged(merged);
    }

    // Invalidate cache
    cacheInvalidationManager.invalidate(
      cacheInvalidationManager.getKey('coaching_sessions', { userId, role })
    );
  }, [realtimeData, userId, role]);

  const optimisticUpdate = useCallback(
    (id: string, updates: Partial<any>) => {
      if (!options?.optimistic) return;

      pendingUpdates.current.set(id, updates);
      setMerged((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    [options?.optimistic]
  );

  const commitUpdate = useCallback((id: string) => {
    pendingUpdates.current.delete(id);
  }, []);

  const revertUpdate = useCallback((id: string) => {
    pendingUpdates.current.delete(id);
    cacheInvalidationManager.invalidate(
      cacheInvalidationManager.getKey('coaching_session', { id })
    );
  }, []);

  return {
    data: merged,
    realtimeData,
    isConnected,
    error,
    optimisticUpdate,
    commitUpdate,
    revertUpdate,
    hasPendingUpdates: pendingUpdates.current.size > 0,
  };
}

/**
 * Hook for real-time notifications with cache management
 */
export function useRealtimeNotificationData(
  userId: string,
  options?: UseRealtimeDataOptions
) {
  const [merged, setMerged] = useState(options?.initialData || []);
  const [unreadCount, setUnreadCount] = useState(0);
  const { data: realtimeData, isConnected, error } = useRealtimeNotifications(userId);

  useEffect(() => {
    setMerged(realtimeData);

    // Calculate unread count
    const unread = realtimeData.filter((notif: any) => !notif.read_at).length;
    setUnreadCount(unread);

    // Invalidate cache
    cacheInvalidationManager.invalidate(
      cacheInvalidationManager.getKey('notifications', { userId })
    );
  }, [realtimeData, userId]);

  return {
    data: merged,
    unreadCount,
    isConnected,
    error,
  };
}

/**
 * Hook for admin real-time dashboard
 */
export function useRealtimeAdminDashboard(options?: UseRealtimeDataOptions) {
  const { data: bookings, isConnected: bookingsConnected } = useRealtimeAdminBookings();
  const { data: sessions, isConnected: sessionsConnected } = useRealtimeAdminCoachingSessions();

  return {
    bookings,
    sessions,
    isConnected: bookingsConnected && sessionsConnected,
    stats: {
      totalBookings: bookings.length,
      totalSessions: sessions.length,
      pendingBookings: bookings.filter((b: any) => b.status === 'pending').length,
      confirmedBookings: bookings.filter((b: any) => b.status === 'confirmed').length,
      pendingSessions: sessions.filter((s: any) => s.status === 'pending').length,
      confirmedSessions: sessions.filter((s: any) => s.status === 'confirmed').length,
    },
  };
}

/**
 * Hook for cache invalidation management
 */
export function useCacheInvalidation() {
  const invalidate = useCallback((key: string) => {
    cacheInvalidationManager.invalidate(key);
  }, []);

  const invalidatePattern = useCallback((pattern: string | RegExp) => {
    cacheInvalidationManager.invalidatePattern(pattern);
  }, []);

  const getKey = useCallback(
    (resource: string, params?: Record<string, any>) => {
      return cacheInvalidationManager.getKey(resource, params);
    },
    []
  );

  const onInvalidate = useCallback((key: string, callback: () => void) => {
    return cacheInvalidationManager.onInvalidate(key, callback);
  }, []);

  return {
    invalidate,
    invalidatePattern,
    getKey,
    onInvalidate,
  };
}
