import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CALENDAR_API =
  "https://www.googleapis.com/calendar/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      throw new Error("Supabase environment variables are missing");
    }

    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const admin = createClient(
      supabaseUrl,
      serviceRoleKey,
    );

    const { data: connection, error: connectionError } =
      await admin
        .from("google_calendar_connections")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

    if (connectionError) {
      throw connectionError;
    }

    if (!connection) {
      return new Response(
        JSON.stringify({
          error: "Google Calendar is not connected",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    let accessToken = connection.access_token;

    const expired =
      connection.expires_at &&
      new Date(connection.expires_at).getTime() <= Date.now();

    if (expired && connection.refresh_token) {
      const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID");
      const clientSecret = Deno.env.get(
        "GOOGLE_CALENDAR_CLIENT_SECRET",
      );

      if (!clientId || !clientSecret) {
        throw new Error("Google OAuth configuration is missing");
      }

      const refreshResponse = await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: connection.refresh_token,
            grant_type: "refresh_token",
          }),
        },
      );

      const refreshData = await refreshResponse.json();

      if (!refreshResponse.ok) {
        throw new Error(
          refreshData.error_description ||
            "Failed to refresh Google access token",
        );
      }

      accessToken = refreshData.access_token;

      await admin
        .from("google_calendar_connections")
        .update({
          access_token: accessToken,
          expires_at: refreshData.expires_in
            ? new Date(
                Date.now() +
                  refreshData.expires_in * 1000,
              ).toISOString()
            : connection.expires_at,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    }

    const { data: body } = await req
      .json()
      .catch(() => ({ data: {} }));

    const action = body?.action || "list";

    if (action === "list") {
      const timeMin =
        body?.timeMin || new Date().toISOString();

      const timeMax =
        body?.timeMax ||
        new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString();

      const url =
        `${GOOGLE_CALENDAR_API}/calendars/primary/events` +
        `?timeMin=${encodeURIComponent(timeMin)}` +
        `&timeMax=${encodeURIComponent(timeMax)}` +
        `&singleEvents=true` +
        `&orderBy=startTime`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message ||
            "Failed to read Google Calendar",
        );
      }

      return new Response(
        JSON.stringify({
          events: data.items || [],
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    if (action === "create") {
      const event = body?.event;

      if (!event) {
        return new Response(
          JSON.stringify({
            error: "Missing event",
          }),
          {
            status: 400,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }

      const response = await fetch(
        `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(event),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message ||
            "Failed to create Google Calendar event",
        );
      }

      return new Response(
        JSON.stringify({
          event: data,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Unknown action",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
