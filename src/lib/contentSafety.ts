import { supabase } from '@/lib/supabase';

export type ContentSafetyStatus = 'safe' | 'review' | 'blocked' | 'suspended';

export interface ContentSafetyResult {
  status: ContentSafetyStatus;
  message?: string;
  category?: string;
}

export async function checkContentSafety(text: string): Promise<ContentSafetyResult> {
  const value = text.trim();
  if (!value) return { status: 'review', message: 'Please enter something for VOW to review.' };
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const { data, error } = await supabase.functions.invoke('vow-content-safety', { body: { text: value } });
    if (error || !data || typeof data !== 'object') return { status: 'safe' };
    const result = data as Record<string, unknown>;
    const status = result.status;
    if (status === 'safe' || status === 'review' || status === 'blocked' || status === 'suspended') {
      return { status, message: typeof result.message === 'string' ? result.message : undefined, category: typeof result.category === 'string' ? result.category : undefined };
    }
    return { status: 'safe' };
  } catch {
    if (controller.signal.aborted) return { status: 'review', message: 'VOW could not verify that request right now. Please try again.' };
    return { status: 'safe' };
  } finally {
    window.clearTimeout(timeout);
  }
}
