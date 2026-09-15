import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function reauth(message: string) { return Object.assign(new Error(message), { code: "REAUTH_REQUIRED" }); }

async function refreshAccessToken(connection: Record<string, unknown>, admin: ReturnType<typeof createClient>) {
  let accessToken = connection.access_token as string | null;
  const expired = Boolean(connection.expires_at && new Date(String(connection.expires_at)).getTime() <= Date.now());
  if (!expired) return accessToken;
  const refreshToken = connection.refresh_token as string | null;
  if (!refreshToken) throw reauth("Google Calendar authorization has expired. Please reconnect Google Calendar.");
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth configuration is missing");
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
  const data = await response.json();
  if (!response.ok || !data.access_token) { if (data.error === "invalid_grant") throw reauth("Google Calendar authorization is no longer valid. Please reconnect Google Calendar."); throw new Error(data.error_description || "Failed to refresh Google access token"); }
  accessToken = data.access_token;
  const { error } = await admin.from("google_calendar_connections").update({ access_token: accessToken, expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : connection.expires_at, updated_at: new Date().toISOString() }).eq("user_id", connection.user_id);
  if (error) throw error;
  return accessToken;
}

async function googleRequest(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, ...(init?.headers || {}) } });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { if (response.status === 401) throw reauth("Google Calendar authorization is no longer valid. Please reconnect Google Calendar."); throw new Error(data.error?.message || "Google Calendar request failed"); }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error("Supabase environment variables are missing");
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Not authenticated" }, 401);
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const goalId = typeof body?.goalId === "string" ? body.goalId : "";
    if (!goalId) return json({ error: "goalId is required" }, 400);

    const { data: goal, error: goalError } = await admin.from("goals").select("id, user_id, title").eq("id", goalId).eq("user_id", user.id).maybeSingle();
    if (goalError) throw goalError;
    if (!goal) return json({ error: "Goal not found" }, 404);

    const { data: connection, error: connectionError } = await admin.from("google_calendar_connections").select("*").eq("user_id", user.id).maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return json({ connected: false, created_count: 0, deleted_count: 0 });
    if (!String(connection.scope || "").includes("https://www.googleapis.com/auth/calendar")) return json({ connected: false, needsReauth: true, created_count: 0, deleted_count: 0 });

    let accessToken: string;
    try { accessToken = await refreshAccessToken(connection as Record<string, unknown>, admin) as string; }
    catch (error) { if (error instanceof Error && "code" in error) return json({ connected: false, needsReauth: true, error: error.message }, 401); throw error; }
    if (!accessToken) return json({ connected: false, needsReauth: true }, 401);

    const { data: sessions, error: sessionError } = await admin.from("sessions").select("id, title, scheduled_at, duration_minutes, notes, external_event_id, status").eq("goal_id", goalId).eq("user_id", user.id).order("scheduled_at", { ascending: true });
    if (sessionError) throw sessionError;

    let deletedCount = 0;
    for (const session of sessions || []) {
      if (!session.external_event_id) continue;
      try { await googleRequest(`/calendars/primary/events/${encodeURIComponent(session.external_event_id)}`, accessToken, { method: "DELETE" }); deletedCount += 1; }
      catch (error) { if (error instanceof Error && "code" in error) throw error; console.warn("[VOW Calendar] Could not delete old event", session.external_event_id, error); }
      const { error: clearError } = await admin.from("sessions").update({ external_event_id: null }).eq("id", session.id).eq("user_id", user.id);
      if (clearError) throw clearError;
    }

    const { data: planItems, error: planError } = await admin.from("goal_plan_items").select("id, week_number, day_of_week, scheduled_at, task, purpose, target_metric, duration_minutes, status").eq("goal_id", goalId).eq("user_id", user.id).eq("status", "scheduled").order("scheduled_at", { ascending: true });
    if (planError) throw planError;

    const sessionByTime = new Map((sessions || []).filter((session) => session.status === "scheduled").map((session) => [`${session.scheduled_at}|${session.title}`, session]));
    let createdCount = 0;
    for (const item of planItems || []) {
      const session = Array.from(sessionByTime.values()).find((candidate) => candidate.scheduled_at === item.scheduled_at && candidate.title === item.task);
      const start = new Date(item.scheduled_at);
      const end = new Date(start.getTime() + Math.max(5, item.duration_minutes || 60) * 60000);
      const description = [item.purpose, item.target_metric ? `Target: ${item.target_metric}` : null, `VOW goal: ${goal.title}`, `Week ${item.week_number} · ${item.day_of_week}`].filter(Boolean).join("\n");
      const event = await googleRequest("/calendars/primary/events", accessToken, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ summary: `VOW: ${item.task}`, description, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, reminders: { useDefault: true } }) });
      createdCount += 1;
      if (session?.id && event?.id) {
        const { error: updateError } = await admin.from("sessions").update({ external_event_id: event.id }).eq("id", session.id).eq("user_id", user.id);
        if (updateError) throw updateError;
        const { error: planUpdateError } = await admin.from("goal_plan_items").update({ external_event_id: event.id }).eq("id", item.id).eq("user_id", user.id);
        if (planUpdateError) throw planUpdateError;
      }
    }
    return json({ connected: true, created_count: createdCount, deleted_count: deletedCount });
  } catch (error) {
    console.error("[VOW Calendar Goal Sync]", error);
    if (error instanceof Error && "code" in error) return json({ connected: false, needsReauth: true, error: error.message }, 401);
    return json({ error: "Google Calendar sync could not be completed right now. Please try again." }, 500);
  }
});
