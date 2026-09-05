import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';

export type View = 'dashboard' | 'calendar' | 'goals' | 'review' | 'profile' | 'legal';
interface AppShellProps { currentView: View; onNavigate: (view: View) => void; children: ReactNode; }

const navItems: { view: Exclude<View, 'legal'>; label: string; icon: ReactNode }[] = [
  { view: 'dashboard', label: 'Dashboard', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><path d="M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
  { view: 'calendar', label: 'Calendar', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><rect x="4.5" y="5.5" width="15" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 3.5v4M16 3.5v4M4.5 10h15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
  { view: 'goals', label: 'Goals', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg> },
  { view: 'review', label: 'Review', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><path d="M18.5 9A7.5 7.5 0 1 0 19 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M18.5 4.5V9H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { view: 'profile', label: 'Profile', icon: <svg viewBox="0 0 24 24" fill="none" className="w-[21px] h-[21px]" aria-hidden="true"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M5.5 19c.9-3.1 3.1-5 6.5-5s5.6 1.9 6.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
];

export function AppShell({ currentView, onNavigate, children }: AppShellProps) {
  const { session } = useAuth();
  async function handleSignOut() { await supabase.auth.signOut(); }
  return <div className="min-h-screen bg-vow-bg">
    <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-56 border-r border-vow-border bg-vow-bg">
      <div className="px-6 py-7 border-b border-vow-border"><BrandLogo className="w-28 h-auto" /></div>
      <nav className="flex-1 px-3 py-6 space-y-px overflow-y-auto">{navItems.map((item) => <button key={item.view} onClick={() => onNavigate(item.view)} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${currentView === item.view ? 'text-vow-ink font-medium bg-vow-border/40' : 'text-vow-muted hover:text-vow-ink'}`}><span className={`flex items-center justify-center transition-transform ${currentView === item.view ? 'scale-105' : 'opacity-70'}`}>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="border-t border-vow-border px-3 py-4"><div className="px-3 py-1.5 text-xs text-vow-muted truncate">{session?.user?.email}</div><button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-vow-muted hover:text-vow-ink transition-colors"><span aria-hidden="true">↪</span>Sign out</button></div>
    </aside>
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-vow-bg border-b border-vow-border px-6 flex items-center" style={{ height: 'calc(3.5rem + env(safe-area-inset-top))', paddingTop: 'env(safe-area-inset-top)' }}><BrandLogo className="w-20 h-auto" /></header>
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-vow-bg border-t border-vow-border"><div className="grid grid-cols-5 min-h-16" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>{navItems.map((item) => { const active = currentView === item.view; return <button key={item.view} onClick={() => onNavigate(item.view)} className={`relative flex flex-col items-center justify-center gap-1 px-1 transition-colors ${active ? 'text-vow-ink' : 'text-vow-muted hover:text-vow-ink'}`} aria-label={item.label}><span className={`flex items-center justify-center transition-transform ${active ? 'scale-110' : ''}`}>{item.icon}</span><span className={`text-[10px] tracking-wide ${active ? 'font-medium' : ''}`}>{item.label}</span>{active && <span className="absolute bottom-1 h-0.5 w-5 bg-vow-ink" aria-hidden="true" />}</button>; })}</div></nav>
    <main className="md:ml-56 min-h-screen" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}><div className="px-6 md:px-12 py-8 md:py-12 max-w-5xl">{children}</div></main>
  </div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) { return <div className="flex items-start justify-between mb-8 pb-6 border-b border-vow-border"><div><h1 className="vow-heading text-2xl md:text-3xl text-vow-ink mb-1">{title}</h1>{subtitle && <p className="text-vow-muted text-sm">{subtitle}</p>}</div>{action}</div>; }
export function NewButton({ onClick, label = 'New' }: { onClick: () => void; label?: string }) { return <button onClick={onClick} className="vow-btn-primary"><span aria-hidden="true">＋</span>{label}</button>; }
