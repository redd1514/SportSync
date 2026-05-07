import { createContext, useContext, useState, ReactNode } from 'react';

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'promotion' | 'maintenance' | 'reminder' | 'update' | 'alert';
  createdAt: string;
  dismissed?: boolean;
}

interface AnnouncementsContextType {
  announcements: Announcement[];
  addAnnouncement: (a: Omit<Announcement, 'id' | 'createdAt' | 'dismissed'>) => void;
  dismissAnnouncement: (id: string) => void;
  undismissedCount: number;
  isLoading: boolean;
  error: string | null;
}

const AnnouncementsContext = createContext<AnnouncementsContextType | null>(null);

const INITIAL: Announcement[] = [];

export function AnnouncementsProvider({ children }: { children: ReactNode }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(INITIAL);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAnnouncement = (a: Omit<Announcement, 'id' | 'createdAt' | 'dismissed'>) => {
    setAnnouncements(prev => [
      { ...a, id: `ANN${Date.now()}`, createdAt: new Date().toISOString(), dismissed: false },
      ...prev,
    ]);
  };

  const dismissAnnouncement = (id: string) => {
    setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a));
  };

  const undismissedCount = announcements.filter(a => !a.dismissed).length;

  return (
    <AnnouncementsContext.Provider value={{ announcements, addAnnouncement, dismissAnnouncement, undismissedCount, isLoading, error }}>
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
  promotion: '🎁',
  maintenance: '🔧',
  reminder: '📅',
  update: '📢',
  alert: '⚠️',
};

export const ANNOUNCEMENT_COLORS: Record<Announcement['type'], { bg: string; border: string; text: string }> = {
  promotion: { bg: 'rgba(255,140,0,0.08)', border: 'rgba(255,140,0,0.25)', text: '#FF8C00' },
  maintenance: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.25)', text: '#fbbf24' },
  reminder: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)', text: '#60a5fa' },
  update: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', text: '#22c55e' },
  alert: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', text: '#ef4444' },
};
