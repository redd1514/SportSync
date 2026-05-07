import { createContext, useContext, useState, ReactNode } from "react";

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
  login: (email: string, password: string) => boolean;
  logout: () => void;
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
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const addStaff = (staff: StaffAccount) => {
    setStaffAccounts(prev => [...prev, staff]);
  };

  const updateStaff = (id: string, updates: Partial<StaffAccount>) => {
    setStaffAccounts(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const login = (email: string, password: string): boolean => {
    if (email && password && email.length > 0 && password.length > 0) {
      // Check staff account
      const staffAccount = staffAccounts.find(s => (s.email === email || s.username === email) && s.password === password);
      
      let demoUser: UserProfile;
      if (staffAccount) {
        demoUser = {
          id: staffAccount.id,
          name: staffAccount.name,
          email: staffAccount.email,
          phone: "+63 000 000 0000",
          favoriteSports: [],
          loyaltyPoints: 0,
          totalBookings: 0,
          memberSince: new Date().toISOString().split('T')[0],
          accountStatus: staffAccount.status,
          role: staffAccount.role,
          permissions: staffAccount.permissions
        };
      } else {
        const isAdmin = email === "admin@jrc.com";
        // Use consistent IDs based on email so state isn't lost across logins in demo
        const demoUserId = isAdmin ? "admin_u1" : `user_${email.replace(/[^a-zA-Z0-9]/g, '')}`;
        demoUser = {
          id: demoUserId,
          name: isAdmin ? "Admin User" : email.split('@')[0] || "User",
          email: email,
          phone: "+63 912 345 6789",
          favoriteSports: ["Basketball", "Badminton"],
          loyaltyPoints: 12,
          totalBookings: 12,
          memberSince: "2025-11-15",
          accountStatus: "active",
          role: isAdmin ? "admin" : "user"
        };
      }
      setUser(demoUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

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
    const dayOfWeek = new Date(date + 'T00:00:00').getDay(); // 0=Sun, 6=Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isEvening = parseInt(time24.split(':')[0]) >= 18;

    const sportKey = sport === 'Table Tennis' ? 'tableTennis'
      : sport.toLowerCase() as keyof typeof systemSettings.courtRates;
    const rates = systemSettings.courtRates[sportKey];

    if (!rates) {
      // Default fallback
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
      isStaff: user?.role === "staff",
      login,
      logout,
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
      error
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