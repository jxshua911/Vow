import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { LayoutDashboard, Target, BookOpen, ClipboardList, LogOut, Plus } from 'lucide-react';
import type { ReactNode } from 'react';

export type View = 'dashboard' | 'goals' | 'journal' | 'review';

interface AppShellProps {
  currentView: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

export function AppShell({ currentView, onNavigate, children }: AppShellProps) {
  const { session } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems: { view: View; label: string; icon: typeof Target }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'goals', label: 'Goals', icon: Target },
    { view: 'journal', label: 'Journal', icon: BookOpen },
    { view: 'review', label: 'Weekly Review', icon: ClipboardList },
  ];

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="min-h-screen bg-vow-bg">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56 border-r border-vow-border bg-vow-bg">
        <div className="px-6 py-8 border-b border-vow-border">
          <h1 className="vow-heading text-2xl text-vow-ink">VOW</h1>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-px">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => onNavigate(item.view)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                currentView === item.view
                  ? 'text-vow-ink font-medium bg-vow-border/40'
                  : 'text-vow-muted hover:text-vow-ink'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="border-t border-vow-border px-3 py-4">
          <div className="px-3 py-1.5 text-xs text-vow-muted truncate">
            {session?.user?.email}
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-vow-muted hover:text-vow-ink transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-vow-bg border-b border-vow-border px-6 h-14 flex items-center justify-between">
        <h1 className="vow-heading text-xl text-vow-ink">VOW</h1>
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="p-2 text-vow-ink"
        >
          <div className="space-y-1.5">
            <div className={`w-5 h-px bg-current transition-transform ${mobileNavOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <div className={`w-5 h-px bg-current transition-opacity ${mobileNavOpen ? 'opacity-0' : ''}`} />
            <div className={`w-5 h-px bg-current transition-transform ${mobileNavOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </div>
        </button>
      </div>

      {/* Mobile nav drawer */}
      {mobileNavOpen && (
        <div className="md:hidden fixed top-14 left-0 right-0 z-30 bg-vow-bg border-b border-vow-border px-6 py-4 space-y-px">
          {navItems.map((item) => (
            <button
              key={item.view}
              onClick={() => {
                onNavigate(item.view);
                setMobileNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                currentView === item.view ? 'text-vow-ink font-medium' : 'text-vow-muted'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-vow-muted"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}

      {/* Main content */}
      <main className="md:ml-56 pt-14 md:pt-0 min-h-screen">
        <div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-8 pb-6 border-b border-vow-border">
      <div>
        <h1 className="vow-heading text-3xl text-vow-ink mb-1">{title}</h1>
        {subtitle && <p className="text-vow-muted text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function NewButton({ onClick, label = 'New' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="vow-btn-primary"
    >
      <Plus className="w-4 h-4" />
      {label}
    </button>
  );
}
