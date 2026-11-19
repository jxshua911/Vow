import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-vow-account-purge-secret",
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
    const suppliedSecret = req.headers.get("x-vow-account-purge-secret") || "";
    if (!suppliedSecret) return json({ error: "Not authorized." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Account purge: Supabase runtime configuration is missing.");
      return json({ error: "Account deletion is temporarily unavailable." }, 503);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authorized, error: authorizationError } = await admin.rpc("vow_validate_account_purge_cron_secret", {
      p_secret: suppliedSecret,
    });
    if (authorizationError || authorized !== true) return json({ error: "Not authorized." }, 401);

    const { data: expiredAccounts, error: expiredLookupError } = await admin
      .from("user_settings")
      .select("user_id,deletion_expires_at")
      .eq("account_status", "deleted")
      .not("deletion_expires_at", "is", null)
      .lte("deletion_expires_at", new Date().toISOString())
      .order("deletion_expires_at", { ascending: true })
      .limit(50);
    if (expiredLookupError) throw new Error("EXPIRED_ACCOUNT_LOOKUP_FAILED");

    let purged = 0;
    const failed: string[] = [];
    for (const account of expiredAccounts || []) {
      const userId = String(account.user_id || "");
      if (!userId) continue;
      try {
        // Re-check eligibility immediately before destructive work. A restored
        // account must never be deleted by a stale batch result.
        const { data: current, error: currentError } = await admin
          .from("user_settings")
          .select("account_status,deletion_expires_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (currentError) throw new Error("ACCOUNT_STATE_RECHECK_FAILED");
        if (!current || current.account_status !== "deleted" || !current.deletion_expires_at
            || new Date(current.deletion_expires_at).getTime() > Date.now()) continue;

        const objectPaths = await listUserObjects(admin, userId);
        for (let offset = 0; offset < objectPaths.length; offset += PAGE_SIZE) {
          const batch = objectPaths.slice(offset, offset + PAGE_SIZE);
          const { error: storageError } = await admin.storage.from(BUCKET).remove(batch);
          if (storageError) throw new Error("STORAGE_OBJECT_PURGE_FAILED");
        }

        const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
        if (deleteError) throw new Error("AUTH_USER_DELETE_FAILED");
        purged += 1;
      } catch (error) {
        failed.push(userId);
        console.error("[VOW] Permanent account purge failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR");
      }
    }

    return json({ processed: (expiredAccounts || []).length, purged, failed: failed.length });
  } catch (error) {
    console.error("Account purge failed:", error instanceof Error ? error.message : "UNKNOWN_ERROR");
    return json({ error: "Account deletion is temporarily unavailable." }, 503);
  }
});
