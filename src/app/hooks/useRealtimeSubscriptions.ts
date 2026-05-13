/**
 * Realtime Hooks for React Components
 * Handles subscription lifecycle and state management
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimeEvent, SubscriptionConfig, realtimeManager } from '../utils/realtime/realtimeManager';

export interface UseRealtimeOptions {
  /** Enable/disable subscription */
  enabled?: boolean;
  /** Filter events before processing */
  filter?: (event: RealtimeEvent<any>) => boolean;
  /** Priority for callback execution (higher = first) */
  priority?: number;
  /** Callback on connection status change */
  onConnectionChange?: (status: 'connected' | 'disconnected' | 'connecting') => void;
  /** Callback on error */
  onError?: (error: Error) => void;
  /** Debounce state updates (ms) */
  debounce?: number;
}

/**
 * Generic realtime hook for any table
 */
export function useRealtime<T>(
  channelKey: string,
  config: SubscriptionConfig,
  options?: UseRealtimeOptions
): {
  data: T[];
  isLoading: boolean;
  isConnected: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (options?.enabled === false) return;

    try {
      // Subscribe to realtime changes
      const subscriberId = realtimeManager.subscribe(
        channelKey,
        config,
        (event: RealtimeEvent<T>) => {
          setError(null);

          const updateData = () => {
            setData((prevData) => {
              const newData = [...prevData] as any[];

              if (event.type === 'INSERT') {
                // Add new record if not already present
                if (event.new && !newData.find((item: any) => (item as any).id === (event.new as any)?.id)) {
                  newData.push(event.new);
                }
              } else if (event.type === 'UPDATE') {
                // Update existing record
                const index = newData.findIndex((item: any) => (item as any).id === (event.new as any)?.id);
                if (index !== -1 && event.new) {
                  newData[index] = event.new;
                }
              } else if (event.type === 'DELETE') {
                // Remove deleted record
                return newData.filter((item: any) => (item as any).id !== (event.old as any)?.id);
              }

              return newData;
            });
          };

          // Apply debouncing if specified
          if (options?.debounce) {
            if (debounceTimer.current) {
              clearTimeout(debounceTimer.current);
            }
            debounceTimer.current = setTimeout(updateData, options.debounce);
          } else {
            updateData();
          }
        },
        {
          filter: options?.filter,
          priority: options?.priority,
        }
      );

      setIsLoading(false);

      // Listen for connection status changes
      const unsubscribeStatus = realtimeManager.onConnectionStatusChange((status) => {
        setIsConnected(status === 'connected');
        options?.onConnectionChange?.(status);
      });

      // Set initial connection status
      const currentStatus = realtimeManager.getConnectionStatus();
      setIsConnected(currentStatus === 'connected');

      // Cleanup
      return () => {
        realtimeManager.unsubscribe(channelKey, subscriberId);
        unsubscribeStatus();
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      options?.onError?.(error);
      console.error('[useRealtime] Error:', error);
    }
  }, [channelKey, config, options?.enabled, options?.filter, options?.priority, options?.debounce]);

  return {
    data,
    isLoading,
    isConnected,
    error,
  };
}

/**
 * Hook for realtime bookings
 */
export function useRealtimeBookings(
  userId: string,
  options?: UseRealtimeOptions
) {
  return useRealtime(
    `bookings-${userId}`,
    {
      table: 'bookings',
      event: '*',
      schema: 'public',
      filter: `user_id=eq.${userId}`,
      enabled: !!userId,
    },
    options
  );
}

/**
 * Hook for realtime coaching sessions
 */
export function useRealtimeCoachingSessions(
  userId: string,
  role: 'user' | 'coach' | 'admin',
  options?: UseRealtimeOptions
) {
  const channelKey = `coaching-sessions-${userId}-${role}`;

  let filter = '';
  if (role === 'user') {
    // Users see their own requests
    filter = `user_id=eq.${userId}`;
  } else if (role === 'coach') {
    // Coaches see sessions assigned to them
    filter = `coach_id=eq.${userId}`;
  }
  // admins see all

  return useRealtime(
    channelKey,
    {
      table: 'coaching_sessions',
      event: '*',
      schema: 'public',
      filter: filter || undefined,
      enabled: !!userId,
    },
    options
  );
}

/**
 * Hook for realtime notifications
 */
export function useRealtimeNotifications(
  userId: string,
  options?: UseRealtimeOptions
) {
  return useRealtime(
    `notifications-${userId}`,
    {
      table: 'notifications',
      event: '*',
      schema: 'public',
      filter: `recipient_id=eq.${userId}`,
      enabled: !!userId,
    },
    {
      ...options,
      priority: (options?.priority ?? 0) + 1, // Notifications have higher priority
    }
  );
}

/**
 * Hook for realtime announcements
 */
export function useRealtimeAnnouncements(options?: UseRealtimeOptions) {
  return useRealtime(
    'announcements-all',
    {
      table: 'announcements',
      event: 'INSERT',
      schema: 'public',
    },
    options
  );
}

/**
 * Hook for realtime facilities
 */
export function useRealtimeFacilities(options?: UseRealtimeOptions) {
  return useRealtime(
    'facilities-all',
    {
      table: 'facilities',
      event: '*',
      schema: 'public',
    },
    options
  );
}

/**
 * Hook for realtime coaches
 */
export function useRealtimeCoaches(
  sportFilter?: string,
  options?: UseRealtimeOptions
) {
  const channelKey = `coaches-${sportFilter || 'all'}`;

  const filter = sportFilter ? `sport=eq.${sportFilter}` : undefined;

  return useRealtime(
    channelKey,
    {
      table: 'coaches',
      event: '*',
      schema: 'public',
      filter,
    },
    options
  );
}

/**
 * Hook for realtime admin dashboard (all bookings)
 */
export function useRealtimeAdminBookings(options?: UseRealtimeOptions) {
  return useRealtime(
    'admin-bookings-all',
    {
      table: 'bookings',
      event: '*',
      schema: 'public',
    },
    options
  );
}

/**
 * Hook for realtime admin coaching sessions
 */
export function useRealtimeAdminCoachingSessions(options?: UseRealtimeOptions) {
  return useRealtime(
    'admin-coaching-sessions-all',
    {
      table: 'coaching_sessions',
      event: '*',
      schema: 'public',
    },
    options
  );
}

/**
 * Hook to monitor realtime connection status
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>(
    realtimeManager.getConnectionStatus()
  );
  const [subscriptionCount, setSubscriptionCount] = useState(realtimeManager.getSubscriptionCount());

  useEffect(() => {
    const unsubscribe = realtimeManager.onConnectionStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    // Update subscription count periodically
    const interval = setInterval(() => {
      setSubscriptionCount(realtimeManager.getSubscriptionCount());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return {
    status,
    isConnected: status === 'connected',
    subscriptionCount,
    channelCount: realtimeManager.getChannelCount(),
  };
}

/**
 * Hook for optimistic updates
 * Applies local changes immediately and syncs with realtime
 */
export function useOptimisticUpdate<T extends { id: string }>(
  onUpdate: (item: T) => Promise<void>
): {
  update: (item: T) => void;
  isUpdating: boolean;
  error: Error | null;
} {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(async (item: T) => {
    setIsUpdating(true);
    setError(null);

    try {
      await onUpdate(item);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error('[useOptimisticUpdate] Error:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [onUpdate]);

  return { update, isUpdating, error };
}
