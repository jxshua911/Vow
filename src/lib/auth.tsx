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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('there');
  useEffect(() => {
    let active = true;
    setLoading(true);
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) console.error('[VOW] Failed to restore session:', error);
      setSession(data.session);
      setDisplayName(getDisplayName(data.session));
      setLoading(false);
    }).catch((err) => {
      console.error('[VOW] Session restore crashed:', err);
      if (!active) return;
      setSession(null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setDisplayName(getDisplayName(sess));
      setLoading(false);
    });

    const handleNativeOAuthSuccess = () => {
      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.error('[VOW] Failed to refresh session after Google callback:', error);
          return;
        }
        if (!active) return;
        setSession(data.session);
        setDisplayName(getDisplayName(data.session));
        setLoading(false);
      });
    };

    window.addEventListener('vow:oauth-success', handleNativeOAuthSuccess);
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.removeEventListener('vow:oauth-success', handleNativeOAuthSuccess);
    };
  }, []);
  async function updateDisplayName(name: string) {
    const next = name.trim();
    if (!session || !next) return { error: new Error('A display name is required.') };
    const { data, error } = await supabase.auth.updateUser({ data: { ...session.user.user_metadata, full_name: next, name: next } });
    if (error) return { error };
    const refreshed = data.user ? { ...session, user: data.user } as Session : session;
    setSession(refreshed); setDisplayName(next);
    return { error: null };
  }
  return <AuthContext.Provider value={{ session, loading, displayName, updateDisplayName }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { return useContext(AuthContext); }
