export type ContentSafetyStatus = 'safe' | 'blocked' | 'suspended';

export type ContentSafetyResult = {
  status: ContentSafetyStatus;
  message?: string;
};

const BLOCKED_PATTERNS: RegExp[] = [
  /\bhow\s+to\s+(?:make|build|obtain)\s+(?:a\s+)?(?:bomb|explosive|weapon)\b/i,
  /\b(?:make|build|obtain)\s+(?:a\s+)?(?:bomb|explosive|weapon)\b/i,
];

/**
 * Lightweight client-side guard for prompts sent to the planning function.
 * The server remains the authoritative safety boundary; this prevents
 * obviously unsafe planning requests from being sent unnecessarily.
 */
export async function checkContentSafety(text: string): Promise<ContentSafetyResult> {
  const value = text.trim();
  if (!value) return { status: 'blocked', message: 'Please enter a planning request.' };

  if (BLOCKED_PATTERNS.some((pattern) => pattern.test(value))) {
    return {
      status: 'blocked',
      message: 'VOW cannot help plan activities involving weapons or explosives.',
    };
  }

  return { status: 'safe' };
}
