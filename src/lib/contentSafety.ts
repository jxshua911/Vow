import { supabase } from '@/lib/supabase';

export type ContentSafetyStatus = 'safe' | 'review' | 'blocked' | 'suspended';

export interface ContentSafetyResult {
  status: ContentSafetyStatus;
  message?: string;
  category?: string;
}

const SAFETY_TIMEOUT_MS = 8000;

export async function checkContentSafety(text: string): Promise<ContentSafetyResult> {
  const value = text.trim();
  if (!value) return { status: 'review', message: 'Please enter something for VOW to review.' };
  const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('SAFETY_TIMEOUT')), SAFETY_TIMEOUT_MS));
  try {
    const result = await Promise.race([
      supabase.functions.invoke('vow-content-safety', { body: { text: value } }),
      timeout,
    ]);
    const { data, error } = result;
    if (error || !data || typeof data !== 'object') return { status: 'review', message: 'VOW could not verify that request right now. Please try again.' };
    const payload = data as Record<string, unknown>;
    const status = payload.status;
    if (status === 'safe' || status === 'review' || status === 'blocked' || status === 'suspended') {
      return { status, message: typeof payload.message === 'string' ? payload.message : undefined, category: typeof payload.category === 'string' ? payload.category : undefined };
    }
    return { status: 'review', message: 'VOW could not verify that request right now. Please try again.' };
  } catch {
    return { status: 'review', message: 'VOW could not verify that request right now. Please try again.' };
  }
}
