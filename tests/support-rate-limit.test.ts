import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const supportFunction = readFileSync(
  new URL('../supabase/functions/vow-support/index.ts', import.meta.url),
  'utf8',
);

test('new support submissions are limited to one per hour per signed-in user', () => {
  assert.match(supportFunction, /Date\.now\(\)\s*-\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.match(supportFunction, /\.eq\('user_id',\s*user\.id\)[\s\S]{0,200}\.gte\('created_at',\s*cutoff\)/);
  assert.match(supportFunction, /return json\(\{ persisted: false, error: 'Please wait up to an hour[^']*' \}, 429\)/);
});

test('idempotent retries of the same support request are not rate-limited as new submissions', () => {
  const priorLookup = supportFunction.indexOf("const priorRequest = await admin.from('support_submissions')");
  const rateLimit = supportFunction.indexOf("const cutoff = new Date(Date.now() - 60 * 60 * 1000)");
  assert.ok(priorLookup >= 0 && rateLimit > priorLookup);
  assert.match(supportFunction, /prior\.user_id !== user\.id[\s\S]{0,400}return json\(\{ persisted: false, error: 'This submission key belongs to a different support request\./);
});
