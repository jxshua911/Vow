import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';

export type View = 'dashboard' | 'calendar' | 'goals' | 'review' | 'profile' | 'upgrade' | 'legal';

interface AppShellProps { currentView: View; onNavigate: (view: View) => void; children: ReactNode; }

const navItems: { view: Exclude<View, 'legal' | 'upgrade'>; label: string; icon: ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="4" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="4" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { view: 'calendar', label: 'Calendar', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 3.5V7.5M16 3.5V7.5M4 9.5H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 13H8.01M12 13H12.01M16 13H16.01M8 16.5H8.01M12 16.5H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
  { view: 'goals', label: 'Goals', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="1.25" fill="currentColor"/></svg> },
  { view: 'review', label: 'Review', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><path d="M19 12A7 7 0 1 1 17 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M17 4.5V7.5H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { view: 'profile', label: 'Profile', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 19C6.4 15.8 8.6 14 12 14C15.4 14 17.6 15.8 18.5 19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
];

export function AppShell({ currentView, onNavigate, children }: AppShellProps) {
  const { session } = useAuth();
  async function handleSignOut() { await supabase.auth.signOut(); }
  return <div className="min-h-screen bg-vow-bg">
    <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56 border-r border-vow-border bg-vow-bg">
      <div className="px-6 py-7 border-b border-vow-border"><BrandLogo className="w-28 h-auto" /></div>
      <nav className="flex-1 px-3 py-6 space-y-px overflow-y-auto">{navItems.map((item) => <button key={item.view} onClick={() => onNavigate(item.view)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${currentView === item.view ? 'text-vow-ink font-medium bg-vow-border/40' : 'text-vow-muted hover:text-vow-ink'}`}><span className={`flex items-center justify-center transition-opacity ${currentView === item.view ? 'opacity-100' : 'opacity-70'}`}>{item.icon}</span>{item.label}</button>)}
        <button onClick={() => onNavigate('upgrade')} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${currentView === 'upgrade' ? 'text-vow-ink font-medium bg-vow-border/40' : 'text-vow-muted hover:text-vow-ink'}`}><span className="flex items-center justify-center" aria-hidden="true">✦</span>Premium</button>
      </nav>
      <div className="border-t border-vow-border px-3 py-4"><div className="px-3 py-1.5 text-xs text-vow-muted truncate">{session?.user?.email}</div><button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-vow-muted hover:text-vow-ink transition-colors"><span aria-hidden="true">↪</span>Sign out</button></div>
    </aside>
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-vow-bg border-b border-vow-border px-6 flex items-center" style={{ height: 'calc(3.5rem + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}><BrandLogo className="w-20 h-auto" /></header>
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-vow-bg border-t border-vow-border" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}><div className="grid grid-cols-6 min-h-16">{navItems.map((item) => { const active = currentView === item.view; return <button key={item.view} onClick={() => onNavigate(item.view)} className={`flex flex-col items-center justify-center gap-1 px-1 transition-colors ${active ? 'text-vow-ink' : 'text-vow-muted hover:text-vow-ink'}`} aria-label={item.label}><span className={`flex items-center justify-center transition-transform ${active ? 'scale-105' : ''}`}>{item.icon}</span><span className={`text-[9px] tracking-wide ${active ? 'font-medium' : ''}`}>{item.label}</span></button>; })}<button onClick={() => onNavigate('upgrade')} className={`flex flex-col items-center justify-center gap-1 px-1 transition-colors ${currentView === 'upgrade' ? 'text-vow-ink' : 'text-vow-muted hover:text-vow-ink'}`} aria-label="Premium"><span className="flex items-center justify-center">✦</span><span className={`text-[9px] tracking-wide ${currentView === 'upgrade' ? 'font-medium' : ''}`}>Premium</span></button></div></nav>
    <main className="md:ml-56 min-h-screen" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}><div className="px-6 md:px-12 py-8 md:py-12 max-w-4xl">{children}</div></main>
  </div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) { return <div className="flex items-start justify-between mb-8 pb-6 border-b border-vow-border"><div><h1 className="vow-heading text-2xl md:text-3xl text-vow-ink mb-1">{title}</h1>{subtitle && <p className="text-vow-muted text-sm">{subtitle}</p>}</div>{action}</div>; }
export function NewButton({ onClick, label = 'New' }: { onClick: () => void; label?: string }) { return <button onClick={onClick} className="vow-btn-primary"><span aria-hidden="true">＋</span>{label}</button>; }
