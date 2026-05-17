import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, paymongo-signature",
};

function parseBookingNotes(notes: string | null | undefined): Record<string, unknown> {
  if (!notes) return {};
  try {
    const o = JSON.parse(notes);
    return typeof o === "object" && o ? o : {};
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
    if (webhookSecret) {
      const signature = req.headers.get("paymongo-signature") || "";
      if (!signature) {
        return new Response(JSON.stringify({ error: "Missing signature" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const event = body.data?.attributes?.type;

    if (event === "payment.paid" || event === "checkout_session.payment.paid") {
      const paymentData = body.data?.attributes?.data?.attributes ?? body.data?.attributes;
      const metadata = paymentData?.metadata ?? {};
      let bookingId = metadata?.bookingId as string | undefined;
      const paymentId = metadata?.paymentId as string | undefined;

      if (!bookingId && paymentId) {
        const supabasePeek = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const { data: payRow } = await supabasePeek
          .from("payments")
          .select("booking_id")
          .eq("id", paymentId)
          .maybeSingle();
        bookingId = payRow?.booking_id as string | undefined;
      }

      if (!bookingId) {
        return new Response(JSON.stringify({ error: "No bookingId found in metadata" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id, notes, status")
        .eq("id", bookingId)
        .maybeSingle();

      if (!existingBooking) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const meta = parseBookingNotes(existingBooking.notes);
      const updatedNotes = JSON.stringify({
        ...meta,
        downpaymentPaid: true,
        downpaymentPaidAt: new Date().toISOString(),
        paymentMethod: "paymongo",
      });

      const paymongoPaymentId = paymentData?.id || body.data?.id;

      const { error: bookingError } = await supabase
        .from("bookings")
        .update({
          status: "confirmed",
          notes: updatedNotes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      if (bookingError) {
        console.error("Database booking update error:", bookingError);
        return new Response(JSON.stringify({ error: bookingError.message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      const paymentUpdate: Record<string, unknown> = {
        status: "completed",
        completed_at: new Date().toISOString(),
        paymongo_source_id: paymongoPaymentId || null,
      };

      if (paymentId) {
        await supabase.from("payments").update(paymentUpdate).eq("id", paymentId);
      } else {
        await supabase
          .from("payments")
          .update(paymentUpdate)
          .eq("booking_id", bookingId)
          .eq("payment_method", "paymongo")
          .in("status", ["pending", "processing"]);
      }

      console.log(`Successfully confirmed booking ID: ${bookingId}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook processing failed:", err);
    return new Response(JSON.stringify({ error: "Invalid request payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});
