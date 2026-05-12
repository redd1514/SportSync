import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { getApiBaseUrl } from '../utils/apiBase';
import { useUser } from './UserContext';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'promotion' | 'maintenance' | 'reminder' | 'update' | 'alert' | 'general';
  createdAt: string;
  dismissed?: boolean;
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

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/announcements/published`);
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
      setAnnouncements((prev) => {
        const dismissed = new Set(prev.filter((p) => p.dismissed).map((p) => p.id));
        return mapped.map((m) => ({ ...m, dismissed: dismissed.has(m.id) }));
      });
    } catch (e: any) {
      setError(e?.message || 'Could not load announcements');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // refresh on login change
  }, [user?.id]);

  useEffect(() => {
    // keep notifications fresh (without requiring reload)
    const t = window.setInterval(() => void refresh(), 20000);
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

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
      const res = await fetch(`${getApiBaseUrl()}/api/announcements`, {
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
      // Demo-friendly fallback: still show locally if backend can't accept the post.
      const local: Announcement = { ...a, id: `ANN${Date.now()}`, createdAt: new Date().toISOString(), dismissed: false };
      setAnnouncements((prev) => [local, ...prev]);
      setError(e?.message || 'Saved locally (demo mode)');
      return local;
    }
  };

  const dismissAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  };

  const clearAnnouncements = async () => {
    try {
      // Mock clearing via backend if needed, or just clear locally.
      const res = await fetch(`${getApiBaseUrl()}/api/announcements`, { method: 'DELETE' });
      // ignore errors for now, just clear locally
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
};
