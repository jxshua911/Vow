import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NATIVE_REDIRECT = "com.vow.app://calendar-callback";
const WEB_REDIRECT = "https://vow.bolt.host/calendar/oauth/callback";
const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function redirectUrl(base: string, params: Record<string, string>) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  const googleRedirectUri = Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI");
  const configured = Boolean(supabaseUrl && supabaseAnonKey && serviceRoleKey && clientId && clientSecret && googleRedirectUri);

  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      // Status is intentionally safe when OAuth configuration is incomplete.
      // The client can render the integration as unavailable instead of surfacing
      // a raw 500/configuration error to the user.
      if (body.action === "status" && !configured) {
        return json({ connected: false, available: false, configured: false });
      }
      if (!configured) return json({ error: "OAuth configuration is missing", available: false, configured: false }, 503);

      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Missing authorization header" }, 401);

      const userClient = createClient(supabaseUrl!, supabaseAnonKey!, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) return json({ error: "Not authenticated" }, 401);

      const admin = createClient(supabaseUrl!, serviceRoleKey!);
      if (body.action === "status") {
        const { data: connection, error: connectionError } = await admin.from("google_calendar_connections").select("id, access_token").eq("user_id", user.id).maybeSingle();
        if (connectionError) throw connectionError;
        return json({ connected: Boolean(connection?.id && connection?.access_token), available: true, configured: true });
      }

      if (body.action !== "start") return json({ error: "Unknown action" }, 400);
      const redirectUri = body.redirectUri;
      if (redirectUri !== NATIVE_REDIRECT && redirectUri !== WEB_REDIRECT) return json({ error: "Invalid application redirect URI" }, 400);

      const state = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error: saveError } = await admin.from("google_calendar_connections").upsert({ user_id: user.id, oauth_state: state, oauth_state_expires_at: expiresAt, oauth_redirect_uri: redirectUri, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (saveError) throw saveError;

      const authorizationUrl = new URL(GOOGLE_AUTHORIZE_URL);
      authorizationUrl.search = new URLSearchParams({ client_id: clientId!, redirect_uri: googleRedirectUri!, response_type: "code", access_type: "offline", prompt: "consent", scope: "https://www.googleapis.com/auth/calendar.events", state }).toString();
      return json({ authorizationUrl: authorizationUrl.toString(), available: true, configured: true });
    }

    if (!configured) return new Response("Google Calendar is not configured.", { status: 503, headers: { "Content-Type": "text/plain" } });
    const admin = createClient(supabaseUrl!, serviceRoleKey!);
    const requestUrl = new URL(req.url);
    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const googleError = requestUrl.searchParams.get("error");
    if (googleError) return new Response("Google Calendar authorization was cancelled.", { status: 400, headers: { "Content-Type": "text/plain" } });
    if (!code || !state) return new Response("Missing OAuth code or state.", { status: 400, headers: { "Content-Type": "text/plain" } });

    const { data: connection, error: lookupError } = await admin.from("google_calendar_connections").select("user_id, oauth_state, oauth_state_expires_at, oauth_redirect_uri").eq("oauth_state", state).maybeSingle();
    if (lookupError) throw lookupError;
    if (!connection || connection.oauth_state !== state) return new Response("Invalid OAuth state.", { status: 400, headers: { "Content-Type": "text/plain" } });
    if (!connection.oauth_state_expires_at || new Date(connection.oauth_state_expires_at).getTime() <= Date.now()) return new Response("OAuth state expired. Please try again.", { status: 400, headers: { "Content-Type": "text/plain" } });

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId!, client_secret: clientSecret!, redirect_uri: googleRedirectUri!, grant_type: "authorization_code" }) });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) return new Response("Google token exchange failed.", { status: 400, headers: { "Content-Type": "text/plain" } });

    const expiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString() : null;
    const { error: saveError } = await admin.from("google_calendar_connections").upsert({ user_id: connection.user_id, access_token: tokenData.access_token, refresh_token: tokenData.refresh_token ?? null, expires_at: expiresAt, scope: tokenData.scope ?? null, oauth_state: null, oauth_state_expires_at: null, oauth_redirect_uri: null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (saveError) throw saveError;
    return Response.redirect(redirectUrl(connection.oauth_redirect_uri || NATIVE_REDIRECT, { success: "true" }), 302);
  } catch (error) {
    console.error("[VOW Calendar OAuth]", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error", available: false }, 500);
  }
});
