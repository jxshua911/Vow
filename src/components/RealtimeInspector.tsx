import { useEffect, useState } from 'react';
import { subscribeRealtimeInspector, type RealtimeInspectorEvent } from '@/lib/realtimeInspector';

export function RealtimeInspector() {
  const [events, setEvents] = useState<RealtimeInspectorEvent[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeRealtimeInspector((event) => {
    setEvents((current) => [event, ...current].slice(0, 100));
  }), []);

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="fixed right-4 bottom-20 z-50 border border-vow-border bg-vow-bg px-3 py-2 text-xs text-vow-muted shadow-sm">Realtime Inspector</button>;

  return <aside className="fixed right-4 bottom-20 z-50 w-[min(92vw,420px)] max-h-[70vh] overflow-hidden border border-vow-border bg-vow-bg shadow-xl">
    <div className="flex items-center justify-between border-b border-vow-border px-4 py-3">
      <div><p className="text-sm font-medium text-vow-ink">Realtime Inspector</p><p className="text-[11px] text-vow-muted">{events.length} recent events</p></div>
      <div className="flex gap-2"><button type="button" onClick={() => setEvents([])} className="text-xs text-vow-muted">Clear</button><button type="button" onClick={() => setOpen(false)} className="text-xs text-vow-muted">Close</button></div>
    </div>
    <div className="max-h-[58vh] overflow-y-auto divide-y divide-vow-border">
      {events.length === 0 ? <p className="px-4 py-6 text-xs text-vow-muted">Waiting for Realtime activity...</p> : events.map((item) => <div key={item.id} className="px-4 py-3 text-xs">
        <div className="flex justify-between gap-3"><span className="font-medium text-vow-ink">{item.type}{item.event ? ' · ' + item.event : ''}</span><span className="text-vow-muted">{new Date(item.at).toLocaleTimeString()}</span></div>
        <p className="mt-1 text-vow-muted">{item.channel || 'VOW'}{item.table ? ' · ' + item.table : ''}{item.message ? ' · ' + item.message : ''}</p>
        {item.payload !== undefined && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap text-[10px] text-vow-muted">{JSON.stringify(item.payload, null, 2)}</pre>}
      </div>)}
    </div>
  </aside>;
}
