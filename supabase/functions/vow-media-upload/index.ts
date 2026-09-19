import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { validateMediaFile } from "../_shared/mediaSecurity.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "UNAUTHORIZED" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "UNAUTHORIZED" }, 401);

  const form = await req.formData().catch(() => null);
  const goalId = typeof form?.get("goalId") === "string" ? String(form.get("goalId")).trim() : "";
  const titleValue = typeof form?.get("title") === "string" ? String(form.get("title")).trim() : "";
  const file = form?.get("file");

  if (!goalId || !(file instanceof File)) return json({ error: "INVALID_UPLOAD" }, 400);
  if (titleValue.length > 200) return json({ error: "TITLE_TOO_LONG" }, 400);

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .select("id")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (goalError || !goal) return json({ error: "GOAL_NOT_FOUND" }, 404);

  let checked: Awaited<ReturnType<typeof validateMediaFile>>;
  try {
    checked = await validateMediaFile(file);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "MEDIA_NOT_ALLOWED" }, 400);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "media";
  const objectPath = user.id + "/" + goalId + "/" + crypto.randomUUID() + "-" + safeName;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { error: uploadError } = await admin.storage
    .from("goal-resources")
    .upload(objectPath, file, {
      contentType: checked.mimeType,
      upsert: false,
      cacheControl: "3600",
    });
  if (uploadError) return json({ error: "MEDIA_UPLOAD_FAILED" }, 502);

  const resourceType = checked.mimeType.startsWith("image/") ? "image" : "video";
  const { data: resource, error: insertError } = await admin
    .from("goal_resources")
    .insert({
      goal_id: goalId,
      user_id: user.id,
      url: "storage://" + objectPath,
      title: titleValue || null,
      resource_type: resourceType,
    })
    .select("id,goal_id,user_id,url,title,resource_type,created_at")
    .single();

  if (insertError || !resource) {
    await admin.storage.from("goal-resources").remove([objectPath]);
    return json({ error: "RESOURCE_RECORD_FAILED" }, 500);
  }

  return json({ ok: true, resource });
});
