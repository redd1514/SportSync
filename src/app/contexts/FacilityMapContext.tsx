import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

import { getLocalDateString } from '../utils/date';
import { fetchAppData, putAppData } from '../utils/appDataClient';

/* ─── Types ─────────────────────────────────────────────────────── */
export interface CourtBlock {
  id: string;
  sport: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'available' | 'maintenance';
  zIndex?: number;    // layer order for bring to front/back
  customColor?: string; // for custom sport types
}

export type LiveStatus = 'available' | 'occupied' | 'maintenance';

export interface FacilityMap {
  id: string;
  name: string;
  branch: string;
  location: string;
  canvasW: number;
  canvasH: number;
  blocks: CourtBlock[];
  isPublished: boolean;
  publishedAt?: string;
  createdAt: string;
}

interface FacilityMapContextType {
  maps: FacilityMap[];
  createMap: (meta: { name: string; branch: string; location: string; canvasW: number; canvasH: number }) => string;
  updateMapBlocks: (id: string, blocks: CourtBlock[]) => void;
  publishMap: (id: string, blocks: CourtBlock[]) => void;
  deleteMap: (id: string) => void;
  updateMapMeta: (id: string, meta: Partial<Pick<FacilityMap, 'name' | 'branch' | 'location'>>) => void;
  publishedLayout: CourtBlock[];
  publishLayout: (blocks: CourtBlock[]) => void;
  getCourtLiveStatus: (
    courtName: string,
    hour: number,
    bookings: { court: string; date: string; time: string; duration: number; status: string }[],
    mapId?: string,
    selectedDate?: string,
  ) => LiveStatus;
  /** Admin court management helpers */
  updateBlockStatus: (courtId: string, status: 'available' | 'maintenance') => void;
  deleteCourtBlock: (courtId: string) => void;
  isLoading: boolean;
  error: string | null;
}

/* ─── Sport colours ─────────────────────────────────────────────── */
const SPORT_COLORS: Record<string, string> = {
  Basketball:    '#FF8C00',
  Volleyball:    '#0047AB',
  Badminton:     '#22c55e',
  Pickleball:    '#a855f7',
  Billiards:     '#ec4899',
  'Table Tennis':'#06b6d4',
};
export const getSportMapColor = (sport: string) => SPORT_COLORS[sport] || '#6b7280';

export const DEFAULT_LAYOUT: CourtBlock[] = [];

/** Normalize maps loaded from KV / JSON (handles snake_case and missing isPublished). */
function normalizeFacilityMap(raw: unknown): FacilityMap | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = o.id != null ? String(o.id) : '';
  if (!id) return null;
  const blocks = Array.isArray(o.blocks) ? (o.blocks as CourtBlock[]) : [];
  const publishedAtRaw = o.publishedAt ?? o.published_at;
  const publishedAt = publishedAtRaw != null && publishedAtRaw !== '' ? String(publishedAtRaw) : undefined;
  let rawPub: unknown = o.isPublished ?? o.is_published;
  if (typeof rawPub === 'string') {
    rawPub = rawPub === 'true' || rawPub === '1';
  }
  const isPublished =
    typeof rawPub === 'boolean' ? rawPub : Boolean(publishedAt);
  return {
    id,
    name: String(o.name ?? 'Facility'),
    branch: String(o.branch ?? ''),
    location: String(o.location ?? ''),
    canvasW: Number(o.canvasW ?? o.canvas_w) || 960,
    canvasH: Number(o.canvasH ?? o.canvas_h) || 450,
    blocks,
    isPublished,
    publishedAt,
    createdAt: String(o.createdAt ?? o.created_at ?? new Date().toISOString()),
  };
}

function normalizeFacilityMapsPayload(raw: unknown): FacilityMap[] {
  if (raw == null) return [];
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === 'object' && raw !== null && Array.isArray((raw as { maps?: unknown }).maps)) {
    list = (raw as { maps: unknown[] }).maps;
  }
  return list.map(normalizeFacilityMap).filter((m): m is FacilityMap => m !== null);
}

/* ─── Context ───────────────────────────────────────────────────── */
const FacilityMapContext = createContext<FacilityMapContextType | undefined>(undefined);

const FACILITY_MAPS_KV_KEY = 'facility_maps_v2';

export function FacilityMapProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maps, setMaps] = useState<FacilityMap[]>([]);
  const [mapsBootstrapped, setMapsBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const remote = await fetchAppData<unknown>(FACILITY_MAPS_KV_KEY);
        if (cancelled) return;
        const fromRemote = normalizeFacilityMapsPayload(remote);
        if (fromRemote.length > 0) {
          setMaps(fromRemote);
        } else {
          try {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('jrc_facility_maps_v2') : null;
            if (saved) {
              const parsed = JSON.parse(saved) as unknown;
              const fromLocal = normalizeFacilityMapsPayload(parsed);
              setMaps(fromLocal);
              if (fromLocal.length > 0) {
                await putAppData(FACILITY_MAPS_KV_KEY, fromLocal);
              }
              localStorage.removeItem('jrc_facility_maps_v2');
            } else {
              setMaps([]);
            }
          } catch {
            setMaps([]);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load maps');
        setMaps([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setMapsBootstrapped(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapsBootstrapped || maps.length === 0) return;
    const t = window.setTimeout(() => {
      void putAppData(FACILITY_MAPS_KV_KEY, maps);
    }, 650);
    return () => window.clearTimeout(t);
  }, [maps, mapsBootstrapped]);

  const createMap = useCallback((
    meta: { name: string; branch: string; location: string; canvasW: number; canvasH: number }
  ) => {
    const id = `map-${Date.now()}`;
    const newMap: FacilityMap = {
      id,
      ...meta,
      blocks: [],
      isPublished: false,
      createdAt: new Date().toISOString(),
    };
    setMaps(prev => [...prev, newMap]);
    return id;
  }, []);

  const updateMapBlocks = useCallback((id: string, blocks: CourtBlock[]) => {
    setMaps(prev => prev.map(m => m.id === id ? { ...m, blocks: [...blocks] } : m));
  }, []);

  const publishMap = useCallback((id: string, blocks: CourtBlock[]) => {
    setMaps(prev => prev.map(m =>
      m.id === id
        ? { ...m, blocks: [...blocks], isPublished: true, publishedAt: new Date().toISOString() }
        : m
    ));
  }, []);

  const deleteMap = useCallback((id: string) => {
    setMaps(prev => prev.filter(m => m.id !== id));
  }, []);

  const updateMapMeta = useCallback((
    id: string,
    meta: Partial<Pick<FacilityMap, 'name' | 'branch' | 'location'>>
  ) => {
    setMaps(prev => prev.map(m => m.id === id ? { ...m, ...meta } : m));
  }, []);

  const firstPublished = maps.find(m => m.isPublished);
  const publishedLayout = firstPublished?.blocks ?? [];

  const publishLayout = useCallback((blocks: CourtBlock[]) => {
    setMaps(prev => {
      const first = prev.find(m => m.isPublished);
      if (!first && prev.length > 0) {
        return prev.map((m, i) =>
          i === 0
            ? { ...m, blocks: [...blocks], isPublished: true, publishedAt: new Date().toISOString() }
            : m
        );
      }
      if (first) {
        return prev.map(m =>
          m.id === first.id
            ? { ...m, blocks: [...blocks], isPublished: true, publishedAt: new Date().toISOString() }
            : m
        );
      }
      return prev;
    });
  }, []);

  /** Update a single block's status inside the published/demo map */
  const updateBlockStatus = useCallback((courtId: string, status: 'available' | 'maintenance') => {
    setMaps(prev => prev.map(m => ({
      ...m,
      blocks: m.blocks.map(b => b.id === courtId ? { ...b, status } : b),
    })));
  }, []);

  /** Remove a court block from all maps */
  const deleteCourtBlock = useCallback((courtId: string) => {
    setMaps(prev => prev.map(m => ({
      ...m,
      blocks: m.blocks.filter(b => b.id !== courtId),
    })));
  }, []);

  /* ── Live court status (no hardcoded demo date) ── */
  const getCourtLiveStatus = useCallback((
    courtName: string,
    hour: number,
    bookings: { court: string; date: string; time: string; duration: number; status: string }[],
    mapId?: string,
    selectedDate?: string,
  ): LiveStatus => {
    const targetMap = mapId ? maps.find(m => m.id === mapId) : firstPublished;
    const block = targetMap?.blocks.find(b => b.name === courtName);
    if (block?.status === 'maintenance') return 'maintenance';

    const today  = getLocalDateString(new Date());
    const checkDate = selectedDate || today;

    const SHARED_SPORTS = ["Basketball", "Volleyball", "Badminton", "Pickleball"];
    const FULL_COURT_SPORTS = ["Basketball", "Volleyball"];
    const sportA = SHARED_SPORTS.find(s => courtName.includes(s));

    const isOccupied = bookings.some(b => {
      if (b.status === 'cancelled' || b.status === 'completed' || b.status === 'rejected') return false;
      if (b.date !== checkDate) return false;

      const sportB = SHARED_SPORTS.find(s => b.court.includes(s) || b.sport === s);

      if (sportA && sportB) {
        if (FULL_COURT_SPORTS.includes(sportB)) {
          // existing booking is full court -> blocks everything
        } else if (FULL_COURT_SPORTS.includes(sportA)) {
          // checking a full court, but sub court is booked -> full court is blocked
        } else if (sportA !== sportB) {
          // different sub-courts (Badminton vs Pickleball) -> block each other
        } else {
          // same sub-court sport -> only blocked if exact same court
          if (b.court !== courtName) return false;
        }
      } else {
        // non-shared sports -> only blocked if exact same court
        if (b.court !== courtName) return false;
      }
      
      const [bHour] = b.time.split(':').map(Number);
      return hour >= bHour && hour < bHour + (b.duration || 1);
    });
    return isOccupied ? 'occupied' : 'available';
  }, [maps, firstPublished]);

  return (
    <FacilityMapContext.Provider value={{
      maps,
      createMap, updateMapBlocks, publishMap, deleteMap, updateMapMeta,
      publishedLayout, publishLayout, getCourtLiveStatus,
      updateBlockStatus, deleteCourtBlock,
      isLoading, error
    }}>
      {children}
    </FacilityMapContext.Provider>
  );
}

export function useFacilityMap() {
  const ctx = useContext(FacilityMapContext);
  if (!ctx) throw new Error('useFacilityMap must be inside FacilityMapProvider');
  return ctx;
}