import { supabase } from '@/lib/supabase';

export type ContentSafetyStatus = 'safe' | 'ambiguous' | 'blocked' | 'suspended';

export type ContentSafetyResult = {
  status: ContentSafetyStatus;
  category?: string;
  confidence?: number;
  message?: string;
  retryAfterSeconds?: number;
};

export async function checkContentSafety(text: string): Promise<ContentSafetyResult> {
  const value = text.trim();
  if (!value) return { status: 'safe' };

  const { data, error } = await supabase.functions.invoke('vow-content-safety', {
    body: { text: value },
  });

  if (error) {
    throw new Error('VOW could not verify that wording right now. Please try again.');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('VOW could not verify that wording right now. Please try again.');
  }

  const result = data as Record<string, unknown>;
  return {
    status: result.status === 'ambiguous' || result.status === 'blocked' || result.status === 'suspended' ? result.status : 'safe',
    category: typeof result.category === 'string' ? result.category : undefined,
    confidence: typeof result.confidence === 'number' ? result.confidence : undefined,
    message: typeof result.message === 'string' ? result.message : undefined,
    retryAfterSeconds: typeof result.retry_after_seconds === 'number' ? result.retry_after_seconds : undefined,
  };
}
