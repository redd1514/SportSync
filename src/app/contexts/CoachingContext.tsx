import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getApiBaseUrl } from "../utils/apiBase";
import { fetchAppData, putAppData } from "../utils/appDataClient";

const COACHING_REQUESTS_STORAGE_KEY = "sportsync_coaching_requests";
const COACHING_REQUESTS_KV_KEY = "coaching_requests";

function readLegacyStoredRequests(): CoachingRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COACHING_REQUESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CoachingRequest[]) : [];
  } catch {
    return [];
  }
}

/** Ensures API / legacy payloads always match Coach shape (avoids undefined arrays). */
export function normalizeCoach(c: Partial<Coach> & Record<string, unknown>): Coach {
  return {
    id: String(c.id ?? ""),
    name: String(c.name ?? ""),
    email: typeof c.email === "string" ? c.email : undefined,
    sport: String(c.sport ?? "Sports"),
    hourlyRate: Number(c.hourlyRate ?? 0) || 0,
    description: String(c.description ?? ""),
    availableDays: Array.isArray(c.availableDays) ? (c.availableDays as string[]) : [],
    timeRange: String(c.timeRange ?? ""),
    isAvailable: c.isAvailable !== false,
    image: typeof c.image === "string" ? c.image : undefined,
  };
}

export interface Coach {
  id: string;
  name: string;
  email?: string;
  sport: string;
  hourlyRate: number;
  description: string;
  availableDays: string[];
  timeRange: string;
  isAvailable: boolean;
  image?: string;
}

export interface CoachingRequest {
  id: string;
  userId: string;
  userName: string;
  coachId: string;
  coachName: string;
  sport: string;
  requestedDate: string;
  requestedTime: string;
  message: string;
  status: "pending" | "pending_verification" | "confirmed" | "rejected";
  paymentProofUrl?: string;
  linkedBookingId?: string;
}

interface CoachingContextType {
  coaches: Coach[];
  requests: CoachingRequest[];
  activeRequestId: string | null;
  setActiveRequestId: (id: string | null) => void;
  addRequest: (req: Omit<CoachingRequest, "id" | "status">) => string;
  updateRequestStatus: (id: string, status: "pending" | "pending_verification" | "confirmed" | "rejected" | string, linkedBookingId?: string, paymentProofUrl?: string) => void;
  addCoach: (coach: Omit<Coach, "id">) => Promise<void>;
  updateCoach: (id: string, data: Partial<Coach>) => Promise<void>;
  deleteCoach: (id: string) => Promise<void>;
  refreshCoaches: () => Promise<void>;
  findCoachByEmail: (email: string) => Coach | undefined;
  isLoading: boolean;
  error: string | null;
}

const CoachingContext = createContext<CoachingContextType | undefined>(undefined);

export function CoachingProvider({ children }: { children: ReactNode }) {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [requests, setRequests] = useState<CoachingRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestsBootstrapped, setRequestsBootstrapped] = useState(false);

  const refreshCoaches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/coaches`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to load coaches");
      setCoaches(Array.isArray(data) ? (data as Record<string, unknown>[]).map((row) => normalizeCoach(row)) : []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load coaches";
      setError(msg);
      setCoaches([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem("sportsync_coaches");
    } catch {
      /* legacy client-only cache; coaches now load from API */
    }
    refreshCoaches();
  }, [refreshCoaches]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await fetchAppData<CoachingRequest[]>(COACHING_REQUESTS_KV_KEY);
        if (cancelled) return;
        if (Array.isArray(remote) && remote.length > 0) {
          setRequests(remote);
        } else {
          const legacy = readLegacyStoredRequests();
          if (legacy.length > 0) {
            setRequests(legacy);
            await putAppData(COACHING_REQUESTS_KV_KEY, legacy);
            try {
              localStorage.removeItem(COACHING_REQUESTS_STORAGE_KEY);
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* offline / API down — leave requests as [] */
      } finally {
        if (!cancelled) setRequestsBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!requestsBootstrapped) return;
    const t = window.setTimeout(() => {
      void putAppData(COACHING_REQUESTS_KV_KEY, requests);
    }, 500);
    return () => window.clearTimeout(t);
  }, [requests, requestsBootstrapped]);

  const addRequest = (req: Omit<CoachingRequest, "id" | "status">) => {
    const newReq: CoachingRequest = {
      ...req,
      id: `r${Date.now()}`,
      status: "pending",
    };
    setRequests((prev) => [newReq, ...prev]);
    return newReq.id;
  };

  const updateRequestStatus = (
    id: string,
    status: "pending" | "pending_verification" | "confirmed" | "rejected" | string,
    linkedBookingId?: string,
    paymentProofUrl?: string
  ) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: status as CoachingRequest["status"],
              ...(linkedBookingId && { linkedBookingId }),
              ...(paymentProofUrl && { paymentProofUrl }),
            }
          : r
      )
    );
  };

  const addCoach = async (coach: Omit<Coach, "id">) => {
    setError(null);
    const res = await fetch(`${getApiBaseUrl()}/api/coaches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: coach.name,
        email: coach.email,
        sport: coach.sport,
        hourlyRate: coach.hourlyRate,
        description: coach.description,
        availableDays: coach.availableDays,
        timeRange: coach.timeRange,
        isAvailable: coach.isAvailable,
        image: coach.image,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to create coach");
    const created = normalizeCoach(data as Record<string, unknown>);
    setCoaches((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
  };

  const updateCoach = async (id: string, data: Partial<Coach>) => {
    setError(null);
    const res = await fetch(`${getApiBaseUrl()}/api/coaches/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        sport: data.sport,
        hourlyRate: data.hourlyRate,
        description: data.description,
        availableDays: data.availableDays,
        timeRange: data.timeRange,
        isAvailable: data.isAvailable,
        image: data.image,
      }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((payload as { error?: string }).error || "Failed to update coach");
    const updated = normalizeCoach({ ...(payload as Record<string, unknown>), id });
    setCoaches((prev) => prev.map((c) => (c.id === id ? updated : c)));
  };

  const deleteCoach = async (id: string) => {
    setError(null);
    const res = await fetch(`${getApiBaseUrl()}/api/coaches/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to delete coach");
    await refreshCoaches();
  };

  const findCoachByEmail = (email: string) => coaches.find((c) => c.email === email);

  return (
    <CoachingContext.Provider
      value={{
        coaches,
        requests,
        addRequest,
        updateRequestStatus,
        addCoach,
        updateCoach,
        deleteCoach,
        refreshCoaches,
        activeRequestId,
        setActiveRequestId,
        findCoachByEmail,
        isLoading,
        error,
      }}
    >
      {children}
    </CoachingContext.Provider>
  );
}

export function useCoaching() {
  const context = useContext(CoachingContext);
  if (context === undefined) {
    throw new Error("useCoaching must be used within CoachingProvider");
  }
  return context;
}
