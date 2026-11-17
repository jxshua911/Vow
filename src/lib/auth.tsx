import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue { session: Session | null; loading: boolean; displayName: string; updateDisplayName: (name: string) => Promise<{ error: Error | null }>; }
const AuthContext = createContext<AuthContextValue>({ session: null, loading: true, displayName: 'there', updateDisplayName: async () => ({ error: null }) });

// eslint-disable-next-line react-refresh/only-export-components
export function getDisplayName(session: Session | null) {
  const metadata = session?.user?.user_metadata as Record<string, unknown> | undefined;
  const fullName = typeof metadata?.full_name === 'string' ? metadata.full_name : typeof metadata?.name === 'string' ? metadata.name : '';
  if (fullName.trim()) return fullName.trim();
  const emailName = session?.user?.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  return emailName || 'there';
}

export async function loadSavedDisplayName(userSession: Session): Promise<string> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('display_name')
    .eq('user_id', userSession.user.id)
    .maybeSingle();

  if (error) {
    console.warn('[VOW] Could not load the saved profile name:', error);
    return getDisplayName(userSession);
  }

  const savedName = typeof data?.display_name === 'string' ? data.display_name.trim() : '';
  if (savedName) return savedName;

  // Migrate an existing name from Auth metadata into the durable profile field.
  // OAuth providers can refresh user metadata on later sign-ins; user_settings
  // remains VOW's source of truth for a name chosen inside the app.
  const metadata = userSession.user.user_metadata as Record<string, unknown> | undefined;
  const metadataName = typeof metadata?.full_name === 'string' && metadata.full_name.trim()
    ? metadata.full_name.trim()
    : typeof metadata?.name === 'string' ? metadata.name.trim() : '';
  if (metadataName) {
    const { error: seedError } = await supabase.from('user_settings').upsert({
      user_id: userSession.user.id,
      display_name: metadataName.slice(0, 80),
      updated_at: new Date().toISOString(),
    });
    if (seedError) console.warn('[VOW] Could not migrate the Auth name into the saved profile:', seedError);
    return metadataName.slice(0, 80);
  }

  return getDisplayName(userSession);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('there');

  useEffect(() => {
    let active = true;

    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setDisplayName(getDisplayName(nextSession));
      setLoading(false);
      if (!nextSession) return;

      void loadSavedDisplayName(nextSession).then(async (resolvedName) => {
        if (!active) return;
        const { data: latest } = await supabase.auth.getSession();
        if (latest.session?.user.id === nextSession.user.id) setDisplayName(resolvedName);
      });
    };

    setLoading(true);
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error('[VOW] Failed to restore session:', error);
      applySession(data.session);
    }).catch((err) => {
      console.error('[VOW] Session restore crashed:', err);
      if (!active) return;
      setSession(null);
      setDisplayName('there');
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function updateDisplayName(name: string) {
    const next = name.trim();
    if (!session || !next) return { error: new Error('A display name is required.') };
    if (next.length > 80) return { error: new Error('Your name must be 80 characters or fewer.') };

    // Save the canonical name to the account-owned database profile first.
    // This survives app reinstalls and OAuth metadata refreshes.
    const { error: profileError } = await supabase.from('user_settings').upsert({
      user_id: session.user.id,
      display_name: next,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return { error: profileError };

    const { data: verifiedProfile, error: verifyError } = await supabase
      .from('user_settings')
      .select('display_name')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (verifyError) return { error: verifyError };
    if (verifiedProfile?.display_name !== next) {
      return { error: new Error('VOW could not verify that your name was saved. Please try again.') };
    }

    // Keep Auth metadata in sync for compatibility with integrations that read it.
    // The database profile remains authoritative if a provider later overwrites it.
    const { data, error: metadataError } = await supabase.auth.updateUser({
      data: { ...session.user.user_metadata, full_name: next, name: next },
    });
    if (metadataError) console.warn('[VOW] Profile name saved, but Auth metadata sync failed:', metadataError);

    const refreshed = data?.user ? { ...session, user: data.user } as Session : session;
    setSession(refreshed);
    setDisplayName(next);
    return { error: null };
  }
  return <AuthContext.Provider value={{ session, loading, displayName, updateDisplayName }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { return useContext(AuthContext); }
