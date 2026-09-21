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

Deno.test("destructive account deletion requires recent authentication", async () => {
  const fn = await Deno.readTextFile(
    new URL("../functions/vow-account-delete/index.ts", import.meta.url),
  );
  assertMatch(fn, /RECENT_AUTH_REQUIRED/);
  assertMatch(fn, /15 \* 60 \* 1000/);
  assertMatch(fn, /auth\.admin\.deleteUser/);
});
