import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: CORS });

function adminClient() {
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  return createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function authClient(req: Request) {
  const key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  return createClient(Deno.env.get("SUPABASE_URL")!, key, {
    global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  let body: { confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ error: "INVALID_JSON" }, 400);
  }
  if (body.confirm !== true) return json({ error: "CONFIRMATION_REQUIRED" }, 400);

  const auth = authClient(req);
  const { data: { user }, error: userError } = await auth.auth.getUser();
  if (userError || !user) return json({ error: "AUTH_REQUIRED" }, 401);

  const admin = adminClient();
  const { error: deleteDataError } = await admin.rpc("delete_user_account_data", { p_user_id: user.id });
  if (deleteDataError) return json({ error: "DATA_DELETION_FAILED" }, 500);

  const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteUserError) return json({ error: "AUTH_ACCOUNT_DELETION_FAILED" }, 500);

  return json({ deleted: true });
});
