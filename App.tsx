import { Component, useEffect, useRef, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { AuthPage } from '@/components/AuthPage';
import { Onboarding } from '@/components/Onboarding';
import { AppShell, type View } from '@/components/AppShell';
import { Dashboard } from '@/components/Dashboard';
import { GoalHistoryActions } from '@/components/GoalHistoryActions';
import { GoalsJournalWorkspace } from '@/components/GoalsJournalWorkspace';
import { ReviewPage } from '@/components/WeeklyReview';
import { ProfilePage } from '@/components/Profile';
import { CalendarPage } from '@/components/Calendar';
import { LegalPage } from '@/components/Legal';
import { NativeCalendarSync } from '@/components/NativeCalendarSync';
import type { UserSettings } from '@/types/database';
import { BrandLogo } from '@/components/BrandLogo';

const SPLASH_MIN_MS = 1400;
const SPLASH_FADE_OUT_MS = 420;
const THEME_SPLASH_MS = 900;

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[VOW] Unhandled app error:', error, info); }
  render() {
    if (!this.state.hasError) return this.props.children;
    return <div className="min-h-screen bg-vow-bg flex items-center justify-center px-6"><div className="max-w-sm w-full text-center"><BrandLogo className="w-40 max-w-full h-auto mx-auto mb-8" /><h1 className="vow-heading text-2xl text-vow-ink mb-3">VOW hit an unexpected error</h1><p className="text-sm text-vow-muted leading-relaxed mb-6">Your saved account data is still stored securely. Reload VOW to continue.</p><button onClick={() => window.location.reload()} className="vow-btn-primary">Reload VOW</button></div></div>;
  }
}

function SplashOverlay({ fadingOut }: { fadingOut: boolean }) {
  const { theme } = useTheme();
  return <div className={`vow-splash-overlay${fadingOut ? ' vow-splash-fading' : ''}`} data-theme={theme} aria-hidden={fadingOut}><BrandLogo className="vow-splash-logo" /></div>;
}

function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => { const on = () => setOffline(false); const off = () => setOffline(true); window.addEventListener('online', on); window.addEventListener('offline', off); return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); }; }, []);
  if (!offline) return null;
  return <div className="fixed top-0 left-0 right-0 z-[60] bg-vow-ink text-vow-bg px-4 py-2 text-center text-xs">You’re offline. VOW will keep what’s already on this device available, but changes that need the server may fail until you reconnect.</div>;
}

function AppContent() {
  const { session, loading } = useAuth();
  const { theme } = useTheme();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [splashMounted, setSplashMounted] = useState(true);
  const [splashFadingOut, setSplashFadingOut] = useState(false);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);
  const firstTheme = useRef(theme);

  useEffect(() => { const timer = window.setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    let cancelled = false;
    if (!session) { setSettings(null); setSettingsLoading(false); return; }
    setSettingsLoading(true);
    supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle().then(({ data, error }) => { if (cancelled) return; if (error) console.error('[VOW] Failed to load user settings:', error); setSettings(data as UserSettings | null); setSettingsLoading(false); }).catch((error) => { if (cancelled) return; console.error('[VOW] User settings request failed:', error); setSettings(null); setSettingsLoading(false); });
    return () => { cancelled = true; };
  }, [session]);
  async function handleOnboardingComplete() { if (!session) return; setSettingsLoading(true); const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(); if (error) console.error('[VOW] Failed to refresh settings:', error); setSettings(data as UserSettings | null); setSettingsLoading(false); }
  const contentReady = !loading && (!session || !settingsLoading);
  useEffect(() => { if (firstTheme.current === theme) return; firstTheme.current = theme; setSplashFadingOut(false); setSplashMounted(true); const timer = window.setTimeout(() => { setSplashFadingOut(true); window.setTimeout(() => setSplashMounted(false), SPLASH_FADE_OUT_MS); }, THEME_SPLASH_MS); return () => window.clearTimeout(timer); }, [theme]);
  useEffect(() => { if (splashMinElapsed && contentReady && !splashFadingOut) { setSplashFadingOut(true); const timer = window.setTimeout(() => setSplashMounted(false), SPLASH_FADE_OUT_MS); return () => window.clearTimeout(timer); } }, [splashMinElapsed, contentReady, splashFadingOut]);

  let content: React.ReactNode;
  if (loading || (session && settingsLoading)) content = <AppLoading />;
  else if (!session) content = <AuthPage />;
  else if (!settings || !settings.onboarding_complete) content = <Onboarding userId={session.user.id} onComplete={handleOnboardingComplete} />;
  else if (view === 'legal') content = <LegalPage onBack={() => setView('profile')} />;
  else content = <AppShell currentView={view} onNavigate={setView}>{view === 'dashboard' && <Dashboard onNavigate={setView} />}{view === 'calendar' && <><NativeCalendarSync /><CalendarPage /></>}{view === 'goals' && <GoalsJournalWorkspace><GoalHistoryActions /></GoalsJournalWorkspace>}{view === 'review' && <ReviewPage />}{view === 'profile' && <ProfilePage onLegal={() => setView('legal')} />}</AppShell>;
  return <><OfflineBanner />{content}{splashMounted && <SplashOverlay fadingOut={splashFadingOut} />}</>;
}

function AppLoading() { return <div className="min-h-screen bg-vow-bg flex items-center justify-center" aria-label="Loading"><div className="vow-loading-dots"><span /><span /><span /></div></div>; }

export default function App() { return <ThemeProvider><AuthProvider><AppErrorBoundary><AppContent /></AppErrorBoundary></AuthProvider></ThemeProvider>; }
