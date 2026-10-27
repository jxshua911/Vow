import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { isPasswordCompromised } from '../src/lib/leakedPasswordProtection.ts';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function hashParts(password: string) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

test('sends only the five-character hash prefix and detects an exact compromised suffix', async () => {
  const password = 'VOW-test-password-123!';
  const { prefix, suffix } = await hashParts(password);
  let requestedUrl = '';
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requestedUrl = String(input);
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.cache, 'no-store');
    assert.equal(new Headers(init?.headers).get('Add-Padding'), 'true');
    return new Response(`${suffix}:42\n${'A'.repeat(35)}:1\n`, { status: 200 });
  }) as typeof fetch;

  assert.equal(await isPasswordCompromised(password), true);
  assert.equal(requestedUrl, `https://api.pwnedpasswords.com/range/${prefix}`);
  assert.equal(requestedUrl.includes(password), false);
  assert.equal(requestedUrl.length, 'https://api.pwnedpasswords.com/range/'.length + 5);
});

test('returns false when the exact suffix is absent', async () => {
  globalThis.fetch = (async () => new Response(`${'A'.repeat(35)}:1\n`, { status: 200 })) as typeof fetch;
  assert.equal(await isPasswordCompromised('VOW-another-test-password'), false);
});

test('fails closed when the lookup service is unavailable', async () => {
  globalThis.fetch = (async () => new Response('unavailable', { status: 503 })) as typeof fetch;
  await assert.rejects(isPasswordCompromised('VOW-test-password'), /temporarily unavailable/);
});

test('rejects malformed lookup data instead of treating it as safe', async () => {
  globalThis.fetch = (async () => new Response('not-a-valid-hash-entry', { status: 200 })) as typeof fetch;
  await assert.rejects(isPasswordCompromised('VOW-test-password'), /invalid response/);
});
