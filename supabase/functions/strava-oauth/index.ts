import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const clientId = Deno.env.get("STRAVA_CLIENT_ID");
    const clientSecret = Deno.env.get("STRAVA_CLIENT_SECRET");
    const redirectUri = Deno.env.get("STRAVA_REDIRECT_URI");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !clientId || !clientSecret || !redirectUri) {
      throw new Error("Strava OAuth configuration is missing");
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    if (body.action === "authorize") {
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        approval_prompt: "auto",
        scope: "read,activity:read",
        state,
      });
      const admin = createClient(supabaseUrl, serviceRoleKey);
      await admin.from("strava_oauth_states").insert({ state, user_id: user.id });
      return json({ url: `https://www.strava.com/oauth/authorize?${params.toString()}` });
    }

    if (body.action !== "callback" || !body.code || !body.state) return json({ error: "Invalid OAuth request" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: stateRow } = await admin.from("strava_oauth_states").select("user_id, created_at").eq("state", body.state).maybeSingle();
    if (!stateRow || stateRow.user_id !== user.id || Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000) {
      return json({ error: "Invalid or expired OAuth state" }, 400);
    }
    await admin.from("strava_oauth_states").delete().eq("state", body.state);

    const tokenResponse = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code: body.code, grant_type: "authorization_code" }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) return json({ error: tokenData.message || "Strava token exchange failed" }, 400);

    const athleteId = tokenData.athlete?.id?.toString() ?? null;
    const { error: saveError } = await admin.from("strava_connections").upsert({
      user_id: user.id,
      athlete_id: athleteId,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at ? new Date(tokenData.expires_at * 1000).toISOString() : null,
      scope: tokenData.scope ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (saveError) throw saveError;

    return json({ success: true });
  } catch (error) {
    console.error(error);
    return json({ error: "Strava connection failed. Please try again." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
