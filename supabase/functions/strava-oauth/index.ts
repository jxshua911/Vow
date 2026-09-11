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

function isAllowedReturnUri(value: unknown, defaultReturnUri: string) {
  if (typeof value !== "string") return defaultReturnUri;
  if (value === "com.vow.app://strava-callback") return value;
  if (value === defaultReturnUri) return value;
  return defaultReturnUri;
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
      const returnUri = isAllowedReturnUri(body.returnUri, defaultReturnUri);
      const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: redirectUri, approval_prompt: "auto", scope: "read,activity:read", state });
      const { error } = await admin.from("strava_oauth_states").insert({ state, user_id: userId, return_uri: returnUri });
      if (error) throw error;
      return json({ url: `https://www.strava.com/oauth/authorize?${params.toString()}` });
    }

    if (body.action === "disconnect") {
      if (!userId) return json({ error: "Not authenticated" }, 401);
      const { data: connection, error: lookupError } = await admin.from("strava_connections").select("access_token,refresh_token").eq("user_id", userId).maybeSingle();
      if (lookupError) throw lookupError;
      const token = connection?.refresh_token || connection?.access_token;
      if (token) {
        const basic = btoa(`${clientId}:${clientSecret}`);
        const revokeResponse = await fetch("https://www.strava.com/oauth/revoke", {
          method: "POST",
          headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token }),
        });
        if (!revokeResponse.ok) return json({ error: "Could not revoke the Strava connection. Please try again." }, 502);
      }
      const { error: deleteError } = await admin.from("strava_connections").delete().eq("user_id", userId);
      if (deleteError) throw deleteError;
      const { error: historyError } = await admin.from("integration_connections").upsert({ user_id: userId, integration_id: "strava", status: "disconnected", disconnected_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "user_id,integration_id" });
      if (historyError) throw historyError;
      return json({ success: true });
    }

    if (req.method === "POST") {
      if (!userId) return json({ error: "Not authenticated" }, 401);
      if (body.action !== "callback" || typeof body.code !== "string" || typeof body.state !== "string") return json({ error: "Invalid OAuth request" }, 400);
      const { data: stateRow, error: stateError } = await admin.from("strava_oauth_states").select("user_id,return_uri,created_at").eq("state", body.state).maybeSingle();
      if (stateError) throw stateError;
      if (!stateRow || stateRow.user_id !== userId || Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000) return json({ error: "Invalid or expired OAuth state." }, 400);
      await admin.from("strava_oauth_states").delete().eq("state", body.state);
      return finishCallback(admin, stateRow.user_id, body.code, redirectUri, clientId, clientSecret, stateRow.return_uri || defaultReturnUri);
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
    const { data: stateRow, error: stateError } = await admin.from("strava_oauth_states").select("user_id,return_uri,created_at").eq("state", incomingState).maybeSingle();
    if (stateError) throw stateError;
    if (!stateRow || Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000) return new Response("Invalid or expired OAuth state.", { status: 400, headers: { "Content-Type": "text/plain" } });
    await admin.from("strava_oauth_states").delete().eq("state", incomingState);
    return finishCallback(admin, stateRow.user_id, incomingCode, redirectUri, clientId, clientSecret, stateRow.return_uri || defaultReturnUri);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

async function finishCallback(admin: ReturnType<typeof createClient>, userId: string, code: string, redirectUri: string, clientId: string, clientSecret: string, returnUri: string) {
  const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code" }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) return redirect(returnUri, false, tokenData.message || "Strava token exchange failed.");
  if (typeof tokenData.access_token !== "string" || typeof tokenData.refresh_token !== "string") return redirect(returnUri, false, "Strava returned an incomplete token response.");
  const athleteId = tokenData.athlete?.id?.toString() ?? null;
  const now = new Date().toISOString();
  const { error: saveError } = await admin.from("strava_connections").upsert({ user_id: userId, athlete_id: athleteId, access_token: tokenData.access_token, refresh_token: tokenData.refresh_token, expires_at: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null, scope: tokenData.scope ?? null, updated_at: now }, { onConflict: "user_id" });
  if (saveError) throw saveError;
  const { error: historyError } = await admin.from("integration_connections").upsert({ user_id: userId, integration_id: "strava", status: "connected", connected_at: now, disconnected_at: null, updated_at: now }, { onConflict: "user_id,integration_id" });
  if (historyError) throw historyError;
  return redirect(returnUri, true);
}
