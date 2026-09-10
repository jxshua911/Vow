import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from './AppShell';
import { useAuth } from '@/lib/auth';

const CALLBACKS = {
  '/calendar/oauth/callback': { id: 'google-calendar', name: 'Google Calendar' },
  '/strava/oauth/callback': { id: 'strava', name: 'Strava' },
} as const;

export function OAuthConnectionCallback({ path }: { path: keyof typeof CALLBACKS }) {
  const { session } = useAuth();
  const [message, setMessage] = useState('Finishing connection...');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!session?.user?.id) return;
    const provider = CALLBACKS[path];
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') !== 'true') {
      setFailed(true);
      setMessage(params.get('error') || `${provider.name} connection was not completed.`);
      return;
    }
    supabase.from('integration_connections').upsert({
      user_id: session.user.id,
      integration_id: provider.id,
      status: 'connected',
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      last_goal_ids: [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,integration_id' }).then(({ error }) => {
      if (cancelled) return;
      if (error) {
        setFailed(true);
        setMessage(`The provider connected, but VOW could not save the connection state: ${error.message}`);
        return;
      }
      setMessage(`${provider.name} is now connected to VOW.`);
      window.setTimeout(() => { window.location.href = '/'; }, 900);
    });
    return () => { cancelled = true; };
  }, [path, session]);

  return <div className="min-h-screen bg-vow-bg flex items-center justify-center px-6"><div className="max-w-md w-full"><PageHeader title={failed ? 'Connection failed' : 'Connection complete'} subtitle={message} /><a href="/" className="vow-btn-primary inline-flex">Return to VOW</a></div></div>;
}
