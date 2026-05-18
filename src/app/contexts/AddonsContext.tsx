import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { SPORT_ADDONS as INITIAL_SPORT_ADDONS, AddOn } from "../components/sportsData";
import { fetchAppData, putAppData } from "../utils/appDataClient";
import { apiFetch } from "../utils/authenticatedFetch";

const SPORT_ADDONS_KV_KEY = "sport_addons_v1";

export interface SportMeta {
  name: string;
  color: string;
  pricingType: 'flat' | 'tiered';
  flatPrice?: number;
  priceLabel: string;
}

interface AddonsContextType {
  addonsBySport: Record<string, AddOn[]>;
  updateAddon: (sport: string, id: string, data: Partial<AddOn>) => void;
  addAddon: (sport: string, addon: AddOn) => void;
  deleteAddon: (sport: string, id: string) => void;
  /** Custom sports added by admin */
  customSports: SportMeta[];
  addCustomSport: (sport: SportMeta) => void;
  deleteCustomSport: (name: string) => void;
  /** All sports (default + custom) */
  allSportNames: string[];
  isLoading: boolean;
  error: string | null;
}

const AddonsContext = createContext<AddonsContextType | null>(null);

function mergeAddonsFromRemote(
  remote: Record<string, AddOn[]>,
): Record<string, AddOn[]> {
  const merged: Record<string, AddOn[]> = { ...INITIAL_SPORT_ADDONS };
  for (const k of Object.keys(merged)) {
    if (remote[k] && Array.isArray(remote[k])) merged[k] = remote[k];
  }
  for (const k of Object.keys(remote)) {
    if (!merged[k]) merged[k] = remote[k];
  }
  return merged;
}

export function AddonsProvider({ children }: { children: ReactNode }) {
  const [addonsBySport, setAddonsBySport] = useState<Record<string, AddOn[]>>(INITIAL_SPORT_ADDONS);
  const [customSports, setCustomSports] = useState<SportMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kvReady, setKvReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const remote = await fetchAppData<{ addonsBySport?: Record<string, AddOn[]>; customSports?: SportMeta[] }>(
          SPORT_ADDONS_KV_KEY,
        );
        if (cancelled) return;
        if (remote && typeof remote.addonsBySport === "object" && remote.addonsBySport !== null) {
          setAddonsBySport(mergeAddonsFromRemote(remote.addonsBySport));
        }
        if (remote && Array.isArray(remote.customSports)) {
          setCustomSports(remote.customSports);
          for (const sport of remote.customSports) {
            if (!sport?.name) continue;
            void apiFetch('/api/admin/sports', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: sport.name, description: `${sport.name} courts` }),
            }).catch(() => undefined);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load add-ons");
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setKvReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!kvReady) return;
    const t = window.setTimeout(() => {
      void putAppData(SPORT_ADDONS_KV_KEY, { addonsBySport, customSports });
    }, 650);
    return () => window.clearTimeout(t);
  }, [addonsBySport, customSports, kvReady]);

  const updateAddon = (sport: string, id: string, data: Partial<AddOn>) => {
    setAddonsBySport(prev => {
      const sportAddons = prev[sport] || [];
      return { ...prev, [sport]: sportAddons.map(a => a.id === id ? { ...a, ...data } : a) };
    });
  };

  const addAddon = (sport: string, addon: AddOn) => {
    setAddonsBySport(prev => {
      const sportAddons = prev[sport] || [];
      return { ...prev, [sport]: [...sportAddons, addon] };
    });
  };

  const deleteAddon = (sport: string, id: string) => {
    setAddonsBySport(prev => {
      const sportAddons = prev[sport] || [];
      return { ...prev, [sport]: sportAddons.filter(a => a.id !== id) };
    });
  };

  const addCustomSport = (sport: SportMeta) => {
    setCustomSports(prev => [...prev, sport]);
    setAddonsBySport(prev => ({ ...prev, [sport.name]: [] }));
    void apiFetch('/api/admin/sports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sport.name, description: `${sport.name} courts` }),
    }).catch((e: unknown) => {
      console.warn('[Addons] Could not persist sport to database:', e instanceof Error ? e.message : e);
    });
  };

  const deleteCustomSport = (name: string) => {
    setCustomSports(prev => prev.filter(s => s.name !== name));
    setAddonsBySport(prev => { const n = { ...prev }; delete n[name]; return n; });
  };

  const DEFAULT_SPORTS = ['Basketball', 'Volleyball', 'Badminton', 'Pickleball', 'Billiards', 'Table Tennis'];
  const allSportNames = [...DEFAULT_SPORTS, ...customSports.map(s => s.name)];

  return (
    <AddonsContext.Provider value={{
      addonsBySport, updateAddon, addAddon, deleteAddon,
      customSports, addCustomSport, deleteCustomSport, allSportNames,
      isLoading, error
    }}>
      {children}
    </AddonsContext.Provider>
  );
}

export const useAddons = () => {
  const ctx = useContext(AddonsContext);
  if (!ctx) throw new Error("useAddons must be used within an AddonsProvider");
  return ctx;
};