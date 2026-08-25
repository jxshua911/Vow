import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  LayoutDashboard,
  Target,
  BookOpen,
  ClipboardList,
  User,
  LogOut,
  Plus,
} from 'lucide-react';
import type { ReactNode } from 'react';

export type View = 'dashboard' | 'goals' | 'journal' | 'review' | 'profile';

interface AppShellProps {
  currentView: View;
  onNavigate: (view: View) => void;
  children: ReactNode;
}

export function AppShell({
  currentView,
  onNavigate,
  children,
}: AppShellProps) {
  const { session } = useAuth();

  const navItems: {
    view: View;
    label: string;
    icon: typeof Target;
  }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { view: 'goals', label: 'Goals', icon: Target },
    { view: 'journal', label: 'Journal', icon: BookOpen },
    { view: 'review', label: 'Review', icon: ClipboardList },
    { view: 'profile', label: 'Profile', icon: User },
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

      {/* Mobile header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-vow-bg border-b border-vow-border flex items-center px-5">
        <h1 className="vow-heading text-xl text-vow-ink">VOW</h1>
      </header>

      {/* Main content */}
      <main className="md:ml-56 min-h-screen pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="px-5 md:px-12 py-7 md:py-12 max-w-4xl">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-vow-bg border-t border-vow-border">
        <div className="grid grid-cols-5 h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.view;

            return (
              <button
                key={item.view}
                onClick={() => onNavigate(item.view)}
                className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                  active ? 'text-vow-ink' : 'text-vow-muted'
                }`}
              >
                <Icon
                  className={`w-5 h-5 ${
                    active ? 'stroke-[2.25]' : 'stroke-[1.5]'
                  }`}
                />

                <span
                  className={`text-[10px] leading-none ${
                    active ? 'font-medium' : ''
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-8 pb-6 border-b border-vow-border">
      <div>
        <h1 className="vow-heading text-3xl text-vow-ink mb-1">
          {title}
        </h1>

        {subtitle && (
          <p className="text-vow-muted text-sm">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  );
}

export function NewButton({
  onClick,
  label = 'New',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button onClick={onClick} className="vow-btn-primary">
      <Plus className="w-4 h-4" />
      {label}
    </button>
  );
}
