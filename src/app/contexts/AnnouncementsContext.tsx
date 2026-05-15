import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef, ReactNode } from 'react';
import { apiFetch } from '../utils/authenticatedFetch';
import { useUser } from './UserContext';
import { realtimeManager } from '../utils/realtime/realtimeManager';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'promotion' | 'maintenance' | 'reminder' | 'update' | 'alert' | 'general';
  createdAt: string;
  dismissed?: boolean;
  actionTab?: 'home' | 'booking' | 'coaching' | string;
  actionSub?: string;
}

interface AnnouncementsContextType {
  announcements: Announcement[];
  addAnnouncement: (a: Omit<Announcement, 'id' | 'createdAt' | 'dismissed'>) => Promise<Announcement | null>;
  dismissAnnouncement: (id: string) => void;
  undismissedCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  clearAnnouncements: () => Promise<void>;
}

const AnnouncementsContext = createContext<AnnouncementsContextType | null>(null);

const INITIAL: Announcement[] = [];

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Added from image_8390be.jpg (Current side)
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/announcements/published`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error((data as { error?: string })?.error || 'Failed to load announcements');
      const list = Array.isArray(data) ? data : [];
      const mapped: Announcement[] = list.map((r: any) => ({
        id: String(r.id),
        title: String(r.title || ''),
        message: String(r.description || r.message || ''),
        type: (String(r.announcement_type || r.type || 'general') as Announcement['type']),
        createdAt: String(r.published_at || r.created_at || new Date().toISOString()),
        dismissed: false,
      }));
      
      let userNotifications: Announcement[] = [];
      if (user?.id) {
        const notifRes = await apiFetch(`/api/notifications/${encodeURIComponent(user.id)}`);
        const notifData = await notifRes.json().catch(() => []);
        if (notifRes.ok && Array.isArray(notifData)) {
          userNotifications = notifData.map((r: any) => {
            const data = r.data && typeof r.data === 'object' ? r.data : {};
            const eventType = String(r.event_type || data.eventType || data.type || '').toLowerCase();
            const title = String(data.title || 'Notification');
            const message = String(data.message || '');
            const actionTab = data.targetTab
              || (/coaching/.test(eventType) || /coach/i.test(`${title} ${message}`) ? 'coaching'
              : /booking|reschedule|cancel|front_desk|ticket/.test(eventType) ? 'booking'
              : 'home');
            const actionSub = data.targetSub
              || (actionTab === 'coaching' ? 'mycoaching' : actionTab === 'booking' ? 'mybookings' : undefined);
            return {
              id: `notif:${String(r.id)}`,
              title,
              message,
              type: (String(data.type || 'update') as Announcement['type']),
              createdAt: String(r.created_at || new Date().toISOString()),
              dismissed: Boolean(r.read_at),
              actionTab,
              actionSub,
            };
          });
        }
      }
      
      setAnnouncements((prev) => {
        const dismissed = new Set(prev.filter((p) => p.dismissed).map((p) => p.id));
        return [...userNotifications, ...mapped]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((m) => ({ ...m, dismissed: m.dismissed || dismissed.has(m.id) }));
      });
    } catch (e: any) {
      setError(e?.message || 'Could not load announcements');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]); // Updated dependency to include user.id for notifications

  useEffect(() => {
    void refresh();
  }, [user?.id, refresh]);

  // MERGED EFFECT BLOCK FROM image_8390be.jpg
  useEffect(() => {
    // 1. Existing Polling and Visibility Logic
    const t = window.setInterval(() => void refresh(), 20000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    
    // 2. Custom Event Listener (Incoming side of image_8390be.jpg)
    const onNotificationsRefresh = () => void refresh();
    
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('sportsync:notifications-refresh', onNotificationsRefresh);

    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('sportsync:notifications-refresh', onNotificationsRefresh);
    };
  }, [refresh]);

  // 3. New Real-time Subscription Effect (Current side of image_8390be.jpg)
  useEffect(() => {
    const channelKey = 'announcements-live-all';
    const scheduleRefresh = () => {
      if (refreshDebounceRef.current) window.clearTimeout(refreshDebounceRef.current);
      refreshDebounceRef.current = window.setTimeout(() => {
        refreshDebounceRef.current = null;
        void refresh();
      }, 350);
    };

    const subscriberId = realtimeManager.subscribe(
      channelKey,
      { table: 'announcements', event: '*', schema: 'public' },
      () => {
        scheduleRefresh();
      }
    );

    return () => {
      realtimeManager.unsubscribe(channelKey, subscriberId);
      if (refreshDebounceRef.current) window.clearTimeout(refreshDebounceRef.current);
    };
  }, [refresh]);

  const addAnnouncement = async (a: Omit<Announcement, 'id' | 'createdAt' | 'dismissed'>) => {
    setError(null);
    try {
      const payload = {
        title: a.title,
        description: a.message,
        announcement_type: a.type,
        created_by: user?.id,
        publish: true,
      };
      const res = await apiFetch(`/api/announcements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string })?.error || 'Failed to publish');
      await refresh();
      return {
        id: String((data as any).id || `ANN${Date.now()}`),
        title: a.title,
        message: a.message,
        type: a.type,
        createdAt: String((data as any).published_at || new Date().toISOString()),
        dismissed: false,
      };
    } catch (e: any) {
      const local: Announcement = { ...a, id: `ANN${Date.now()}`, createdAt: new Date().toISOString(), dismissed: false };
      setAnnouncements((prev) => [local, ...prev]);
      setError(e?.message || 'Saved locally (demo mode)');
      return local;
    }
  };

  const dismissAnnouncement = (id: string) => {
    if (id.startsWith('notif:')) {
      void apiFetch(`/api/notifications/${encodeURIComponent(id.slice(6))}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read_at: new Date().toISOString() }),
      });
    }
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  };

  const clearAnnouncements = async () => {
    try {
      await apiFetch(`/api/announcements`, { method: 'DELETE' });
    } catch (e) {}
    setAnnouncements([]);
  };

  const undismissedCount = useMemo(() => announcements.filter(a => !a.dismissed).length, [announcements]);

  return (
    <AnnouncementsContext.Provider value={{ announcements, addAnnouncement, dismissAnnouncement, clearAnnouncements, undismissedCount, isLoading, error, refresh }}>
      {children}
    </AnnouncementsContext.Provider>
  );
}
export function useAnnouncements() {
  const ctx = useContext(AnnouncementsContext);
  if (!ctx) throw new Error('useAnnouncements must be inside AnnouncementsProvider');
  return ctx;
}

export const ANNOUNCEMENT_ICONS: Record<Announcement['type'], string> = {
  promotion: '',
  maintenance: '',
  reminder: '',
  update: '',
  alert: '',
  general: '',
};

export const ANNOUNCEMENT_COLORS: Record<Announcement['type'], { bg: string; border: string; text: string }> = {
  promotion: { bg: 'rgba(255,140,0,0.08)', border: 'rgba(255,140,0,0.25)', text: '#FF8C00' },
  maintenance: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', text: '#fbbf24' },
  reminder: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', text: '#60a5fa' },
  update: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', text: '#22c55e' },
  alert: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#ef4444' },
  general: { bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.25)', text: '#94a3b8' },
};
