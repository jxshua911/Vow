import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vow-idempotency-key",
};
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const MAX_BODY_BYTES = 128 * 1024;
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000;
const MAX_EVENTS = 5000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function readJson(req: Request) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw Object.assign(new Error("Request body too large"), { code: "BODY_TOO_LARGE" });
  const reader = req.body?.getReader();
  if (!reader) return {};
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) throw Object.assign(new Error("Request body too large"), { code: "BODY_TOO_LARGE" });
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new TextDecoder().decode(Uint8Array.from(chunks.flatMap((chunk) => Array.from(chunk))));
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch {
    throw Object.assign(new Error("Invalid JSON body"), { code: "INVALID_JSON" });
  }
}

async function hashHex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function refreshAccessToken(connection: Record<string, unknown>, admin: ReturnType<typeof createClient>) {
  let accessToken = connection.access_token as string | null;
  const expired = Boolean(connection.expires_at && new Date(String(connection.expires_at)).getTime() <= Date.now());
  if (!expired) return accessToken;
  const refreshToken = connection.refresh_token as string | null;
  if (!refreshToken) throw Object.assign(new Error("Google Calendar authorization has expired. Please reconnect Google Calendar."), { code: "REAUTH_REQUIRED" });
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET");
  if (!clientId || !clientSecret) throw new Error("Google OAuth configuration is missing");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    if (data.error === "invalid_grant") throw Object.assign(new Error("Google Calendar authorization is no longer valid. Please reconnect Google Calendar."), { code: "REAUTH_REQUIRED" });
    throw new Error(data.error_description || "Failed to refresh Google access token");
  }
  accessToken = data.access_token;
  const { error } = await admin.from("google_calendar_connections").update({
    access_token: accessToken,
    expires_at: data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : connection.expires_at,
    updated_at: new Date().toISOString(),
  }).eq("user_id", connection.user_id);
  if (error) throw error;
  return accessToken;
}

async function googleGet(path: string, accessToken: string) {
  const response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) throw Object.assign(new Error("Google Calendar authorization is no longer valid. Please reconnect Google Calendar."), { code: "REAUTH_REQUIRED" });
    throw Object.assign(new Error(data.error?.message || "Google Calendar request failed"), { code: response.status === 404 ? "NOT_FOUND" : undefined });
  }
  return data;
}

async function listAllCalendarEvents(calendarId: string, accessToken: string, timeMin: string, timeMax: string) {
  const events: unknown[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", showDeleted: "false", maxResults: "2500" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await googleGet(`/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`, accessToken);
    if (Array.isArray(data.items)) {
      for (const event of data.items) {
        if (events.length >= MAX_EVENTS) break;
        events.push(event);
      }
    }
    if (events.length >= MAX_EVENTS) break;
    pageToken = typeof data.nextPageToken === "string" ? data.nextPageToken : "";
  } while (pageToken);
  return events;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) throw new Error("Supabase environment variables are missing");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: connection, error: connectionError } = await admin.from("google_calendar_connections").select("*").eq("user_id", user.id).maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return json({ error: "Google Calendar is not connected" }, 400);

    let accessToken: string;
    try {
      accessToken = await refreshAccessToken(connection as Record<string, unknown>, admin) as string;
    } catch (error) {
      if (error instanceof Error && "code" in error) return json({ error: error.message, code: (error as Error & { code: string }).code }, 401);
      throw error;
    }
    if (!accessToken) return json({ error: "Google Calendar authorization is incomplete. Please reconnect Google Calendar.", code: "REAUTH_REQUIRED" }, 401);

    const body = await readJson(req);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request body" }, 400);
    const action = typeof body.action === "string" ? body.action : "list";

    if (action === "list") {
      const now = Date.now();
      const defaultMin = new Date(now - 31 * 24 * 60 * 60 * 1000);
      const defaultMax = new Date(now + 365 * 24 * 60 * 60 * 1000);
      const min = typeof body.timeMin === "string" ? new Date(body.timeMin) : defaultMin;
      const max = typeof body.timeMax === "string" ? new Date(body.timeMax) : defaultMax;
      if (Number.isNaN(min.getTime()) || Number.isNaN(max.getTime()) || max <= min) return json({ error: "Invalid calendar time range" }, 400);
      if (max.getTime() - min.getTime() > MAX_RANGE_MS) return json({ error: "Calendar range is limited to one year" }, 400);

      const timeMin = min.toISOString();
      const timeMax = max.toISOString();
      const calendarList = await googleGet("/users/me/calendarList?minAccessRole=reader&showHidden=false&maxResults=250", accessToken);
      const calendars = Array.isArray(calendarList.items) ? calendarList.items : [];
      const allEvents: unknown[] = [];
      for (const calendar of calendars) {
        if (allEvents.length >= MAX_EVENTS) break;
        const calendarId = typeof calendar.id === "string" ? calendar.id : null;
        if (!calendarId) continue;
        try {
          const events = await listAllCalendarEvents(calendarId, accessToken, timeMin, timeMax);
          for (const event of events) {
            if (allEvents.length >= MAX_EVENTS) break;
            allEvents.push({ ...(event as Record<string, unknown>), calendarId, calendarName: calendar.summary || calendarId });
          }
        } catch (error) {
          console.warn("[VOW Calendar] Skipping unreadable calendar", calendarId, error);
        }
      }
      allEvents.sort((a, b) => {
        const getStart = (value: unknown) => {
          const item = value as { start?: { dateTime?: string; date?: string } };
          return item.start?.dateTime || item.start?.date || "";
        };
        return getStart(a).localeCompare(getStart(b));
      });
      return json({
        events: allEvents,
        truncated: allEvents.length >= MAX_EVENTS,
        calendars: calendars.map((calendar: { id?: string; summary?: string; primary?: boolean; accessRole?: string }) => ({ id: calendar.id, summary: calendar.summary, primary: calendar.primary, accessRole: calendar.accessRole })),
      });
    }

    if (action === "create") {
      const rawEvent = body.event;
      if (!rawEvent || typeof rawEvent !== "object" || Array.isArray(rawEvent)) return json({ error: "Missing event" }, 400);
      const event = { ...(rawEvent as Record<string, unknown>) };
      const eventJson = JSON.stringify(event);
      if (eventJson.length > 60000) return json({ error: "Event payload is too large" }, 400);

      const suppliedKey = req.headers.get("x-vow-idempotency-key") || (typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "");
      const idempotencyMaterial = suppliedKey || eventJson;
      const digest = await hashHex(`${user.id}:${idempotencyMaterial}`);
      const eventId = `vo${digest}`;
      event.id = eventId;

      const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) {
          try {
            const existing = await googleGet(`/calendars/primary/events/${encodeURIComponent(eventId)}`, accessToken);
            return json({ event: existing, idempotent: true });
          } catch {
            return json({ error: "This calendar event already exists. Please refresh and try again." }, 409);
          }
        }
        if (response.status === 401) return json({ error: "Google Calendar authorization is no longer valid. Please reconnect Google Calendar.", code: "REAUTH_REQUIRED" }, 401);
        throw new Error(data.error?.message || "Failed to create Google Calendar event");
      }
      return json({ event: data, idempotent: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("[VOW Calendar API]", error);
    if (error instanceof Error && "code" in error) {
      const code = (error as Error & { code?: string }).code;
      if (code === "BODY_TOO_LARGE") return json({ error: "Request body is too large." }, 413);
      if (code === "INVALID_JSON") return json({ error: "Invalid JSON body." }, 400);
      if (code === "REAUTH_REQUIRED") return json({ error: error.message, code }, 401);
    }
    return json({ error: "Google Calendar could not be reached right now. Please try again." }, 500);
  }
});
