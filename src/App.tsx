import { useCallback, useEffect, useRef, useState } from 'react';
import { CapacitorApp } from '@capacitor/app';
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
import { UpgradePage } from '@/components/Upgrade';
import { NativeCalendarSync } from '@/components/NativeCalendarSync';
import type { UserSettings } from '@/types/database';
import { BrandLogo } from '@/components/BrandLogo';

const SPLASH_MIN_MS = 1400;
const SPLASH_FADE_OUT_MS = 420;

function SplashOverlay({ fadingOut }: { fadingOut: boolean }) { const { theme } = useTheme(); return <div className={`vow-splash-overlay${fadingOut ? ' vow-splash-fading' : ''}`} data-theme={theme} aria-hidden={fadingOut}><BrandLogo className="vow-splash-logo" /></div>; }

function AppContent() {
  const { session, loading } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [viewHistory, setViewHistory] = useState<View[]>(['dashboard']);
  const viewHistoryRef = useRef<View[]>(['dashboard']);
  const [splashMounted, setSplashMounted] = useState(true);
  const [splashFadingOut, setSplashFadingOut] = useState(false);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);
  const view = viewHistory[viewHistory.length - 1];

  const navigate = useCallback((next: View) => {
    setViewHistory((current) => {
      if (current[current.length - 1] === next) return current;
      const nextHistory = [...current, next];
      viewHistoryRef.current = nextHistory;
      return nextHistory;
    });
  }, []);

  const goBack = useCallback(() => {
    setViewHistory((current) => {
      if (current.length <= 1) { viewHistoryRef.current = current; return current; }
      const nextHistory = current.slice(0, -1);
      viewHistoryRef.current = nextHistory;
      return nextHistory;
    });
  }, []);

  useEffect(() => { viewHistoryRef.current = viewHistory; }, [viewHistory]);
  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', () => {
      if (viewHistoryRef.current.length > 1) goBack();
      else CapacitorApp.exitApp();
    });
    return () => { listener.then((handle) => handle.remove()); };
  }, [goBack]);
  useEffect(() => { const timer = window.setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    const listener = (event: Event) => {
      const next = (event as CustomEvent<View>).detail;
      if (next) navigate(next);
    };
    window.addEventListener('vow:navigate', listener);
    return () => window.removeEventListener('vow:navigate', listener);
  }, [navigate]);
  useEffect(() => {
    let cancelled = false;
    if (!session) { setSettings(null); setSettingsLoading(false); return; }
    setSettingsLoading(true);
    supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle().then(({ data, error }) => { if (cancelled) return; if (error) console.error('[VOW] Failed to load user settings:', error); setSettings(data as UserSettings | null); setSettingsLoading(false); });
    return () => { cancelled = true; };
  }, [session]);
  async function handleOnboardingComplete() {
    if (!session) return;
    setSettingsLoading(true);
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle();
    if (error) console.error('[VOW] Failed to refresh settings:', error);
    setSettings(data as UserSettings | null); setSettingsLoading(false);
  }
  const contentReady = !loading && (!session || !settingsLoading);
  useEffect(() => { if (splashMinElapsed && contentReady && !splashFadingOut) { setSplashFadingOut(true); const timer = window.setTimeout(() => setSplashMounted(false), SPLASH_FADE_OUT_MS); return () => window.clearTimeout(timer); } }, [splashMinElapsed, contentReady, splashFadingOut]);

  let content: React.ReactNode;
  if (loading || (session && settingsLoading)) content = <AppLoading />;
  else if (!session) content = <AuthPage />;
  else if (!settings || !settings.onboarding_complete) content = <Onboarding userId={session.user.id} onComplete={handleOnboardingComplete} />;
  else if (view === 'legal') content = <LegalPage onBack={goBack} />;
  else content = <AppShell currentView={view} onNavigate={navigate}>
    {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
    {view === 'calendar' && <><NativeCalendarSync /><CalendarPage /></>}
    {view === 'goals' && <GoalsJournalWorkspace><GoalHistoryActions /></GoalsJournalWorkspace>}
    {view === 'review' && <ReviewPage />}
    {view === 'profile' && <ProfilePage onLegal={() => navigate('legal')} />}
    {view === 'upgrade' && <UpgradePage />}
  </AppShell>;
  return <>{content}{splashMounted && <SplashOverlay fadingOut={splashFadingOut} />}</>;
}

function AppLoading() { return <div className="min-h-screen bg-vow-bg flex items-center justify-center" aria-label="Loading"><div className="vow-loading-dots"><span /><span /><span /></div></div>; }
export default function App() { return <ThemeProvider><AuthProvider><AppContent /></AuthProvider></ThemeProvider>; }
