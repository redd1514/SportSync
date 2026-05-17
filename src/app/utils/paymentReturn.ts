import { apiFetch } from "./authenticatedFetch";

export const PENDING_COACHING_KEY = "sportsync_pending_coaching";

export type PaymentReturnState = {
  status: "success" | "cancelled" | null;
  bookingId: string | null;
};

export function readPaymentReturnFromUrl(): PaymentReturnState {
  if (typeof window === "undefined") {
    return { status: null, bookingId: null };
  }
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  const bookingId = params.get("booking_id");
  if (payment === "success") return { status: "success", bookingId };
  if (payment === "cancelled") return { status: "cancelled", bookingId };
  return { status: null, bookingId: null };
}

export function clearPaymentReturnFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.delete("payment");
  url.searchParams.delete("booking_id");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export async function processPendingCoachingLink(bookingId: string): Promise<void> {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_COACHING_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  try {
    const pending = JSON.parse(raw) as {
      coachingSessionId?: string;
      coachId?: string;
      coachingStudentId?: string;
      coachName?: string;
      coachHourlyRate?: number;
      duration?: number;
      sessionDate?: string;
      startTime?: string;
      courtAmount?: number;
      coachFee?: number;
      totalDue?: number;
      refCode?: string;
      acceptedBy?: string;
      bookingId?: string;
      serverCreatedCoachingSessionId?: string;
      court?: string;
    };

    if (pending.coachingSessionId) {
      const acceptanceDetails = {
        linkedBookingId: bookingId,
        courtAmount: pending.courtAmount,
        coachFee: pending.coachFee,
        totalDue: pending.totalDue,
        courtPaidBy: "student",
        coachCourtQr: pending.refCode,
        acceptedBy: pending.acceptedBy,
      };
      await apiFetch(
        `/api/coaching-sessions/${encodeURIComponent(pending.coachingSessionId)}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "confirmed",
            admin_notes: `COACHING_ACCEPTANCE:${JSON.stringify(acceptanceDetails)}`,
          }),
        },
      );
    } else if (pending.coachId) {
      const sessionDate = pending.sessionDate || new Date().toISOString().split("T")[0];
      const startTimeRaw = pending.startTime || "14:00";
      const startNorm = startTimeRaw.length >= 5 ? startTimeRaw.slice(0, 5) : startTimeRaw;
      const startHour = parseInt(startNorm.split(":")[0], 10) || 14;
      const dur = Math.max(1, Number(pending.duration) || 1);
      const endHour = startHour + dur;
      await apiFetch("/api/coaching-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coach_id: pending.coachId,
          user_id: pending.coachingStudentId,
          session_date: sessionDate,
          start_time: `${startNorm}:00`,
          end_time: `${String(endHour).padStart(2, "0")}:00:00`,
          status: "confirmed",
          linked_booking_id: bookingId,
          payment_proof_url: `COACHING_BOOKING:${JSON.stringify({
            linkedBookingId: bookingId,
            court: pending.court,
            courtAmount: pending.courtAmount,
            coachFee: pending.coachFee,
            totalDue: pending.totalDue,
            paidBy: "student",
            bookingQr: pending.refCode,
          })}`,
        }),
      });
    }

    sessionStorage.removeItem(PENDING_COACHING_KEY);
    window.dispatchEvent(new Event("sportsync:coaching-refresh"));
    window.dispatchEvent(new Event("sportsync:notifications-refresh"));
  } catch (err) {
    console.error("[paymentReturn] coaching link failed", err);
  }
}
