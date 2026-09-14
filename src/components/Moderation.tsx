import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from './AppShell';

type ModerationEvent = {
  id: string;
  user_id: string;
  source: string;
  category: string;
  severity: string;
  confidence: number;
  action: string;
  signal_code: string | null;
  created_at: string;
};

function label(value: string) {
  return value.replaceAll('_', ' ');
}

export function ModerationPage() {
  const [events, setEvents] = useState<ModerationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('moderation_events')
      .select('id,user_id,source,category,severity,confidence,action,signal_code,created_at')
      .eq('owner_visible', true)
      .order('created_at', { ascending: false })
      .limit(100);
    if (queryError) {
      setError('VOW could not load moderation alerts.');
      setEvents([]);
    } else {
      setEvents((data || []) as ModerationEvent[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="min-w-0">
      <PageHeader
        title="Safety"
        subtitle="Private moderation metadata only. User goals and journal entries are never displayed here."
        action={<button type="button" onClick={() => void load()} className="vow-btn-ghost">Refresh</button>}
      />

      {error && <p className="text-sm text-vow-ink border-l-2 border-vow-ink pl-3 mb-6">{error}</p>}

      <div className="border border-vow-border">
        <div className="px-5 py-4 border-b border-vow-border text-xs text-vow-muted leading-relaxed">
          This surface intentionally stores and displays only safety metadata: source, category, severity, confidence, action and a coarse signal. No matched text, goal wording, journal wording or plan content is shown.
        </div>
        {loading ? (
          <div className="px-5 py-10 text-sm text-vow-muted">Loading safety alerts…</div>
        ) : events.length === 0 ? (
          <div className="px-5 py-10 text-sm text-vow-muted">No moderation alerts.</div>
        ) : (
          <div className="divide-y divide-vow-border">
            {events.map((event) => (
              <article key={event.id} className="px-5 py-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <p className="text-sm font-medium text-vow-ink capitalize">{label(event.category)}</p>
                    <p className="text-xs text-vow-muted mt-1">{label(event.source)} · {label(event.action)}</p>
                  </div>
                  <span className="text-[11px] border border-vow-border px-2 py-1 text-vow-ink capitalize">{event.severity}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div><p className="vow-label mb-1">Confidence</p><p className="text-vow-ink">{Math.round(event.confidence * 100)}%</p></div>
                  <div><p className="vow-label mb-1">Signal</p><p className="text-vow-ink">{event.signal_code ? label(event.signal_code) : 'General safety flag'}</p></div>
                  <div><p className="vow-label mb-1">Account</p><p className="text-vow-ink font-mono">{event.user_id.slice(0, 8)}…</p></div>
                  <div><p className="vow-label mb-1">Time</p><p className="text-vow-ink">{new Date(event.created_at).toLocaleString()}</p></div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
