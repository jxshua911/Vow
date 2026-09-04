import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: CORS });

function secret() {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    if (keys.default) return keys.default;
  } catch {}
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
}

function clientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return req.headers.get("cf-connecting-ip")?.trim() || forwarded || req.headers.get("x-real-ip")?.trim() || null;
}

async function hashIp(ip: string) {
  const material = `${secret()}:${ip.trim()}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const ip = clientIp(req);
    if (!ip || !secret()) return json({ allowed: true });

    const db = createClient(Deno.env.get("SUPABASE_URL")!, secret(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const ipHash = await hashIp(ip);
    const { data, error } = await db
      .from("moderation_ip_bans")
      .select("banned_until")
      .eq("ip_hash", ipHash)
      .maybeSingle();
    if (error) throw error;

    const active = Boolean(data && (!data.banned_until || new Date(data.banned_until).getTime() > Date.now()));
    if (!active) return json({ allowed: true });

    return json({
      allowed: false,
      status: "blocked",
      message: "Access to VOW is currently restricted from this network address because of a serious safety violation.",
    }, 403);
  } catch (error) {
    console.error("access gate", error);
    return json({ error: "VOW could not verify access right now." }, 500);
  }
});
