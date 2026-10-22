import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const subscriptionMigration = readFileSync(
  new URL('../supabase/migrations/20260918150000_harden_premium_subscription_entitlements.sql', import.meta.url),
  'utf8',
);
const hardeningMigration = readFileSync(
  new URL('../supabase/migrations/20261022103721_harden_subscription_table_privileges.sql', import.meta.url),
  'utf8',
);
const webhook = readFileSync(
  new URL('../supabase/functions/vow-stripe-webhook/index.ts', import.meta.url),
  'utf8',
);
const googlePlayVerify = readFileSync(
  new URL('../supabase/functions/vow-google-play-verify/index.ts', import.meta.url),
  'utf8',
);
const premiumEmail = readFileSync(
  new URL('../supabase/functions/vow-premium-confirmation-email/index.ts', import.meta.url),
  'utf8',
);

test('subscription records use provider-scoped unique keys and an idempotent upsert', () => {
  assert.match(subscriptionMigration, /unique\s*\(provider,\s*provider_purchase_id\)/i);
  assert.match(subscriptionMigration, /unique\s*\(provider,\s*provider_event_id\)/i);
  assert.match(subscriptionMigration, /on conflict\s*\(provider,\s*provider_purchase_id\)\s*do update/i);
  assert.match(subscriptionMigration, /on conflict\s*\(provider,\s*provider_event_id\)\s*do nothing/i);
});

test('Stripe subscription lifecycle updates use the server-only canonical RPC', () => {
  assert.match(webhook, /rpc\(["']vow_set_subscription_record["']/);
  assert.doesNotMatch(webhook, /from\(["']vow_user_entitlements["']\)\s*\.upsert\(/);
  assert.match(webhook, /onConflict:\s*["']provider,provider_event_id["']/);
});

test('a deleted Stripe subscription maps to a non-Premium state', () => {
  assert.match(webhook, /event\.type === ["']customer\.subscription\.deleted["']\s*\?\s*["']cancelled["']/);
  assert.match(subscriptionMigration, /case when p_status in \('active','grace'\) then 'premium' else 'free' end/i);
});

test('Premium email delivery is server-role-only and idempotent by Stripe event', () => {
  assert.match(premiumEmail, /bearerRole\(request\) !== ["']service_role["']/);
  assert.match(premiumEmail, /Idempotency-Key/);
  assert.match(premiumEmail, /status === ["']sent["']/);
  assert.match(webhook, /premium-email:stripe:\$\{String\(event\.id\)\}/);
  assert.match(googlePlayVerify, /provider: "google_play"[\s\S]{0,180}provider_event_id: purchaseEventId/);
  assert.match(googlePlayVerify, /vow-premium-confirmation-email/);
});


test('payment ledger supports every canonical provider and the webhook conflict target', () => {
  assert.match(hardeningMigration, /CHECK \(provider IN \('google_play', 'apple', 'stripe', 'manual'\)\)/i);
  assert.match(hardeningMigration, /UNIQUE \(provider, provider_event_id\)/i);
  assert.match(hardeningMigration, /DROP POLICY IF EXISTS "Users can read their own payment events"/);
});
