import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';
import { realtimeManager } from '../utils/realtime/realtimeManager';

export type StaffLiveOperationsKPIs = {
  bookingsCount: number;
  revenue: number;
  activeCourts: number;
  pendingRequests: number;
};

const REFRESH_DEBOUNCE_MS = 400;

/**
 * Live Operations KPI strip — loads from /api/staff/operations (Supabase)
 * and refreshes on DB realtime events + app refresh signals.
 */
export function useStaffLiveOperationsKPIs(date: string, enabled = true) {
  const [data, setData] = useState<StaffLiveOperationsKPIs | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const fetchKpis = useCallback(async () => {
    if (!enabled) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await apiFetch(`/api/staff/operations?date=${encodeURIComponent(date)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = (await res.json()) as Partial<StaffLiveOperationsKPIs>;
      setData({
        bookingsCount: Number(d.bookingsCount ?? 0),
        revenue: Number(d.revenue ?? 0),
        activeCourts: Number(d.activeCourts ?? 0),
        pendingRequests: Number(d.pendingRequests ?? 0),
      });
      setHydrated(true);
    } catch (err) {
      console.error('[useStaffLiveOperationsKPIs] fetch failed:', err);
      setData({ bookingsCount: 0, revenue: 0, activeCourts: 0, pendingRequests: 0 });
      setHydrated(true);
    } finally {
      inFlightRef.current = false;
    }
  }, [date, enabled]);

  const scheduleRefresh = useCallback(() => {
    if (!enabled) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      window.dispatchEvent(new Event('sportsync:bookings-refresh'));
      void fetchKpis();
    }, REFRESH_DEBOUNCE_MS);
  }, [enabled, fetchKpis]);

  useEffect(() => {
    if (!enabled) return;
    void fetchKpis();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, fetchKpis]);

  useEffect(() => {
    if (!enabled) return;

    const tables = ['bookings', 'payments', 'booking_requests'] as const;
    const subscriberIds = tables.map((table) =>
      realtimeManager.subscribe(
        `staff-live-ops-${table}`,
        { table, event: '*', schema: 'public' },
        () => scheduleRefresh(),
        { priority: 1 },
      ),
    );

    const unsubscribeStatus = realtimeManager.onConnectionStatusChange((status) => {
      setIsConnected(status === 'connected');
    });
    setIsConnected(realtimeManager.getConnectionStatus() === 'connected');

    return () => {
      tables.forEach((table, index) => {
        realtimeManager.unsubscribe(`staff-live-ops-${table}`, subscriberIds[index]);
      });
      unsubscribeStatus();
    };
  }, [enabled, scheduleRefresh]);

  useEffect(() => {
    if (!enabled) return;
    const onRefresh = () => scheduleRefresh();
    const onVisibleRefresh = () => {
      if (document.visibilityState === 'visible') onRefresh();
    };
    window.addEventListener('sportsync:staff-operations-refresh', onRefresh);
    window.addEventListener('sportsync:bookings-refresh', onRefresh);
    window.addEventListener('focus', onRefresh);
    document.addEventListener('visibilitychange', onVisibleRefresh);
    return () => {
      window.removeEventListener('sportsync:staff-operations-refresh', onRefresh);
      window.removeEventListener('sportsync:bookings-refresh', onRefresh);
      window.removeEventListener('focus', onRefresh);
      document.removeEventListener('visibilitychange', onVisibleRefresh);
    };
  }, [enabled, scheduleRefresh]);

  return { data, hydrated, isConnected, refresh: fetchKpis };
}
