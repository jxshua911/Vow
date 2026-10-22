import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const upgrade = readFileSync(
  new URL('../src/components/Upgrade.tsx', import.meta.url),
  'utf8',
);
const checkout = readFileSync(
  new URL('../supabase/functions/vow-create-checkout/index.ts', import.meta.url),
  'utf8',
);

test('Premium UI exposes monthly pricing only and purchases the monthly Play product', () => {
  assert.match(upgrade, /Monthly subscription/);
  assert.match(upgrade, /purchasePremium\(VOW_PREMIUM_MONTHLY\)/);
  assert.doesNotMatch(upgrade, /VOW_PREMIUM_YEARLY|setBilling\(|Yearly|per year/);
});

test('Stripe checkout ignores client billing requests and always selects the monthly price', () => {
  assert.match(checkout, /const billing = "monthly"/);
  assert.match(checkout, /STRIPE_PRICE_ID_MONTHLY/);
  assert.doesNotMatch(checkout, /body\?\.billing === "yearly"/);
  assert.doesNotMatch(checkout, /STRIPE_PRICE_ID_YEARLY/);
});
