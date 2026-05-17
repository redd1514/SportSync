import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { apiFetch } from "../utils/authenticatedFetch";
import { fetchAppData, putAppData } from "../utils/appDataClient";
import { useUser } from "./UserContext";

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

function parseAcceptanceDetails(adminNotes?: string): Partial<CoachingRequest> {
  if (!adminNotes) return {};
  const match = adminNotes.match(/COACHING_ACCEPTANCE:(\{.*\})/s);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    return {
      linkedBookingId: typeof parsed.linkedBookingId === "string" ? parsed.linkedBookingId : undefined,
      courtName: typeof parsed.court === "string" ? parsed.court : undefined,
      courtAmount: typeof parsed.courtAmount === "number" ? parsed.courtAmount : undefined,
      coachFee: typeof parsed.coachFee === "number" ? parsed.coachFee : undefined,
      totalAmount: typeof parsed.totalDue === "number" ? parsed.totalDue : undefined,
    };
  } catch {
    return {};
  }
}

function parseReviewDetails(adminNotes?: string): Partial<CoachingRequest> {
  if (!adminNotes) return {};
  const match = adminNotes.match(/COACHING_REVIEW:(\{.*\})/s);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    return {
      rating: typeof parsed.rating === "number" ? parsed.rating : undefined,
      reviewComment: typeof parsed.comment === "string" ? parsed.comment : undefined,
      reviewedAt: typeof parsed.reviewedAt === "string" ? parsed.reviewedAt : undefined,
    };
  } catch {
    return {};
  }
}

function parseRescheduleDetails(adminNotes?: string): Partial<CoachingRequest> {
  if (!adminNotes || !/COACHING_RESCHEDULE_(REQUESTED|PROPOSED)/i.test(adminNotes)) return {};
  const proposalMatches = [...adminNotes.matchAll(/COACHING_RESCHEDULE_PROPOSED:(\{.*?\})(?=\n[A-Z_]+:|$)/gs)];
  const proposalMatch = proposalMatches[proposalMatches.length - 1];
  const decisionMatches = [...adminNotes.matchAll(/COACHING_RESCHEDULE_(ACCEPTED|REJECTED):(\{.*?\})(?=\n[A-Z_]+:|$)/gs)];
  const decisionMatch = decisionMatches[decisionMatches.length - 1];
  if (proposalMatch) {
    try {
      const parsed = JSON.parse(proposalMatch[1]) as Record<string, unknown>;
      const decision = decisionMatch
        ? {
            status: String(decisionMatch[1]).toLowerCase() as "accepted" | "rejected",
            decidedAt: typeof JSON.parse(decisionMatch[2]).decidedAt === "string" ? JSON.parse(decisionMatch[2]).decidedAt : undefined,
          }
        : undefined;
      return {
        status: decision ? "confirmed" : "reschedule_requested",
        rescheduleProposal: {
          requestedDate: typeof parsed.requestedDate === "string" ? parsed.requestedDate : "",
          requestedTime: typeof parsed.requestedTime === "string" ? parsed.requestedTime : "",
          requestedEndTime: typeof parsed.requestedEndTime === "string" ? parsed.requestedEndTime : undefined,
          reason: typeof parsed.reason === "string" ? parsed.reason : "",
          requestedAt: typeof parsed.requestedAt === "string" ? parsed.requestedAt : undefined,
          status: decision?.status || "pending",
          decidedAt: decision?.decidedAt,
        },
      };
    } catch {
      return { status: "reschedule_requested" };
    }
  }
  const match = adminNotes.match(/COACHING_RESCHEDULE_REQUESTED:(\{.*\})/s);
  if (!match) return { status: "reschedule_requested" };
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    return {
      status: "reschedule_requested",
      rescheduleReason: typeof parsed.reason === "string" ? parsed.reason : undefined,
      rescheduleRequestedAt: typeof parsed.requestedAt === "string" ? parsed.requestedAt : undefined,
    };
  } catch {
    return { status: "reschedule_requested" };
  }
}

function parseLinkedBooking(notes?: string): Partial<CoachingRequest> {
  if (!notes) return {};
  const match = notes.match(/linked_booking:([0-9a-f-]+)/i);
  return match ? { linkedBookingId: match[1] } : {};
}

function parseReservedBookingDetails(notes?: string): Partial<CoachingRequest> {
  if (!notes) return {};
  const match = notes.match(/COACHING_BOOKING:(\{.*\})/s);
  if (!match) return {};
  try {
    const parsed = JSON.parse(match[1]) as Record<string, unknown>;
    return {
      courtName: typeof parsed.court === "string" ? parsed.court : undefined,
      courtAmount: typeof parsed.courtAmount === "number" ? parsed.courtAmount : undefined,
      coachFee: typeof parsed.coachFee === "number" ? parsed.coachFee : undefined,
      totalAmount: typeof parsed.totalDue === "number" ? parsed.totalDue : undefined,
    };
  } catch {
    return {};
  }
}

/** Maps `GET /api/coaching-sessions` DB rows (snake_case) into UI `CoachingRequest` shape.
 * DB statuses: pending | approved | rejected | cancelled
 * UI statuses: pending | confirmed | reschedule_requested | rejected | completed
 */
export function mapSessionApiRowToCoachingRequest(row: Record<string, unknown>): CoachingRequest {
  const notes = typeof row.notes === "string" ? row.notes : "";
  const adminNotes =
    typeof row.admin_notes === "string"
      ? row.admin_notes
      : typeof row.adminNotes === "string"
        ? row.adminNotes
        : undefined;

  const dbStatus = String(row.status || "pending");
  let status: CoachingRequest["status"] = "pending";
  if (/COACHING_CHECKED_OUT|checked_out:/i.test(adminNotes || "") || dbStatus === "completed") {
    status = "completed";
  } else if (/PAYMENT_VERIFIED|COACHING_CHECKED_IN|checked_in:/i.test(adminNotes || "")) {
    status = "ongoing";
  } else if (/COACHING_RESCHEDULE_(REQUESTED|PROPOSED)/i.test(adminNotes || "") && !/COACHING_RESCHEDULE_(ACCEPTED|REJECTED)/i.test(adminNotes || "") || dbStatus === "reschedule_requested") {
    status = "reschedule_requested";
  } else if (dbStatus === "ongoing") {
    status = "ongoing";
  } else if (dbStatus === "approved" || dbStatus === "confirmed" || dbStatus === "scheduled") {
    status = "confirmed";
  } else if (dbStatus === "rejected" || dbStatus === "cancelled") {
    status = "rejected";
  }

  // Compute duration from start/end if duration_hours not set
  let durationHours: number | undefined;
  if (typeof row.duration_hours === "number") {
    durationHours = row.duration_hours;
  } else if (row.start_time && row.end_time) {
    const [sh, sm] = String(row.start_time).split(":").map(Number);
    const [eh, em] = String(row.end_time).split(":").map(Number);
    durationHours = Math.round(((eh * 60 + em) - (sh * 60 + sm)) / 60);
  }

  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? row.userId ?? ""),
    userName: typeof row.userName === "string" ? row.userName : String(row.user_name ?? "User"),
    coachId: String(row.coach_id ?? row.coachId ?? ""),
    coachName: typeof row.coachName === "string" ? row.coachName : String(row.coach_name ?? "Coach"),
    sport: typeof row.sport === "string" ? row.sport : "Sports",
    requestedDate: String(row.session_date ?? row.requestedDate ?? ""),
    requestedTime: String(row.start_time ?? row.requestedTime ?? ""),
    endTime: row.end_time ? String(row.end_time) : undefined,
    message: (typeof row.message === "string" ? row.message : notes)
      .replace(/COACHING_BOOKING:\{.*\}/s, "")
      .replace(/linked_booking:[0-9a-f-]+/i, "")
      .trim(),
    adminNotes,
    durationHours,
    ...parseLinkedBooking(notes),
    ...parseReservedBookingDetails(notes),
    ...parseAcceptanceDetails(adminNotes),
    ...parseReviewDetails(adminNotes),
    ...parseRescheduleDetails(adminNotes),
    courtId: typeof row.courtId === "string" ? row.courtId : typeof row.court_id === "string" ? row.court_id : undefined,
    courtName: String(row.courtName || row.court_name || parseReservedBookingDetails(notes).courtName || parseAcceptanceDetails(adminNotes).courtName || ""),
    courtAmount: row.courtAmount != null ? Number(row.courtAmount) : row.court_amount != null ? Number(row.court_amount) : parseReservedBookingDetails(notes).courtAmount,
    coachFee: row.coachFee != null ? Number(row.coachFee) : row.coach_fee != null ? Number(row.coach_fee) : parseReservedBookingDetails(notes).coachFee,
    totalAmount: row.totalAmount != null ? Number(row.totalAmount) : row.total_amount != null ? Number(row.total_amount) : parseReservedBookingDetails(notes).totalAmount,
    downpaymentAmount: row.downpaymentAmount != null ? Number(row.downpaymentAmount) : row.downpayment_amount != null ? Number(row.downpayment_amount) : undefined,
    downpaymentPercentage: row.downpaymentPercentage != null ? Number(row.downpaymentPercentage) : row.downpayment_percentage != null ? Number(row.downpayment_percentage) : undefined,
    balanceDue: row.balanceDue != null ? Number(row.balanceDue) : row.balance_due != null ? Number(row.balance_due) : undefined,
    coachCourtQr: typeof row.coachCourtQr === "string" ? row.coachCourtQr : typeof row.coach_court_qr === "string" ? row.coach_court_qr : undefined,
    pendingLinkedBookingChange: row.pendingLinkedBookingChange as CoachingRequest["pendingLinkedBookingChange"] | undefined,
    status,
    viewerIsStudent: row.viewerIsStudent as boolean | undefined,
    viewerIsCoachForThisSession: row.viewerIsCoachForThisSession as boolean | undefined,
  };
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
  endTime?: string;
  message: string;
  adminNotes?: string;
  durationHours?: number;
  linkedBookingId?: string;
  courtName?: string;
  courtId?: string;
  courtAmount?: number;
  coachFee?: number;
  totalAmount?: number;
  downpaymentAmount?: number;
  downpaymentPercentage?: number;
  balanceDue?: number;
  coachCourtQr?: string;
  pendingLinkedBookingChange?: {
    type: 'cancellation' | 'reschedule' | string;
    requestedDate?: string | null;
    requestedStartTime?: string | null;
    requestedEndTime?: string | null;
  } | null;
  coachingMessage?: string;
  rating?: number;
  reviewComment?: string;
  reviewedAt?: string;
  rescheduleReason?: string;
  rescheduleRequestedAt?: string;
  rescheduleProposal?: {
    requestedDate: string;
    requestedTime: string;
    requestedEndTime?: string;
    reason?: string;
    requestedAt?: string;
    status: "pending" | "accepted" | "rejected";
    decidedAt?: string;
  };
  /** pending = unpaid/unverified legacy request | confirmed = paid ticket active | reschedule_requested = coach requested schedule help | rejected = cancelled/refunded | completed = checked out */
  status: "pending" | "confirmed" | "ongoing" | "reschedule_requested" | "rejected" | "completed";
  /** Set by GET /api/users/:id/coaching-sessions — prefer over client-side coachId matching */
  viewerIsStudent?: boolean;
  viewerIsCoachForThisSession?: boolean;
}

interface CoachingContextType {
  coaches: Coach[];
  requests: CoachingRequest[];
  activeRequestId: string | null;
  setActiveRequestId: (id: string | null) => void;
  addRequest: (req: Omit<CoachingRequest, "id" | "status">) => Promise<string>;
  updateRequestStatus: (id: string, status: "pending" | "confirmed" | "rejected" | "cancelled" | "completed", adminNotes?: string) => Promise<void>;
  submitCoachReview: (id: string, rating: number, comment?: string) => Promise<void>;
  addCoach: (coach: Omit<Coach, "id">) => Promise<void>;
  updateCoach: (id: string, data: Partial<Coach>) => Promise<void>;
  deleteCoach: (id: string) => Promise<void>;
  refreshCoaches: () => Promise<void>;
  refreshRequests: () => Promise<void>;
  findCoachByEmail: (email: string) => Coach | undefined;
  isLoading: boolean;
  error: string | null;
}

const CoachingContext = createContext<CoachingContextType | undefined>(undefined);

export function CoachingProvider({ children }: { children: ReactNode }) {
  const { user } = useUser();
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [requests, setRequests] = useState<CoachingRequest[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestsBootstrapped, setRequestsBootstrapped] = useState(false);

  const roleCoachProfile = useMemo<Coach | undefined>(() => {
    if (user?.role !== "coach" || !user.email) return undefined;
    if (user.email.trim().toLowerCase() !== "coach@jrc.com") return undefined;
    const existing = coaches.find((c) => c.email?.trim().toLowerCase() === user.email.trim().toLowerCase());
    if (existing) return existing;
    return {
      id: user.id || "coach-profile",
      name: user.name || "Coach",
      email: user.email,
      sport: "Table Tennis",
      hourlyRate: 800,
      description: "Your coach profile is active. Admin can update your sport, rate, schedule, and bio in Coaching Management.",
      availableDays: [],
      timeRange: "08:00 AM - 06:00 PM",
      isAvailable: true,
    };
  }, [coaches, user?.email, user?.id, user?.name, user?.role]);

  const visibleCoaches = useMemo(() => {
    if (!roleCoachProfile) return coaches;
    return coaches.some((c) => c.email?.trim().toLowerCase() === roleCoachProfile.email?.trim().toLowerCase())
      ? coaches
      : [roleCoachProfile, ...coaches];
  }, [coaches, roleCoachProfile]);

  const refreshCoaches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/coaches`);
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

  const refreshRequests = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    try {
      const res = await apiFetch(`/api/users/${encodeURIComponent(user.id)}/coaching-sessions`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to load coaching sessions');
      setRequests(Array.isArray(data) ? (data as Record<string, unknown>[]).map((row) => mapSessionApiRowToCoachingRequest(row)) : []);
    } catch (e: unknown) {
      const legacy = readLegacyStoredRequests();
      if (legacy.length > 0) setRequests(legacy);
      const msg = e instanceof Error ? e.message : "Failed to load coaching sessions";
      setError(msg);
    } finally {
      setRequestsBootstrapped(true);
    }
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try to fetch from database API first
        const res = await apiFetch(user?.id ? `/api/users/${encodeURIComponent(user.id)}/coaching-sessions` : `/api/coaching-sessions`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        
        if (cancelled) return;
        if (Array.isArray(data) && data.length > 0) {
          setRequests((data as Record<string, unknown>[]).map((row) => mapSessionApiRowToCoachingRequest(row)));
        }
        // If no data from API, try legacy storage
        const legacy = readLegacyStoredRequests();
        if (legacy.length > 0 && (!Array.isArray(data) || data.length === 0)) {
          setRequests(legacy);
        }
      } catch {
        /* offline / API down — try legacy storage */
        const legacy = readLegacyStoredRequests();
        if (legacy.length > 0) {
          setRequests(legacy);
        }
      } finally {
        if (!cancelled) setRequestsBootstrapped(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onRefresh = () => {
      void refreshRequests();
      void refreshCoaches();
    };
    window.addEventListener("sportsync:coaching-refresh", onRefresh);
    window.addEventListener("sportsync:notifications-refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener("sportsync:coaching-refresh", onRefresh);
      window.removeEventListener("sportsync:notifications-refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [refreshCoaches, refreshRequests]);

  // Note: KV store sync removed - coaching sessions now persisted in database
  // useEffect(() => {
  //   if (!requestsBootstrapped) return;
  //   const t = window.setTimeout(() => {
  //     void putAppData(COACHING_REQUESTS_KV_KEY, requests);
  //   }, 500);
  //   return () => window.clearTimeout(t);
  // }, [requests, requestsBootstrapped]);

  const addRequest = async (req: Omit<CoachingRequest, "id" | "status">): Promise<string> => {
    try {
      // Parse start time — supports both "14:00:00" (24h) and "2:00 PM" (12h) formats
      let startHour = 9, startMin = 0;
      const timeStr = req.requestedTime || "09:00";
      if (timeStr.includes("AM") || timeStr.includes("PM")) {
        const [time, ampm] = timeStr.split(" ");
        let [h, m] = time.split(":").map(Number);
        if (ampm === "PM" && h < 12) h += 12;
        if (ampm === "AM" && h === 12) h = 0;
        startHour = h; startMin = m || 0;
      } else {
        const parts = timeStr.split(":").map(Number);
        startHour = parts[0] || 9; startMin = parts[1] || 0;
      }

      const dur = req.durationHours || 1;
      const endHour = Math.min(startHour + Math.floor(dur), 23);
      const endMin = startMin + Math.round((dur % 1) * 60);

      const pad = (n: number) => String(n).padStart(2, "0");
      const startTime = `${pad(startHour)}:${pad(startMin)}:00`;
      const endTime = `${pad(endHour)}:${pad(endMin > 59 ? endMin - 60 : endMin)}:00`;

      const res = await apiFetch(`/api/coaching-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coach_id: req.coachId,
          user_id: req.userId,
          session_date: req.requestedDate,
          start_time: startTime,
          end_time: endTime,
          status: 'pending',
          linked_booking_id: req.linkedBookingId,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to create coaching session');

      const newReq: CoachingRequest = {
        id: (data as { id?: string }).id || `r${Date.now()}`,
        userId: req.userId,
        userName: req.userName,
        coachId: req.coachId,
        coachName: req.coachName,
        sport: req.sport,
        requestedDate: req.requestedDate,
        requestedTime: req.requestedTime,
        endTime: endTime,
        message: req.message || '',
        durationHours: dur,
        status: 'pending',
      };

      setRequests((prev) => [newReq, ...prev]);
      window.dispatchEvent(new Event('sportsync:notifications-refresh'));
      return newReq.id;
    } catch (error) {
      console.error('Error creating coaching session:', error);
      throw error;
    }
  };

  const updateRequestStatus = async (
    id: string,
    status: "pending" | "confirmed" | "rejected" | "cancelled" | "completed",
    adminNotes?: string,
  ): Promise<void> => {
    try {
      const res = await apiFetch(`/api/coaching-sessions/${encodeURIComponent(id)}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, admin_notes: adminNotes, staff_id: user?.id }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to update session status');

      // Optimistically update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status:
                  status === 'completed'
                    ? 'completed'
                    : /PAYMENT_VERIFIED|COACHING_CHECKED_IN|checked_in:/i.test(adminNotes ?? r.adminNotes ?? '')
                      ? 'ongoing'
                    : status === 'confirmed'
                      ? 'confirmed'
                      : status === 'cancelled'
                        ? 'rejected'
                        : status === 'rejected'
                          ? 'rejected'
                          : 'pending',
                adminNotes: adminNotes ?? r.adminNotes,
                ...parseAcceptanceDetails(adminNotes ?? r.adminNotes),
                ...parseReviewDetails(adminNotes ?? r.adminNotes),
                ...parseRescheduleDetails(adminNotes ?? r.adminNotes),
              }
            : r
        )
      );
      window.dispatchEvent(new Event('sportsync:notifications-refresh'));
      window.dispatchEvent(new Event('sportsync:coaching-refresh'));
    } catch (error) {
      console.error('Error updating request status:', error);
      throw error;
    }
  };

  const submitCoachReview = async (id: string, rating: number, comment?: string): Promise<void> => {
    if (!user?.id) throw new Error("Please sign in again.");
    const payload = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id, rating, comment }),
    };
    let res = await apiFetch(`/api/coaching-sessions/${encodeURIComponent(id)}/review`, payload);
    let data = await res.json().catch(() => ({}));
    if (res.status === 404) {
      res = await apiFetch(`/api/coaching-sessions/review/${encodeURIComponent(id)}`, payload);
      data = await res.json().catch(() => ({}));
    }
    if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to submit review");
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              rating,
              reviewComment: comment || "",
              reviewedAt: String((data as any).reviewed_at || new Date().toISOString()),
              adminNotes: String((data as any).admin_notes || r.adminNotes || ""),
            }
          : r
      )
    );
    window.dispatchEvent(new Event("sportsync:coaching-refresh"));
  };

  const addCoach = async (coach: Omit<Coach, "id">) => {
    setError(null);
    const res = await apiFetch(`/api/coaches`, {
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
    const res = await apiFetch(`/api/coaches/${encodeURIComponent(id)}`, {
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
    const res = await apiFetch(`/api/coaches/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || "Failed to delete coach");
    await refreshCoaches();
  };

  const findCoachByEmail = (email: string) => {
    const normalized = email.trim().toLowerCase();
    if (normalized === "user@jrc.com") return undefined;
    return visibleCoaches.find((c) => c.isAvailable !== false && c.email?.trim().toLowerCase() === normalized);
  };

  return (
    <CoachingContext.Provider
      value={{
        coaches: visibleCoaches,
        requests,
        addRequest,
        updateRequestStatus,
        submitCoachReview,
        addCoach,
        updateCoach,
        deleteCoach,
        refreshCoaches,
        refreshRequests,
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
    console.error("useCoaching must be used within CoachingProvider. Returning fallback context.");
    const fallback: CoachingContextType = {
      coaches: [],
      requests: [],
      activeRequestId: null,
      setActiveRequestId: () => {},
      addRequest: async () => "",
      updateRequestStatus: async () => {},
      submitCoachReview: async () => {},
      addCoach: async () => {},
      updateCoach: async () => {},
      deleteCoach: async () => {},
      refreshCoaches: async () => {},
      refreshRequests: async () => {},
      findCoachByEmail: () => undefined,
      isLoading: false,
      error: null,
    };
    return fallback;
  }
  return context;
}
