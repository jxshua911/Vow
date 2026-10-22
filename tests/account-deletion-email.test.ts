import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const deletionFunction = readFileSync(
  new URL('../supabase/functions/vow-account-delete/index.ts', import.meta.url),
  'utf8',
);

test('account deletion acknowledgement is sent only after the deletion request is persisted', () => {
  const persisted = deletionFunction.indexOf('if(settingsWriteError)return json({error:"ACCOUNT_STATE_WRITE_FAILED"},500);');
  const email = deletionFunction.indexOf('const response=await fetch("https://api.resend.com/emails"');
  assert.ok(persisted >= 0 && email > persisted);
});

test('account deletion email clearly distinguishes a request from permanent deletion', () => {
  assert.match(deletionFunction, /30-day recovery window/);
  assert.match(deletionFunction, /does not confirm that your account or its data has been permanently deleted/);
  assert.match(deletionFunction, /deletion_email_sent:deletionEmailSent/);
  assert.doesNotMatch(deletionFunction, /subject="Your VOW account has been permanently deleted"/);
});

test('account deletion remains successful if the optional email provider is unavailable', () => {
  assert.match(deletionFunction, /if\(resendKey&&user\.email\)/);
  assert.match(deletionFunction, /catch\{console\.error\("\[VOW Account Delete\] Request acknowledgement email delivery failed\."\);\}/);
  assert.match(deletionFunction, /return json\(\{deleted:true,restorable_until:deletionExpiresAt,deletion_email_sent:deletionEmailSent\}\)/);
});
