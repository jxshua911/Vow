import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LogOut, User } from 'lucide-react';
import { PageHeader } from './AppShell';

export function ProfilePage() {
  const { session } = useAuth();

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div>
      <PageHeader
        title="Profile"
        subtitle="Your account and preferences."
      />

      <div className="space-y-6">
        <div className="border border-vow-border p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 border border-vow-border flex items-center justify-center">
              <User className="w-5 h-5 text-vow-ink" />
            </div>

            <div className="min-w-0">
              <p className="text-xs text-vow-muted uppercase tracking-wide mb-1">
                Account
              </p>

              <p className="text-sm text-vow-ink truncate">
                {session?.user?.email}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 border border-vow-border py-3 text-sm text-vow-muted hover:text-vow-ink hover:border-vow-ink transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
