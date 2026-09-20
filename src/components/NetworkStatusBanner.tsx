import { useEffect, useState } from 'react';

export function NetworkStatusBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    let reconnectTimer: number | undefined;
    const handleOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(() => setShowReconnected(false), 2800);
    };
    const handleOffline = () => {
      setOnline(false);
      setShowReconnected(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.clearTimeout(reconnectTimer);
    };
  }, []);

  if (online && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] border-b border-vow-border bg-vow-bg px-4 py-3 text-center text-xs text-vow-ink shadow-sm"
    >
      {online
        ? 'Back online. VOW can sync your latest changes now.'
        : 'You’re offline. Your saved VOW data remains available, but syncing and AI features need an internet connection.'}
    </div>
  );
}
