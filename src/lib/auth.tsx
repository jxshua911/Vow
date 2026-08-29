import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

interface AuthContextValue { session: Session | null; loading: boolean; }
const AuthContext = createContext<AuthContextValue>({ session: null, loading: true });

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
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, sess) => { setSession(sess); setLoading(false); });
    return () => listener.subscription.unsubscribe();
  }, []);
  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() { return useContext(AuthContext); }
