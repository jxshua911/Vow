import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import Stripe from "npm:stripe@22.6.2";

// V2 account webhooks must use THIN events.
// Configure a Stripe Event Destination for:
// - v2.account[requirements].updated
// - v2.account[.recipient].capability_status_updated
//
// Local listener example:
// stripe listen --thin-events 'v2.core.account[requirements].updated,v2.core.account[.recipient].capability_status.updated' --forward-thin-to <YOUR_LOCAL_ENDPOINT>
//
// The exact event names above should match the event names configured in the
// Stripe Dashboard for your API/SDK generation.

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed.", { status: 405 });

  try {
    const signature = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET");

    if (!signature) return new Response("Missing Stripe-Signature.", { status: 400 });
    if (!webhookSecret) {
      return new Response(
        "Stripe Connect webhook is not configured: set STRIPE_CONNECT_WEBHOOK_SECRET.",
        { status: 503 },
      );
    }

    const rawBody = await req.text();
    if (!rawBody) return new Response("Empty webhook body.", { status: 400 });

    const secret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!secret) {
      return new Response(
        "Stripe is not configured: set STRIPE_SECRET_KEY.",
        { status: 503 },
      );
    }

    const stripe = new Stripe(secret);

    // parseThinEvent verifies the Stripe signature and gives us the small
    // event envelope. We then retrieve the full event from Stripe because
    // thin events intentionally omit the full changed resource.
    const thinEvent = stripe.parseThinEvent(rawBody, signature, webhookSecret);
    const event = await stripe.v2.core.events.retrieve(thinEvent.id);

    const db = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // V2 event payloads can evolve, so inspect the related object defensively.
    // The important invariant is that we only update a mapping when the ID
    // actually looks like a Stripe connected-account ID.
    const record = event as unknown as Record<string, unknown>;
    const related = (record.related_object || record.data || {}) as Record<string, unknown>;
    const possibleAccountId = String(
      related.id || related.account || record.context || "",
    ).trim();

    const requirementEvent =
      event.type === "v2.core.account[requirements].updated" ||
      event.type === "v2.core.account[.recipient].capability_status_updated";

    if (requirementEvent && possibleAccountId.startsWith("acct_")) {
      // This is an audit pointer only. The app never trusts this stored event
      // as the current account state; the Accounts API is the source of truth.
      await db
        .from("stripe_connected_accounts")
        .update({
          last_requirement_event_id: thinEvent.id,
          last_requirement_event_type: event.type,
          last_requirement_event_at: new Date().toISOString(),
        })
        .eq("stripe_account_id", possibleAccountId);
    }

    return new Response(
      JSON.stringify({ received: true, eventType: event.type }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("vow-stripe-connect-webhook", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Webhook processing failed.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
});
