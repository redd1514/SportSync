import { apiFetch, ensureApiAuthForUser, getAccessTokenForApi } from "../utils/authenticatedFetch";
import { supabase } from "../utils/supabase/client";

export type CourtBookingPaymentInput = {
  court: string;
  sport: string;
  booking_date: string;
  start_time: string;
  duration_hours: number;
  total_price: number;
  customer_name?: string;
  customer_phone?: string;
  add_ons?: string;
  ref_code?: string;
  facility_map_id?: string | null;
  user_id?: string;
  downpayment_percentage?: number;
  loyalty_points_redeemed?: number;
  loyalty_discount?: number;
  coach_id?: string;
  coach_name?: string;
  coaching_student_id?: string;
  coach_fee?: number;
  court_amount?: number;
  total_due?: number;
};

export type CourtBookingPaymentResult = {
  checkoutUrl: string;
  bookingId: string;
  paymentId: string;
  refCode: string;
  downpaymentAmount: number;
  totalPrice: number;
  downpaymentPercentage: number;
  balanceDue: number;
  coachingSessionId?: string;
};

export type PaymentAuthUser = {
  id: string;
  email: string;
};

function paymentReturnBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

function extractApiError(data: unknown, status: number): string {
  if (data && typeof data === "object") {
    const o = data as Record<string, unknown>;
    if (typeof o.error === "string" && o.error.trim()) return o.error;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (typeof o.msg === "string" && o.msg.trim()) return o.msg;
  }
  if (status === 401) return "Session expired. Please sign out and sign in again.";
  if (status === 502) return "PayMongo checkout failed. Check PAYMONGO_SECRET_KEY on the server.";
  return `Payment could not start (HTTP ${status})`;
}

async function resolvePaymentAccessToken(
  authUser?: PaymentAuthUser | null,
): Promise<string> {
  if (authUser?.id && authUser.email) {
    const ensured = await ensureApiAuthForUser({
      id: authUser.id,
      email: authUser.email,
    });
    if (!ensured.ok) {
      throw new Error(
        ensured.error ||
          "Could not prepare your session for payment. Try logging out and back in.",
      );
    }
  }

  const { data: refreshed } = await supabase.auth.refreshSession();
  let token = refreshed.session?.access_token ?? null;

  if (!token) {
    token = await getAccessTokenForApi();
  }

  if (!token) {
    throw new Error(
      "Please sign in to pay for your booking. If you just logged in, wait a moment and try again.",
    );
  }

  return token;
}

export async function initiateCourtBookingPayment(
  input: CourtBookingPaymentInput,
  authUser?: PaymentAuthUser | null,
): Promise<CourtBookingPaymentResult> {
  await resolvePaymentAccessToken(authUser);

  const base = paymentReturnBaseUrl();
  const success_url = `${base}?payment=success`;
  const cancel_url = `${base}?payment=cancelled`;

  const res = await apiFetch("/api/payments/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      success_url,
      cancel_url,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as CourtBookingPaymentResult & {
    error?: string;
    message?: string;
  };

  if (!res.ok) {
    throw new Error(extractApiError(data, res.status));
  }

  if (!data.checkoutUrl) {
    throw new Error("PayMongo checkout URL was not returned");
  }

  return data;
}

export function redirectToPayMongoCheckout(checkoutUrl: string) {
  window.location.href = checkoutUrl;
}
