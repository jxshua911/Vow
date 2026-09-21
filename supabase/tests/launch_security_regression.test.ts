import { assert, assertMatch } from "jsr:@std/assert@1";

Deno.test("free planning quota is 3 and infrastructure wording stays out of user copy", async () => {
  const migration = await Deno.readTextFile(
    new URL("../migrations/20260921110000_reduce_free_planning_quota.sql", import.meta.url),
  );
  const copy = await Deno.readTextFile(
    new URL("../../src/lib/entitlements.ts", import.meta.url),
  );

  assertMatch(migration, /WHEN 'planning_action' THEN 3/);
  assert(!migration.includes("WHEN 'planning_action' THEN 10"));
  assert(!copy.includes("reasonable service limits"));
});

Deno.test("AI endpoint retains request-size, timeout, cooldown and guardrail protections", async () => {
  const fn = await Deno.readTextFile(
    new URL("../functions/vow-goal-ai/index.ts", import.meta.url),
  );
  assertMatch(fn, /128 \* 1024/);
  assertMatch(fn, /setTimeout\(\(\) => c\.abort\(\), 35000\)/);
  assertMatch(fn, /vow_claim_ai_guardrail/);
  assertMatch(fn, /vow_claim_ai_cooldown/);
});

Deno.test("Google Play RTDN verifies Google's signed JWT before processing", async () => {
  const fn = await Deno.readTextFile(
    new URL("../functions/vow-google-play-rtdn/index.ts", import.meta.url),
  );
  assertMatch(fn, /jwtVerify/);
  assertMatch(fn, /createRemoteJWKSet/);
  assertMatch(fn, /PUBSUB_AUTH_INVALID/);
});

Deno.test("destructive account deletion requires recent authentication", async () => {
  const fn = await Deno.readTextFile(
    new URL("../functions/vow-account-delete/index.ts", import.meta.url),
  );
  assertMatch(fn, /RECENT_AUTH_REQUIRED/);
  assertMatch(fn, /15 \* 60 \* 1000/);
  assertMatch(fn, /auth\.admin\.deleteUser/);
});

// Launch regression suite is intentionally deterministic and local-only.
