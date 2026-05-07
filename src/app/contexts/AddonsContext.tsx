import React, { createContext, useContext, useState, ReactNode } from "react";
import { SPORT_ADDONS as INITIAL_SPORT_ADDONS, AddOn } from "../components/sportsData";

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

export function AddonsProvider({ children }: { children: ReactNode }) {
  const [addonsBySport, setAddonsBySport] = useState<Record<string, AddOn[]>>(INITIAL_SPORT_ADDONS);
  const [customSports, setCustomSports] = useState<SportMeta[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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