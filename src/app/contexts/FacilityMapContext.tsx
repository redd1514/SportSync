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

/* ─── Built-in demo map ──────────────────────────────────────────── */
const DEMO_MAP_ID = 'jrc-demo-map-v1';

const DEMO_BLOCKS: CourtBlock[] = [
  // ── Row 1: Large courts ──
  { id: 'BASK-1', sport: 'Basketball',    name: 'Basketball 1',  x: 20,  y: 20,  width: 250, height: 215, status: 'available'   },
  { id: 'VOLL-1', sport: 'Volleyball',    name: 'Volleyball 1',  x: 285, y: 20,  width: 250, height: 215, status: 'available'   },
  // ── Row 1: Badminton stacked ──
  { id: 'BADM-1', sport: 'Badminton',     name: 'Badminton 1',   x: 550, y: 20,  width: 178, height: 88,  status: 'available'   },
  { id: 'BADM-2', sport: 'Badminton',     name: 'Badminton 2',   x: 550, y: 118, width: 178, height: 88,  status: 'available'   },
  { id: 'BADM-3', sport: 'Badminton',     name: 'Badminton 3',   x: 550, y: 216, width: 178, height: 88,  status: 'maintenance' },
  // ── Row 1: Pickleball stacked ──
  { id: 'PICK-1', sport: 'Pickleball',    name: 'Pickleball 1',  x: 745, y: 20,  width: 195, height: 90, status: 'available'   },
  { id: 'PICK-2', sport: 'Pickleball',    name: 'Pickleball 2',  x: 745, y: 118, width: 195, height: 90, status: 'available'   },
  { id: 'PICK-3', sport: 'Pickleball',    name: 'Pickleball 3',  x: 745, y: 216, width: 195, height: 90, status: 'available'   },
  // ── Row 2: Billiards ──
  { id: 'BILL-1', sport: 'Billiards',     name: 'Billiards 1',   x: 20,  y: 325, width: 150, height: 105, status: 'available'   },
  { id: 'BILL-2', sport: 'Billiards',     name: 'Billiards 2',   x: 180, y: 325, width: 150, height: 105, status: 'available'   },
  { id: 'BILL-3', sport: 'Billiards',     name: 'Billiards 3',   x: 340, y: 325, width: 150, height: 105, status: 'available'   },
  { id: 'BILL-4', sport: 'Billiards',     name: 'Billiards 4',   x: 500, y: 325, width: 150, height: 105, status: 'available'   },
  // ── Row 3: Table Tennis ──
  { id: 'TTNS-1', sport: 'Table Tennis',  name: 'Table Tennis 1',x: 660, y: 325, width: 65, height: 105, status: 'available'   },
  { id: 'TTNS-2', sport: 'Table Tennis',  name: 'Table Tennis 2',x: 730, y: 325, width: 65, height: 105, status: 'available'   },
  { id: 'TTNS-3', sport: 'Table Tennis',  name: 'Table Tennis 3',x: 800, y: 325, width: 65, height: 105, status: 'available'   },
  { id: 'TTNS-4', sport: 'Table Tennis',  name: 'Table Tennis 4',x: 870, y: 325, width: 65, height: 105, status: 'available'   },
];

const DEFAULT_DEMO_MAP: FacilityMap = {
  id: DEMO_MAP_ID,
  name: 'JRC Ballpark',
  branch: 'Main Branch',
  location: 'Valenzuela City',
  canvasW: 960,
  canvasH: 450,
  blocks: DEMO_BLOCKS,
  isPublished: true,
  publishedAt: '2026-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
};

/* ─── Context ───────────────────────────────────────────────────── */
const FacilityMapContext = createContext<FacilityMapContextType | undefined>(undefined);

const FACILITY_MAPS_KV_KEY = 'facility_maps_v2';

export function FacilityMapProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maps, setMaps] = useState<FacilityMap[]>([DEFAULT_DEMO_MAP]);
  const [mapsBootstrapped, setMapsBootstrapped] = useState(false);

  // Ensure demo map is always present and published
  const ensureDemoMapExists = useCallback((currentMaps: FacilityMap[]) => {
    const hasDemo = currentMaps.some(m => m.id === DEMO_MAP_ID);
    if (!hasDemo) {
      return [DEFAULT_DEMO_MAP, ...currentMaps];
    }
    // Ensure demo map is published
    return currentMaps.map(m =>
      m.id === DEMO_MAP_ID ? { ...m, isPublished: true } : m
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const remote = await fetchAppData<FacilityMap[]>(FACILITY_MAPS_KV_KEY);
        if (cancelled) return;
        if (Array.isArray(remote) && remote.length > 0) {
          const ensured = ensureDemoMapExists(remote);
          setMaps(ensured);
        } else {
          try {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('jrc_facility_maps_v2') : null;
            if (saved) {
              const parsed: FacilityMap[] = JSON.parse(saved);
              const ensured = ensureDemoMapExists(parsed);
              setMaps(ensured);
              await putAppData(FACILITY_MAPS_KV_KEY, ensured);
              localStorage.removeItem('jrc_facility_maps_v2');
            }
          } catch {
            /* keep default demo map */
          }
        }
      } catch {
        /* keep default */
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
  }, [ensureDemoMapExists]);

  useEffect(() => {
    if (!mapsBootstrapped) return;
    const t = window.setTimeout(() => {
      const ensured = ensureDemoMapExists(maps);
      void putAppData(FACILITY_MAPS_KV_KEY, ensured);
    }, 650);
    return () => window.clearTimeout(t);
  }, [maps, mapsBootstrapped, ensureDemoMapExists]);

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
    // Never delete the built-in demo map
    if (id === DEMO_MAP_ID) return;
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