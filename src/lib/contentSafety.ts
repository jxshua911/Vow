import { supabase } from '@/lib/supabase';

export type ContentSafetyStatus = 'safe' | 'ambiguous' | 'blocked' | 'warning' | 'suspended' | 'banned';

export type ContentSafetyResult = {
  status: ContentSafetyStatus;
  message?: string;
};

function isContentSafetyStatus(value: unknown): value is ContentSafetyStatus {
  return ['safe', 'ambiguous', 'blocked', 'warning', 'suspended', 'banned'].includes(String(value));
}

/**
 * Safety checks and progressive enforcement are performed by the server so
 * goal creation and planning share one authoritative moderation history.
 */
export async function checkContentSafety(text: string): Promise<ContentSafetyResult> {
  const value = text.trim();
  if (!value) return { status: 'blocked', message: 'Please enter a planning request.' };

  const { data, error } = await supabase.functions.invoke('vow-content-safety', {
    body: { text: value },
  });
  if (error) throw error;
  if (!data || !isContentSafetyStatus(data.status)) {
    throw new Error('VOW safety check returned an invalid response.');
  }
  return { status: data.status, message: typeof data.message === 'string' ? data.message : undefined };
}
