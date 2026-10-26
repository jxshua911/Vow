import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const BUCKET = "goal-resources";
const PAGE_SIZE = 100;
const MAX_OBJECTS = 10000;
const MAX_FOLDER_DEPTH = 6;

type StorageListItem = {
  name: string;
  id?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function listUserObjects(
  admin: ReturnType<typeof createClient<any>>,
  prefix: string,
  depth = 0,
  output: string[] = [],
): Promise<string[]> {
  if (depth > MAX_FOLDER_DEPTH) throw new Error("STORAGE_FOLDER_DEPTH_EXCEEDED");
  let offset = 0;

  while (true) {
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error("STORAGE_OBJECT_LIST_FAILED");

    const items = (data || []) as StorageListItem[];
    for (const item of items) {
      if (!item.name || item.name === "." || item.name === "..") continue;
      const path = `${prefix}/${item.name}`;
      const isFolder = item.id == null && item.metadata == null;
      if (isFolder) {
        await listUserObjects(admin, path, depth + 1, output);
      } else {
        output.push(path);
        if (output.length > MAX_OBJECTS) throw new Error("STORAGE_OBJECT_LIMIT_EXCEEDED");
      }
    }

    if (items.length < PAGE_SIZE) break;
    offset += items.length;
  }

  return output;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error("Account purge: Supabase runtime configuration is missing.");
      return json({ error: "Account deletion is temporarily unavailable." }, 503);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Not authenticated." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: settings, error: settingsError } = await admin
      .from("user_settings")
      .select("account_status,deletion_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (settingsError) throw new Error("ACCOUNT_PURGE_STATE_LOOKUP_FAILED");
    if (!settings) return json({ status: "already_purged" });
    if (
      settings.account_status !== "deleted" ||
      !settings.deletion_expires_at ||
      new Date(settings.deletion_expires_at).getTime() > Date.now()
    ) {
      return json({ error: "The account is not eligible for permanent deletion yet." }, 409);
    }

    const objectPaths = await listUserObjects(admin, user.id);
    for (let offset = 0; offset < objectPaths.length; offset += PAGE_SIZE) {
      const batch = objectPaths.slice(offset, offset + PAGE_SIZE);
      const { error } = await admin.storage.from(BUCKET).remove(batch);
      if (error) {
        console.error("Account purge: private resource cleanup failed.");
        return json({ error: "Account deletion is temporarily unavailable." }, 503);
      }
    }

    const { data: purgeResult, error: purgeError } = await admin.rpc("vow_purge_expired_account", {
      p_user_id: user.id,
    });
    if (purgeError || !["purged", "already_purged"].includes(String(purgeResult?.status))) {
      console.error("Account purge: relational data cleanup failed.");
      return json({ error: "Account deletion is temporarily unavailable." }, 503);
    }

    return json({ status: purgeResult.status });
  } catch (error) {
    console.error("Account purge failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR");
    return json({ error: "Account deletion is temporarily unavailable." }, 503);
  }
});
