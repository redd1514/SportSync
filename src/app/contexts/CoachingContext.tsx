import React, { createContext, useContext, useState, ReactNode } from "react";

export interface Coach {
  id: string;
  name: string;
  email?: string;       // matches user email for accepted coach applications
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
  addCoach: (coach: Omit<Coach, "id">) => void;
  updateCoach: (id: string, data: Partial<Coach>) => void;
  deleteCoach: (id: string) => void;
  findCoachByEmail: (email: string) => Coach | undefined;
  isLoading: boolean;
  error: string | null;
}

const DEFAULT_CONTEXT: CoachingContextType = {
  coaches: [],
  requests: [],
  activeRequestId: null,
  setActiveRequestId: () => {},
  addRequest: () => "",
  updateRequestStatus: () => {},
  addCoach: () => {},
  updateCoach: () => {},
  deleteCoach: () => {},
  findCoachByEmail: () => undefined,
  isLoading: false,
  error: null,
};

const CoachingContext = createContext<CoachingContextType | undefined>(undefined);

const MOCK_COACHES: Coach[] = [];

const MOCK_REQUESTS: CoachingRequest[] = [];

export function CoachingProvider({ children }: { children: ReactNode }) {
  const [coaches, setCoaches] = useState<Coach[]>(MOCK_COACHES);
  const [requests, setRequests] = useState<CoachingRequest[]>(MOCK_REQUESTS);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRequest = (req: Omit<CoachingRequest, "id" | "status">) => {
    const newReq: CoachingRequest = {
      ...req,
      id: `r${Date.now()}`,
      status: "pending",
    };
    setRequests(prev => [newReq, ...prev]);
    return newReq.id;
  };

  const updateRequestStatus = (id: string, status: "pending" | "pending_verification" | "confirmed" | "rejected" | string, linkedBookingId?: string, paymentProofUrl?: string) => {
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: status as any, ...(linkedBookingId && { linkedBookingId }), ...(paymentProofUrl && { paymentProofUrl }) } : r));
  };

  const addCoach = (coach: Omit<Coach, "id">) => {
    setCoaches([...coaches, { ...coach, id: `c${Date.now()}` }]);
  };

  const updateCoach = (id: string, data: Partial<Coach>) => {
    setCoaches(coaches.map(c => c.id === id ? { ...c, ...data } : c));
  };

  const deleteCoach = (id: string) => {
    setCoaches(coaches.filter(c => c.id !== id));
  };

  const findCoachByEmail = (email: string) => coaches.find(c => c.email === email);

  return (
    <CoachingContext.Provider value={{
      coaches, requests, addRequest, updateRequestStatus, addCoach, updateCoach, deleteCoach, activeRequestId, setActiveRequestId, findCoachByEmail, isLoading, error
    }}>
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