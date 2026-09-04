import type { Session } from '@supabase/supabase-js';

export function getDisplayName(session: Session | null) {
  const metadata = session?.user?.user_metadata as Record<string, unknown> | undefined;
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name : typeof metadata?.name === 'string' ? metadata.name : '';
  if (fullName.trim()) return fullName.trim();
  const emailName = session?.user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return emailName || 'there';
}
