import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

type QueueItem = {
  id: string;
  user_id: string;
  category: "session" | "weekly_review" | "deadline" | "streak";
  title: string;
  body: string;
  data: Record<string, string>;
  attempts: number;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const suppliedSecret = req.headers.get("x-vow-notification-secret") || "";
  if (!suppliedSecret) return json({ error: "AUTH_REQUIRED" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const pushSecret = Deno.env.get("VOW_PUSH_INTERNAL_SECRET") || "";
  if (!supabaseUrl || !serviceRoleKey || !pushSecret) return json({ error: "DISPATCHER_NOT_CONFIGURED" }, 503);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authorized, error: authorizationError } = await admin.rpc(
    "vow_validate_notification_dispatch_secret",
    { p_secret: suppliedSecret },
  );
  if (authorizationError || authorized !== true) return json({ error: "AUTH_INVALID" }, 401);

  const { data: claimed, error: claimError } = await admin.rpc(
    "vow_claim_due_notifications",
    { p_limit: 50 },
  );
  if (claimError) {
    console.error("[VOW] Notification queue claim failed:", claimError.message);
    return json({ error: "QUEUE_CLAIM_FAILED" }, 503);
  }

  const rows = (claimed || []) as QueueItem[];
  let sent = 0;
  let skipped = 0;
  let retried = 0;
  let failed = 0;

  for (const item of rows) {
    try {
      const response = await fetch(supabaseUrl + "/functions/v1/vow-send-push", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-vow-push-secret": pushSecret },
        body: JSON.stringify({
          user_id: item.user_id,
          title: item.title,
          body: item.body,
          category: item.category,
          queue_id: item.id,
          data: item.data || {},
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok && typeof result.skipped === "string") {
        await admin.from("vow_notification_queue")
          .update({ status: "skipped", last_error: result.skipped, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        skipped += 1;
        continue;
      }
      if (response.ok && Number(result.sent) > 0 && Number(result.failed) === 0) {
        await admin.from("vow_notification_queue")
          .update({ status: "sent", delivered_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        sent += 1;
        continue;
      }
      if (response.ok && Number(result.failed) === 0) {
        await admin.from("vow_notification_queue")
          .update({ status: "skipped", last_error: "no_registered_devices", updated_at: new Date().toISOString() })
          .eq("id", item.id);
        skipped += 1;
        continue;
      }
      // Partial success is retried. The sender's per-device ledger skips devices
      // already delivered, preventing duplicate pushes on the next queue attempt.
      const message = response.ok ? "FCM_DELIVERY_FAILED" : "PUSH_ENDPOINT_" + response.status;
      if (item.attempts < 5) {
        await admin.from("vow_notification_queue")
          .update({ status: "scheduled", scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), last_error: message, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        retried += 1;
      } else {
        await admin.from("vow_notification_queue")
          .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        failed += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN_DELIVERY_ERROR";
      if (item.attempts < 5) {
        await admin.from("vow_notification_queue")
          .update({ status: "scheduled", scheduled_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), last_error: message, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        retried += 1;
      } else {
        await admin.from("vow_notification_queue")
          .update({ status: "failed", last_error: message, updated_at: new Date().toISOString() })
          .eq("id", item.id);
        failed += 1;
      }
    }
  }

  // Generate timezone-aware weekly, deadline and progress reminders after
  // dispatching the due batch. The SQL function uses unique dedupe keys.
  const { data: generated, error: generationError } = await admin.rpc("vow_enqueue_periodic_notifications");
  if (generationError) {
    console.error("[VOW] Periodic notification generation failed:", generationError.message);
  }

  return json({
    claimed: rows.length,
    sent,
    skipped,
    retried,
    failed,
    generated: Number(generated || 0),
    generation_error: Boolean(generationError),
  });
});
