export const DEMO_USER_STORAGE_KEY = "sportsync_demo_user";
export const DEMO_USER_LOGGED_OUT_KEY = "sportsync_demo_user_logged_out";

/** Serializable user snapshot for reload after external redirects (e.g. PayMongo). */
export type PersistedUserProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  favoriteSports: string[];
  loyaltyPoints: number;
  totalBookings: number;
  memberSince: string;
  accountStatus?: "active" | "suspended" | "inactive";
  role?: "user" | "admin" | "staff" | "coach";
};

export type PersistedDemoSession = {
  profile: PersistedUserProfile;
  /** Original demo auth id used for API token exchange (e.g. user_userjrccom) */
  demoAuthId: string;
};

export function persistDemoSession(profile: PersistedUserProfile, demoAuthId: string) {
  try {
    localStorage.removeItem(DEMO_USER_LOGGED_OUT_KEY);
    const payload: PersistedDemoSession = { profile, demoAuthId };
    localStorage.setItem(DEMO_USER_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readPersistedDemoSession(): PersistedDemoSession | null {
  try {
    if (localStorage.getItem(DEMO_USER_LOGGED_OUT_KEY) === "1") return null;
    const raw = localStorage.getItem(DEMO_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedDemoSession;
    if (!parsed?.profile?.email || !parsed?.profile?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Logout: prevent auto-restore until next explicit demo login */
export function clearPersistedDemoSession() {
  try {
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    localStorage.setItem(DEMO_USER_LOGGED_OUT_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** Real Supabase login: drop demo snapshot without blocking future demo login */
export function removePersistedDemoStorage() {
  try {
    localStorage.removeItem(DEMO_USER_STORAGE_KEY);
    localStorage.removeItem(DEMO_USER_LOGGED_OUT_KEY);
  } catch {
    /* ignore */
  }
}
