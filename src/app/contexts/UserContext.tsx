import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "../utils/supabase/client";

const _TODAY = new Date().toISOString().split('T')[0];

export interface Booking {
  id: string;
  sport: string;
  date: string;
  time: string;
  duration: number;
  court: string;
  status: "pending_payment" | "pending_verification" | "confirmed" | "cancelled" | "rescheduled" | "completed" | "rejected";
  amount: number;
  paymentStatus: "paid" | "pending" | "pending_verification" | "rejected";
  paymentProofUrl?: string;
  createdAt: string;
  customerName?: string;
  customerPhone?: string;
  addOns?: string;
  cancellationRequested?: boolean;
  cancellationReason?: string;
  refCode?: string;
  checkInStatus?: 'none' | 'checked_in';
  checkInTime?: string;
}

export interface CancellationRequest {
  id: string;
  bookingId: string;
  customerId?: string;
  customerName?: string;
  sport?: string;
  court?: string;
  date?: string;
  time?: string;
  reason: string;
  requestedAt?: string;
  createdAt?: string;
  status: "pending" | "approved" | "rejected";
}

export interface Transaction {
  id: string;
  bookingId: string;
  customerName: string;
  amount: number;
  paymentMethod: "gcash" | "bank_transfer" | "cash";
  paymentStatus: "paid" | "pending" | "refunded";
  createdAt: string;
}

export interface CourtRates {
  weekdayDay: number;
  weekdayEvening: number;
  weekendDay: number;
  weekendEvening: number;
}

export interface SystemSettings {
  businessHours: { start: string; end: string };
  bookingDurationMin: number;
  bookingDurationMax: number;
  downpaymentPercentage: number;
  cancellationPolicy: string;
  courtRates: {
    basketball: CourtRates;
    volleyball: CourtRates;
    badminton: { flat: number };
    pickleball: { flat: number };
    billiards: { flat: number };
    tableTennis: { flat: number };
  };
}

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  username: string;
  password?: string;
  role: "admin" | "staff";
  status: "active" | "inactive";
  permissions?: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  favoriteSports: string[];
  loyaltyPoints: number;
  totalBookings: number;
  memberSince: string;
  accountStatus?: "active" | "suspended" | "inactive";
  role?: "user" | "admin" | "staff";
  permissions?: string[];
}

interface UserContextType {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  staffAccounts: StaffAccount[];
  addStaff: (staff: StaffAccount) => void;
  updateStaff: (id: string, updates: Partial<StaffAccount>) => void;
  bookings: Booking[];
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, updates: Partial<Booking>) => void;
  deleteBooking: (id: string) => void;
  isLoggedIn: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  verifyEmailCode: (email: string, code: string) => Promise<{ error: string | null }>;
  resendVerificationCode: (email: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  cancellationRequests: CancellationRequest[];
  addCancellationRequest: (request: CancellationRequest) => void;
  updateCancellationRequest: (id: string, updates: Partial<CancellationRequest>) => void;
  transactions: Transaction[];
  addTransaction: (transaction: Transaction) => void;
  systemSettings: SystemSettings;
  updateSystemSettings: (settings: Partial<SystemSettings>) => void;
  allUsers: UserProfile[];
  updateUser: (id: string, updates: Partial<UserProfile>) => void;
  calcCourtPrice: (sport: string, date: string, time24: string) => number;
  isLoading: boolean;
  error: string | null;
  authFlow: "none" | "password_recovery";
  clearAuthFlow: () => void;
  refreshBookingsFromApi: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authFlow, setAuthFlow] = useState<"none" | "password_recovery">("none");
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<CancellationRequest[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    businessHours: { start: "06:00", end: "23:00" },
    bookingDurationMin: 1,
    bookingDurationMax: 4,
    downpaymentPercentage: 50,
    cancellationPolicy: "Strictly no cancellation once payment is made. Refunds may be issued at admin discretion.",
    courtRates: {
      basketball:  { weekdayDay: 450, weekdayEvening: 750, weekendDay: 550, weekendEvening: 850 },
      volleyball:  { weekdayDay: 450, weekdayEvening: 750, weekendDay: 550, weekendEvening: 850 },
      badminton:   { flat: 300 },
      pickleball:  { flat: 300 },
      billiards:   { flat: 100 },
      tableTennis: { flat: 100 },
    },
  });

  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);

  const refreshBookingsFromApi = useCallback(async () => {
    const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const start = new Date();
    start.setDate(start.getDate() - 14);
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];
    try {
      const res = await fetch(
        `${API_BASE}/api/bookings/calendar?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`
      );
      if (!res.ok) return;
      const list = (await res.json()) as Booking[];
      if (!Array.isArray(list) || list.length === 0) return;
      setBookings((prev) => {
        const byId = new Map(prev.map((b) => [b.id, b]));
        for (const b of list) {
          const cur = byId.get(b.id);
          byId.set(b.id, cur ? { ...cur, ...b } : b);
        }
        return Array.from(byId.values());
      });
    } catch (e) {
      console.error("[UserContext] refreshBookingsFromApi", e);
    }
  }, []);

  // 1. Listen for real Supabase sessions when the app loads
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.full_name || "Real User",
          phone: "+63 000 000 0000",
          favoriteSports: [],
          loyaltyPoints: 0,
          totalBookings: 0,
          memberSince: new Date(session.user.created_at).toISOString().split('T')[0],
          role: "user" 
        });
      }
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setAuthFlow("password_recovery");
      }
      if (event === "SIGNED_OUT") {
        setAuthFlow("none");
      }

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.full_name || "Real User",
          phone: "+63 000 000 0000",
          favoriteSports: [],
          loyaltyPoints: 0,
          totalBookings: 0,
          memberSince: new Date(session.user.created_at).toISOString().split('T')[0],
          role: "user"
        } as UserProfile);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    void refreshBookingsFromApi();
  }, [user?.id, user?.role, refreshBookingsFromApi]);

  const addStaff = (staff: StaffAccount) => {
    setStaffAccounts(prev => [...prev, staff]);
  };

  const updateStaff = (id: string, updates: Partial<StaffAccount>) => {
    setStaffAccounts(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // 2. Hybrid Login Function (Now with hardcoded Staff demo)
  const login = async (email: string, password: string) => {
    if (!email || !password) return { error: "Please fill in all fields" };

    // --- DEMO ACCOUNTS CHECK ---
    const isAdminDemo = email === "admin@jrc.com" && password === "admin123";
    const isUserDemo  = email === "user@jrc.com"  && password === "user123";
    const isStaffDemo = email === "staff@jrc.com" && password === "password123";

    if (isAdminDemo || isUserDemo || isStaffDemo) {
      let role: "admin" | "user" | "staff" = "user";
      let name = "User Demo";
      let id = `user_${email.replace(/[^a-zA-Z0-9]/g, '')}`;

      if (isAdminDemo) { role = "admin"; name = "Admin Demo"; id = "admin_u1"; }
      else if (isStaffDemo) { role = "staff"; name = "Staff Demo"; id = "staff_u1"; }

      setUser({
        id,
        name,
        email,
        phone: "+63 912 345 6789",
        favoriteSports: ["Basketball", "Badminton"],
        loyaltyPoints: 12,
        totalBookings: 12,
        memberSince: "2025-11-15",
        accountStatus: "active",
        role
      });
      return { error: null }; // Success!
    }

    // --- REAL SUPABASE CHECK ---
    // If it's not one of the 3 demo accounts above, try real Supabase Login
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  // 3. Real Supabase Sign Up
  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined
      }
    });
    return { error: error?.message || null };
  };

  const verifyEmailCode = async (email: string, code: string) => {
    const token = code.trim();
    if (!token) return { error: "Please enter the verification code." };

    let { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email"
    });

    // Some projects use signup OTP type for verification.
    if (error) {
      const retry = await supabase.auth.verifyOtp({
        email,
        token,
        type: "signup"
      });
      error = retry.error;
    }

    return { error: error?.message || null };
  };

  const resendVerificationCode = async (email: string) => {
    let { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined
      }
    });

    // Fallback for projects configured around generic email OTP.
    if (error) {
      const retry = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false }
      });
      error = retry.error;
    }

    return { error: error?.message || null };
  };

  // 4. Hybrid Logout
  const logout = async () => {
    await supabase.auth.signOut(); // Clears real session
    setUser(null); // Clears demo session
  };

  // 5. Reset Password
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: typeof window !== "undefined" ? window.location.origin : undefined
    });
    return { error: error?.message || null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message || null };
  };

  const clearAuthFlow = () => setAuthFlow("none");

  const addBooking = (booking: Booking) => {
    setBookings(prev => [booking, ...prev]);
    if (user) {
      setUser({
        ...user,
        totalBookings: user.totalBookings + 1,
        loyaltyPoints: user.loyaltyPoints + 1
      });
    }
  };

  const updateBooking = (id: string, updates: Partial<Booking>) => {
    setBookings(prev => 
      prev.map(booking => 
        booking.id === id ? { ...booking, ...updates } : booking
      )
    );
  };

  const deleteBooking = (id: string) => {
    setBookings(prev => prev.filter(booking => booking.id !== id));
  };

  const addCancellationRequest = (request: CancellationRequest) => {
    setCancellationRequests(prev => [request, ...prev]);
  };

  const updateCancellationRequest = (id: string, updates: Partial<CancellationRequest>) => {
    setCancellationRequests(prev =>
      prev.map(req => req.id === id ? { ...req, ...updates } : req)
    );
  };

  const addTransaction = (transaction: Transaction) => {
    setTransactions(prev => [transaction, ...prev]);
  };

  const updateSystemSettings = (settings: Partial<SystemSettings>) => {
    setSystemSettings(prev => ({ ...prev, ...settings }));
  };

  const updateUser = (id: string, updates: Partial<UserProfile>) => {
    setAllUsers(prev =>
      prev.map(u => u.id === id ? { ...u, ...updates } : u)
    );
  };

  const calcCourtPrice = (sport: string, date: string, time24: string): number => {
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isEvening = parseInt(time24.split(':')[0]) >= 18;

    const sportKey = sport === 'Table Tennis' ? 'tableTennis'
      : sport.toLowerCase() as keyof typeof systemSettings.courtRates;
    const rates = systemSettings.courtRates[sportKey];

    if (!rates) {
      if (sport === 'Basketball' || sport === 'Volleyball')
        return isWeekend ? (isEvening ? 850 : 550) : (isEvening ? 750 : 450);
      if (sport === 'Badminton' || sport === 'Pickleball') return 300;
      return 100;
    }

    if ('flat' in rates) return (rates as { flat: number }).flat;

    const r = rates as CourtRates;
    if (isWeekend) return isEvening ? r.weekendEvening : r.weekendDay;
    return isEvening ? r.weekdayEvening : r.weekdayDay;
  };

  return (
    <UserContext.Provider value={{
      user,
      setUser,
      staffAccounts,
      addStaff,
      updateStaff,
      bookings,
      addBooking,
      updateBooking,
      deleteBooking,
      isLoggedIn: !!user,
      isAdmin: user?.role === "admin" || user?.email === "admin@jrc.com",
      isStaff: user?.role === "staff" || user?.email === "staff@jrc.com",
      login,
      signUp,
      verifyEmailCode,
      resendVerificationCode,
      logout,
      resetPassword,
      updatePassword,
      cancellationRequests,
      addCancellationRequest,
      updateCancellationRequest,
      transactions,
      addTransaction,
      systemSettings,
      updateSystemSettings,
      allUsers,
      updateUser,
      calcCourtPrice,
      isLoading,
      error,
      authFlow,
      clearAuthFlow,
      refreshBookingsFromApi
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser context is missing! The provider might have failed to mount or the app crashed. Check App.tsx.");
  }
  return context;
}