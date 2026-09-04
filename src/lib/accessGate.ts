import { supabase } from '@/lib/supabase';

export type AccessGateResult = {
  allowed: boolean;
  message?: string;
};

export async function checkVowAccess(): Promise<AccessGateResult> {
  const { data, error } = await supabase.functions.invoke('vow-access-gate', { body: {} });
  if (error) {
    throw new Error('VOW could not verify access right now. Please try again.');
  }

  const result = data as Record<string, unknown> | null;
  return {
    allowed: result?.allowed !== false,
    message: typeof result?.message === 'string' ? result.message : undefined,
  };
}
