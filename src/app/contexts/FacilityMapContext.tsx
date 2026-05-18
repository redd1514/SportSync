import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

import { getLocalDateString } from '../utils/date';
import { fetchAppData, putAppData } from '../utils/appDataClient';
import { bookingOccupiesCourtOnMap } from '../utils/bookingDisplay';

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
    bookings: { court: string; date: string; time: string; duration: number; status: string; paymentStatus?: string; facilityMapId?: string | null }[],
    mapId?: string,
    selectedDate?: string,
  ) => LiveStatus;
  /** Admin court management helpers */
  updateBlockStatus: (mapId: string, courtId: string, status: 'available' | 'maintenance') => void;
  deleteCourtBlock: (mapId: string, courtId: string) => void;
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

/** Match staff/user map court fill & sheen (FacilityMapViewer). */
export const FACILITY_COURT_FILL_OPACITY = 0.75;
export const FACILITY_COURT_SHEEN_OPACITY = 0.55;
export const FACILITY_COURT_SELECTED_FILL_OPACITY = 0.92;

export function resolveCourtSportColor(
  block: Pick<CourtBlock, 'sport' | 'customColor'>,
  customSports: { name: string; color: string }[] = [],
): string {
  return (
    block.customColor
    || customSports.find(cs => cs.name === block.sport)?.color
    || getSportMapColor(block.sport)
  );
}

export const DEFAULT_LAYOUT: CourtBlock[] = [];

/** Built-in demo layout — JRC Ballpark (same positions as original product demo). */
export const DEMO_FACILITY_MAP_ID = 'jrc-demo-map-v1';

const DEMO_BLOCKS: CourtBlock[] = [
  { id: 'BASK-1', sport: 'Basketball', name: 'Basketball 1', x: 20, y: 20, width: 250, height: 215, status: 'available' },
  { id: 'VOLL-1', sport: 'Volleyball', name: 'Volleyball 1', x: 285, y: 20, width: 250, height: 215, status: 'available' },
  { id: 'BADM-1', sport: 'Badminton', name: 'Badminton 1', x: 550, y: 20, width: 178, height: 88, status: 'available' },
  { id: 'BADM-2', sport: 'Badminton', name: 'Badminton 2', x: 550, y: 118, width: 178, height: 88, status: 'available' },
  { id: 'BADM-3', sport: 'Badminton', name: 'Badminton 3', x: 550, y: 216, width: 178, height: 88, status: 'maintenance' },
  { id: 'PICK-1', sport: 'Pickleball', name: 'Pickleball 1', x: 745, y: 20, width: 195, height: 90, status: 'available' },
  { id: 'PICK-2', sport: 'Pickleball', name: 'Pickleball 2', x: 745, y: 118, width: 195, height: 90, status: 'available' },
  { id: 'PICK-3', sport: 'Pickleball', name: 'Pickleball 3', x: 745, y: 216, width: 195, height: 90, status: 'available' },
  { id: 'BILL-1', sport: 'Billiards', name: 'Billiards 1', x: 20, y: 325, width: 150, height: 105, status: 'available' },
  { id: 'BILL-2', sport: 'Billiards', name: 'Billiards 2', x: 180, y: 325, width: 150, height: 105, status: 'available' },
  { id: 'BILL-3', sport: 'Billiards', name: 'Billiards 3', x: 340, y: 325, width: 150, height: 105, status: 'available' },
  { id: 'BILL-4', sport: 'Billiards', name: 'Billiards 4', x: 500, y: 325, width: 150, height: 105, status: 'available' },
  { id: 'TTNS-1', sport: 'Table Tennis', name: 'Table Tennis 1', x: 660, y: 325, width: 65, height: 105, status: 'available' },
  { id: 'TTNS-2', sport: 'Table Tennis', name: 'Table Tennis 2', x: 730, y: 325, width: 65, height: 105, status: 'available' },
  { id: 'TTNS-3', sport: 'Table Tennis', name: 'Table Tennis 3', x: 800, y: 325, width: 65, height: 105, status: 'available' },
  { id: 'TTNS-4', sport: 'Table Tennis', name: 'Table Tennis 4', x: 870, y: 325, width: 65, height: 105, status: 'available' },
];

export const DEFAULT_DEMO_FACILITY_MAP: FacilityMap = {
  id: DEMO_FACILITY_MAP_ID,
  name: 'JRC Ballpark',
  branch: 'Main Branch',
  location: 'Valenzuela City',
  canvasW: 960,
  canvasH: 450,
  blocks: DEMO_BLOCKS,
  isPublished: true,
  publishedAt: new Date().toISOString(),
  createdAt: '2026-01-01T00:00:00.000Z',
};

function ensureDemoFacilityMap(list: FacilityMap[]): FacilityMap[] {
  if (list.some((m) => m.id === DEMO_FACILITY_MAP_ID)) return list;
  return [DEFAULT_DEMO_FACILITY_MAP, ...list];
}

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

/**
 * When multiple published maps reuse the same court *name*, only bookings tagged with
 * `facilityMapId` apply to that map. Legacy rows without `facilityMapId` apply only if
 * exactly one published map defines that court name.
 */
export function bookingAppliesToPublishedMap(
  booking: { court: string; facilityMapId?: string | null },
  courtBlockName: string,
  mapId: string | undefined,
  publishedMaps: FacilityMap[],
): boolean {
  const bc = String(booking.court ?? '').trim();
  const bn = String(courtBlockName ?? '').trim();
  if (!bc || !bn || bc !== bn) return false;
  if (!mapId) return true;
  const bid = booking.facilityMapId;
  if (bid) return bid === mapId;
  const mapsWithCourt = publishedMaps.filter((m) => m.blocks.some((bk) => bk.name === courtBlockName));
  if (mapsWithCourt.length === 0) return false;
  if (mapsWithCourt.length === 1) return mapsWithCourt[0].id === mapId;
  // Legacy rows without facilityMapId: attribute to the first published map that defines this court name.
  return mapsWithCourt[0].id === mapId;
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
          setMaps(ensureDemoFacilityMap(fromRemote));
        } else {
          try {
            const saved = typeof window !== 'undefined' ? localStorage.getItem('jrc_facility_maps_v2') : null;
            if (saved) {
              const parsed = JSON.parse(saved) as unknown;
              const fromLocal = normalizeFacilityMapsPayload(parsed);
              setMaps(ensureDemoFacilityMap(fromLocal));
              if (fromLocal.length > 0) {
                await putAppData(FACILITY_MAPS_KV_KEY, ensureDemoFacilityMap(fromLocal));
              }
              localStorage.removeItem('jrc_facility_maps_v2');
            } else {
              setMaps(ensureDemoFacilityMap([]));
            }
          } catch {
            setMaps(ensureDemoFacilityMap([]));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load maps');
        setMaps(ensureDemoFacilityMap([]));
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

  /** Update one block's status on a single facility map (avoids duplicate ids across maps). */
  const updateBlockStatus = useCallback((mapId: string, courtId: string, status: 'available' | 'maintenance') => {
    setMaps(prev => prev.map(m =>
      m.id !== mapId
        ? m
        : { ...m, blocks: m.blocks.map(b => (b.id === courtId ? { ...b, status } : b)) },
    ));
  }, []);

  /** Remove a court block from one map only */
  const deleteCourtBlock = useCallback((mapId: string, courtId: string) => {
    setMaps(prev => prev.map(m =>
      m.id !== mapId ? m : { ...m, blocks: m.blocks.filter(b => b.id !== courtId) },
    ));
  }, []);

  /* ── Live court status (no hardcoded demo date) ── */
  const getCourtLiveStatus = useCallback((
    courtName: string,
    hour: number,
    bookings: { court: string; date: string; time: string; duration: number; status: string; facilityMapId?: string | null }[],
    mapId?: string,
    selectedDate?: string,
  ): LiveStatus => {
    const publishedMaps = maps.filter((m) => m.isPublished);
    const targetMap = mapId ? maps.find(m => m.id === mapId) : firstPublished;
    const block = targetMap?.blocks.find(b => b.name === courtName);
    if (block?.status === 'maintenance') return 'maintenance';

    const today  = getLocalDateString(new Date());
    const checkDate = selectedDate || today;

    const isOccupied = bookings.some(b => {
      if (b.date !== checkDate) return false;
      if (!bookingOccupiesCourtOnMap(b)) return false;
      if (!bookingAppliesToPublishedMap(b, courtName, mapId, publishedMaps)) return false;

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