const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

export function sanitiseExternalUrl(value: string): string | null {
  const input = value.trim().replace(/[\\u0000-\\u001F\\u007F]/g, "");
  if (!input || input.length > 2048) return null;

  try {
    const parsed = new URL(input);
    if (!SAFE_PROTOCOLS.has(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
