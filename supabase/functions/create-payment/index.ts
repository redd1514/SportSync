import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CreatePaymentBody = {
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
  success_url?: string;
  cancel_url?: string;
  source?: string;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeStartTime(t: string): string {
  const raw = t.trim();
  if (/^\d{1,2}:\d{2}/.test(raw)) {
    const p = raw.split(":").map((x) => parseInt(x, 10));
    const h = p[0] ?? 0;
    const m = p[1] ?? 0;
    return `${pad2(h)}:${pad2(m)}:00`;
  }
  const hour = parseInt(raw, 10);
  if (Number.isFinite(hour) && hour >= 0 && hour <= 23) {
    return `${pad2(hour)}:00:00`;
  }
  throw new Error(`Invalid start time: "${t}"`);
}

function endTimeFromStartAndDuration(startHms: string, durationHours: number): string {
  const [h, m] = startHms.split(":").map((x) => parseInt(x, 10));
  const startM = (h ?? 0) * 60 + (m ?? 0);
  const endM = startM + durationHours * 60;
  const eh = Math.floor(endM / 60) % 24;
  const em = endM % 60;
  return `${pad2(eh)}:${pad2(em)}:00`;
}

function genRefCode(): string {
  return `JRC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function isUuid(s: string | null | undefined): boolean {
  if (!s) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

const DEMO_JWT_TYP = "sportsync_demo";

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return atob(b64);
}

function b64urlEncodeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifySportsyncDemoJwt(
  token: string,
  secret: string,
): Promise<{ sub: string; email: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 3 || !secret) return null;
  const [h, p, sig] = parts;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${h}.${p}`),
  );
  const expected = b64urlEncodeBytes(new Uint8Array(mac));
  if (expected !== sig) return null;

  let payload: { typ?: string; sub?: string; email?: string; exp?: number };
  try {
    payload = JSON.parse(b64urlDecode(p));
  } catch {
    return null;
  }
  if (payload.typ !== DEMO_JWT_TYP || !payload.sub || !payload.email) return null;
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || Math.floor(Date.now() / 1000) > exp) return null;
  return { sub: String(payload.sub), email: String(payload.email) };
}

async function resolveAuthenticatedUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  supabaseUser: ReturnType<typeof createClient>,
  authHeader: string,
): Promise<{ authSubject: string; email?: string; displayName?: string }> {
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  const { data: authData, error: authError } = await supabaseUser.auth.getUser();
  if (!authError && authData?.user) {
    return {
      authSubject: authData.user.id,
      email: authData.user.email ?? undefined,
      displayName: (authData.user.user_metadata?.full_name as string) || undefined,
    };
  }

  const demoSecret = Deno.env.get("SPORTSYNC_API_JWT_SECRET");
  if (demoSecret) {
    const demo = await verifySportsyncDemoJwt(token, demoSecret);
    if (demo) {
      return { authSubject: demo.sub, email: demo.email };
    }
  }

  throw new Error("Invalid or expired session");
}

async function resolveUserRowId(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  if (!userId) throw new Error("Authentication required");

  if (isUuid(userId)) {
    const { data: byId } = await supabase.from("users").select("id").eq("id", userId).maybeSingle();
    if (byId?.id) return byId.id as string;
  }

  const { data: byAuth } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", userId)
    .maybeSingle();
  if (byAuth?.id) return byAuth.id as string;

  throw new Error("User profile not found. Please sign in again.");
}

async function resolveCourtId(
  supabase: ReturnType<typeof createClient>,
  courtName: string,
  sportName: string,
): Promise<string> {
  const name = courtName.trim();
  const { data: rows, error } = await supabase
    .from("courts")
    .select("id, name, sports!inner(name)")
    .ilike("name", name);

  if (error) throw error;
  if (!rows?.length) {
    throw new Error(`Court not found: "${name}"`);
  }
  if (rows.length === 1) return rows[0].id as string;

  const bySport = rows.find((r) => {
    const sports = r.sports as { name?: string }[] | { name?: string } | undefined;
    let sportMatch: string | undefined;
    if (Array.isArray(sports)) {
      sportMatch = sports[0]?.name;
    } else if (sports && typeof sports === 'object' && 'name' in sports) {
      sportMatch = (sports as { name?: string }).name;
    }
    return String(sportMatch || "").toLowerCase() === sportName.trim().toLowerCase();
  });
  if (bySport?.id) return bySport.id as string;
  throw new Error(`Multiple courts named "${name}" — specify sport.`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const paymongoSecret = Deno.env.get("PAYMONGO_SECRET_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!paymongoSecret) {
      return jsonResponse({ error: "PayMongo is not configured" }, 500);
    }
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: "Supabase is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization" }, 401);
    }

    const body = (await req.json()) as CreatePaymentBody;
    const {
      court,
      sport,
      booking_date,
      start_time,
      duration_hours,
      total_price,
      customer_name,
      customer_phone,
      add_ons,
      ref_code,
      facility_map_id,
      downpayment_percentage = 50,
      success_url,
      cancel_url,
      source = "online_paymongo",
    } = body;

    let userId = body.user_id;
    const duration = Number(duration_hours);
    if (!court || !sport || !booking_date || !start_time || !Number.isFinite(duration) || duration < 1) {
      return jsonResponse(
        { error: "court, sport, booking_date, start_time, and duration_hours (min 1) are required" },
        400,
      );
    }
    if (!Number.isFinite(Number(total_price)) || Number(total_price) <= 0) {
      return jsonResponse({ error: "total_price must be greater than zero" }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const supabaseUser = createClient(supabaseUrl, anonKey ?? serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    let authSubject: string;
    let authEmail: string | undefined;
    let authDisplayName: string | undefined;
    try {
      const auth = await resolveAuthenticatedUser(supabaseAdmin, supabaseUser, authHeader);
      authSubject = auth.authSubject;
      authEmail = auth.email;
      authDisplayName = auth.displayName;
    } catch {
      return jsonResponse({ error: "Invalid or expired session. Please sign in again." }, 401);
    }

    userId = userId || authSubject;
    const resolvedUserId = await resolveUserRowId(supabaseAdmin, userId);
    const courtId = await resolveCourtId(supabaseAdmin, court, sport);

    const startNorm = normalizeStartTime(start_time);
    const endNorm = endTimeFromStartAndDuration(startNorm, duration);
    const ref = (ref_code || genRefCode()).toUpperCase();
    const total = Math.max(0, Number(total_price));
    const pct = Math.min(100, Math.max(1, Number(downpayment_percentage) || 50));
    const downpaymentAmount = Math.round((total * pct) / 100 * 100) / 100;
    const amountCentavos = Math.round(downpaymentAmount * 100);

    if (amountCentavos < 100) {
      return jsonResponse({ error: "Downpayment must be at least ₱1.00" }, 400);
    }

    const notes = JSON.stringify({
      refCode: ref,
      customerName: customer_name ?? authDisplayName ?? "",
      customerPhone: customer_phone ?? "",
      sport,
      addOns: add_ons ?? "",
      source,
      paymentMethod: "paymongo",
      downpaymentPercentage: pct,
      downpaymentAmount,
      totalPrice: total,
      balanceDue: Math.round((total - downpaymentAmount) * 100) / 100,
      ...(facility_map_id ? { facilityMapId: facility_map_id } : {}),
    });

    const { data: booking, error: bookingErr } = await supabaseAdmin
      .from("bookings")
      .insert({
        user_id: resolvedUserId,
        court_id: courtId,
        booking_date,
        start_time: startNorm,
        end_time: endNorm,
        status: "pending",
        base_price: total,
        total_price: total,
        notes,
        qr_code_token: ref,
      })
      .select("id")
      .single();

    if (bookingErr) {
      console.error("Booking insert error:", bookingErr);
      return jsonResponse({ error: bookingErr.message }, 400);
    }

    const bookingId = booking!.id as string;

    const { data: paymentRow, error: paymentErr } = await supabaseAdmin
      .from("payments")
      .insert({
        user_id: resolvedUserId,
        booking_id: bookingId,
        amount: downpaymentAmount,
        payment_method: "paymongo",
        status: "pending",
        transaction_id: `PM-${ref}-${Date.now()}`,
      })
      .select("id")
      .single();

    if (paymentErr) {
      await supabaseAdmin.from("bookings").delete().eq("id", bookingId);
      console.error("Payment insert error:", paymentErr);
      return jsonResponse({ error: paymentErr.message }, 400);
    }

    const appOrigin = Deno.env.get("APP_URL") || "http://localhost:5173";
    const baseSuccess = success_url || `${appOrigin}/?payment=success&booking_id=${bookingId}`;
    const baseCancel = cancel_url || `${appOrigin}/?payment=cancelled&booking_id=${bookingId}`;

    const checkoutPayload = {
      data: {
        attributes: {
          billing: {
            name: customer_name || authDisplayName || "Sportsync Customer",
            email: (authEmail || "").trim() || "customer@sportsync.local",
          },
          send_email_receipt: false,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              amount: amountCentavos,
              currency: "PHP",
              name: `${sport} court downpayment (${pct}%)`,
              quantity: 1,
              description: `${court} · ${booking_date} ${startNorm.slice(0, 5)} · ${ref}`.slice(0, 255),
            },
          ],
          payment_method_types: ["gcash", "card", "paymaya"],
          description: `Sportsync downpayment (${pct}% of PHP ${total})`,
          statement_descriptor: "SPORTSYNC",
          success_url: baseSuccess,
          cancel_url: baseCancel,
          reference_number: ref,
          metadata: {
            bookingId: String(bookingId),
            paymentId: String(paymentRow?.id ?? ""),
            refCode: String(ref),
            type: "court_downpayment",
          },
        },
      },
    };

    const pmRes = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${paymongoSecret}:`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(checkoutPayload),
    });

    const pmData = await pmRes.json();
    if (!pmRes.ok) {
      await supabaseAdmin.from("payments").delete().eq("id", paymentRow!.id);
      await supabaseAdmin.from("bookings").delete().eq("id", bookingId);
      console.error("PayMongo error:", pmData);
      const errMsg =
        pmData?.errors?.[0]?.detail ||
        pmData?.errors?.[0]?.title ||
        "Failed to create PayMongo checkout session";
      return jsonResponse({ error: errMsg }, 502);
    }

    const checkoutUrl = pmData?.data?.attributes?.checkout_url;
    const sessionId = pmData?.data?.id;

    if (!checkoutUrl) {
      return jsonResponse({ error: "PayMongo did not return a checkout URL" }, 502);
    }

    await supabaseAdmin
      .from("payments")
      .update({
        paymongo_reference_id: sessionId,
        status: "processing",
      })
      .eq("id", paymentRow!.id);

    return jsonResponse({
      checkoutUrl,
      bookingId,
      paymentId: paymentRow!.id,
      refCode: ref,
      downpaymentAmount,
      totalPrice: total,
      downpaymentPercentage: pct,
      balanceDue: Math.round((total - downpaymentAmount) * 100) / 100,
    });
  } catch (err) {
    console.error("create-payment error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Payment initialization failed" },
      500,
    );
  }
});
