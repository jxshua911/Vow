import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from './AppShell';
import { useAuth } from '@/lib/auth';

type Provider = { id: 'google-calendar' | 'strava'; name: string; table: 'google_calendar_connections' | 'strava_connections' };

const CALLBACKS: Record<string, Provider> = {
  '/calendar/oauth/callback': { id: 'google-calendar', name: 'Google Calendar', table: 'google_calendar_connections' },
  '/strava/oauth/callback': { id: 'strava', name: 'Strava', table: 'strava_connections' },
};

export function OAuthConnectionCallback({ path }: { path: keyof typeof CALLBACKS }) {
  const { session } = useAuth();
  const [message, setMessage] = useState('Finishing connection...');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) return;
    const provider = CALLBACKS[path];
    const params = new URLSearchParams(window.location.search);
    const callbackError = params.get('error');

    if (params.get('success') !== 'true') {
      setFailed(true);
      setMessage(callbackError || `${provider.name} connection was not completed.`);
      return;
    }

    Promise.all([
      supabase.from('integration_connections').select('status').eq('user_id', session.user.id).eq('integration_id', provider.id).maybeSingle(),
      supabase.from(provider.table).select('id').eq('user_id', session.user.id).maybeSingle(),
    ]).then(([historyResult, providerResult]) => {
      if (cancelled) return;
      if (historyResult.error) throw historyResult.error;
      if (providerResult.error) throw providerResult.error;
      const connected = historyResult.data?.status === 'connected' && Boolean(providerResult.data?.id);
      if (!connected) {
        setFailed(true);
        setMessage(`${provider.name} did not complete a verified connection. Please try again.`);
        return;
      }
      setMessage(`${provider.name} is now connected to VOW.`);
      window.setTimeout(() => { window.location.href = '/'; }, 900);
    }).catch((error) => {
      if (cancelled) return;
      setFailed(true);
      setMessage(error instanceof Error ? error.message : `Could not verify the ${provider.name} connection.`);
    });
    return () => { cancelled = true; };
  }, [path, session]);

  return <div className="min-h-screen bg-vow-bg flex items-center justify-center px-6"><div className="max-w-md w-full"><PageHeader title={failed ? 'Connection failed' : 'Connection complete'} subtitle={message} /><a href="/" className="vow-btn-primary inline-flex">Return to VOW</a></div></div>;
}
