export type RealtimeInspectorEvent = {
  id: string;
  at: string;
  type: 'status' | 'subscribe' | 'event' | 'error' | 'unsubscribe';
  channel?: string;
  event?: string;
  table?: string;
  payload?: unknown;
  message?: string;
};

const listeners = new Set<(event: RealtimeInspectorEvent) => void>();

export function emitRealtimeInspectorEvent(event: Omit<RealtimeInspectorEvent, 'id' | 'at'>) {
  const next: RealtimeInspectorEvent = { ...event, id: crypto.randomUUID(), at: new Date().toISOString() };
  listeners.forEach((listener) => listener(next));
}

export function subscribeRealtimeInspector(listener: (event: RealtimeInspectorEvent) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
