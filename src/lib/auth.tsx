import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { getDisplayName } from './auth-utils';

interface AuthContextValue { session: Session | null; loading: boolean; displayName: string; updateDisplayName: (name: string) => Promise<{ error: Error | null }>; }
const AuthContext = createContext<AuthContextValue>({ session: null, loading: true, displayName: 'there', updateDisplayName: async () => ({ error: null }) });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('there');
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setDisplayName(getDisplayName(data.session)); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => { setSession(sess); setDisplayName(getDisplayName(sess)); setLoading(false); });
    return () => listener.subscription.unsubscribe();
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
