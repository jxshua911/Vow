import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function redirect(target: string, success: boolean, error?: string) {
  const url = new URL(target);
  url.searchParams.set("success", String(success));
  if (error) url.searchParams.set("error", error.slice(0, 500));
  return Response.redirect(url.toString(), 302);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    const redirectUri = Deno.env.get("STRAVA_REDIRECT_URI");
    const defaultReturnUri = Deno.env.get("STRAVA_APP_RETURN_URI") || "https://vow.bolt.host/strava/oauth/callback";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !clientId || !clientSecret || !redirectUri) throw new Error("Strava OAuth configuration is missing");

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = authHeader.startsWith("Bearer ") ? createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } }) : null;
    let userId: string | null = null;
    if (userClient) {
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const requestUrl = new URL(req.url);
    const incomingCode = requestUrl.searchParams.get("code");
    const incomingState = requestUrl.searchParams.get("state");
    const incomingError = requestUrl.searchParams.get("error");
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    if (body.action === "authorize") {
      if (!userId) return json({ error: "Not authenticated" }, 401);
      const state = crypto.randomUUID();
      const returnUri = typeof body.returnUri === "string" && /^https?:\/\/|^com\.vow\.app:\/\//.test(body.returnUri) ? body.returnUri : defaultReturnUri;
      const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, approval_prompt: "auto", scope: "read,activity:read", state });
      const { error } = await admin.from("strava_oauth_states").insert({ state, user_id: userId, return_uri: returnUri });
      if (error) throw error;
      return json({ url: `https://www.strava.com/oauth/authorize?${params.toString()}` });
    }

    if (req.method === "POST") {
      if (!userId) return json({ error: "Not authenticated" }, 401);
      if (body.action !== "callback" || !body.code || !body.state) return json({ error: "Invalid OAuth request" }, 400);
      return finishCallback(admin, userId, String(body.code), String(body.state), redirectUri, clientId, clientSecret, null);
    }

    if (incomingError) {
      if (incomingState) {
        const { data: stateRow } = await admin.from("strava_oauth_states").select("user_id,return_uri,created_at").eq("state", incomingState).maybeSingle();
        if (stateRow) {
          await admin.from("strava_oauth_states").delete().eq("state", incomingState);
          return redirect(stateRow.return_uri || defaultReturnUri, false, "Strava authorization was cancelled.");
        }
      }
      return new Response("Strava authorization was cancelled.", { status: 400, headers: { "Content-Type": "text/plain" } });
    }
    if (!incomingCode || !incomingState) return new Response("Missing OAuth code or state.", { status: 400, headers: { "Content-Type": "text/plain" } });
    const { data: stateRow } = await admin.from("strava_oauth_states").select("user_id,return_uri,created_at").eq("state", incomingState).maybeSingle();
    if (!stateRow || Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000) return new Response("Invalid or expired OAuth state.", { status: 400, headers: { "Content-Type": "text/plain" } });
    await admin.from("strava_oauth_states").delete().eq("state", incomingState);
    return finishCallback(admin, stateRow.user_id, incomingCode, incomingState, redirectUri, clientId, clientSecret, stateRow.return_uri || defaultReturnUri, false);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

async function finishCallback(admin: ReturnType<typeof createClient>, userId: string, code: string, state: string, redirectUri: string, clientId: string, clientSecret: string, returnUri: string | null, cleanState = true) {
  if (cleanState) await admin.from("strava_oauth_states").delete().eq("state", state);
  const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code" }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) return returnUri ? redirect(returnUri, false, tokenData.message || "Strava token exchange failed.") : json({ error: tokenData.message || "Strava token exchange failed" }, 400);
  const athleteId = tokenData.athlete?.id?.toString() ?? null;
  const { error: saveError } = await admin.from("strava_connections").upsert({ user_id: userId, athlete_id: athleteId, access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expires_at: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null, scope: tokenData.scope ?? null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (saveError) throw saveError;
  return returnUri ? redirect(returnUri, true) : json({ success: true });
}
