import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function ProtectedRoute({ children, fallback = null }: ProtectedRouteProps) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-vow-bg flex items-center justify-center" aria-label="Checking authentication">
        <div className="vow-loading-dots"><span /><span /><span /></div>
      </div>
    );
  }

  if (!session?.user) return <>{fallback}</>;

  return <>{children}</>;
}
