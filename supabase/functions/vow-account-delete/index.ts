import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "UNAUTHORIZED" });

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: "UNAUTHORIZED" });

  let body: { confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "INVALID_JSON" });
  }

  if (body.confirm !== true) return json(400, { error: "CONFIRMATION_REQUIRED" });

  // Account deletion is a destructive operation. Require a genuinely recent
  // authentication event; the client cannot bypass this check.
  const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at).getTime() : 0;
  const recentWindowMs = 15 * 60 * 1000;
  if (!lastSignIn || Date.now() - lastSignIn > recentWindowMs) {
    return json(403, {
      error: "RECENT_AUTH_REQUIRED",
      message: "For your security, sign in again before deleting your account.",
    });
  }

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: deleteError } = await serviceClient.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("vow-account-delete", { code: deleteError.code, message: deleteError.message });
    return json(500, { error: "ACCOUNT_DELETE_FAILED" });
  }

  return json(200, { deleted: true });
});
