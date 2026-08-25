import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const STRAVA_API = "https://api-v3.strava.com/api/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    if (!url || !anon || !service || !clientId || !clientSecret) throw new Error("Strava configuration is missing");

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Not authenticated" }, 401);
    const admin = createClient(url, service);
    const { data: connection, error: connectionError } = await admin.from("strava_connections").select("*").eq("user_id", user.id).maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return json({ error: "Strava is not connected" }, 400);

    let accessToken = connection.access_token;
    if (connection.expires_at && new Date(connection.expires_at).getTime() <= Date.now()) {
      const refresh = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: connection.refresh_token, grant_type: "refresh_token" }),
      });
      const refreshed = await refresh.json();
      if (!refresh.ok) throw new Error(refreshed.message || "Failed to refresh Strava token");
      accessToken = refreshed.access_token;
      await admin.from("strava_connections").update({ access_token: refreshed.access_token, refresh_token: refreshed.refresh_token ?? connection.refresh_token, expires_at: refreshed.expires_at ? new Date(refreshed.expires_at * 1000).toISOString() : connection.expires_at, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    }

    const body = await req.json().catch(() => ({}));
    const after = body.after ? `&after=${encodeURIComponent(body.after)}` : "";
    const before = body.before ? `&before=${encodeURIComponent(body.before)}` : "";
    const perPage = Math.min(Number(body.perPage) || 30, 100);
    const response = await fetch(`${STRAVA_API}/athlete/activities?per_page=${perPage}${after}${before}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const activities = await response.json();
    if (!response.ok) throw new Error(activities.message || "Failed to read Strava activities");
    return json({ activities });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
