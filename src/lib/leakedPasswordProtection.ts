const PWNED_PASSWORDS_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const LOOKUP_TIMEOUT_MS = 8_000;

/**
 * Checks a password against the Pwned Passwords range API using k-anonymity.
 * Only the first five hexadecimal characters of the SHA-1 digest leave the device.
 * SHA-1 is used only as the API's lookup format; it is not used to store passwords.
 *
 * Fail closed: callers must not allow signup if the lookup cannot be completed.
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password));
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const response = await fetch(PWNED_PASSWORDS_RANGE_URL + prefix, {
    method: 'GET',
    headers: { 'Add-Padding': 'true' },
    cache: 'no-store',
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error('Password safety check is temporarily unavailable.');
  }

  const body = await response.text();
  // Reject malformed responses instead of treating an unexpected body as a clean result.
  const entries = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (entries.length === 0 || entries.some((line) => !/^[A-F0-9]{35}:\d+$/i.test(line))) {
    throw new Error('Password safety check returned an invalid response.');
  }

  return entries.some((line) => line.slice(0, 35).toUpperCase() === suffix);
}
