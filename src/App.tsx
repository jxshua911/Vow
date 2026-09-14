import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { checkVowAccess } from '@/lib/accessGate';
import { AuthPage } from '@/components/AuthPage';
import { Onboarding } from '@/components/Onboarding';
import { AppShell, type View } from '@/components/AppShell';
import { Dashboard } from '@/components/Dashboard';
import { GoalHistoryActions } from '@/components/GoalHistoryActions';
import { GoalsJournalWorkspace } from '@/components/GoalsJournalWorkspace';
import { ReviewPage } from '@/components/WeeklyReview';
import { ProfilePage } from '@/components/Profile';
import { CalendarPage } from '@/components/Calendar';
import { PremiumPage } from '@/components/Premium';
import { LegalPage } from '@/components/Legal';
import { NativeCalendarSync } from '@/components/NativeCalendarSync';
import type { UserSettings } from '@/types/database';
import { BrandLogo } from '@/components/BrandLogo';

const SPLASH_MIN_MS = 900;
const SPLASH_FADE_OUT_MS = 280;
const CALENDAR_CACHE_KEY = 'vow:calendar-events';

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
  const [accessAllowed, setAccessAllowed] = useState<boolean | null>(null);
  const [accessMessage, setAccessMessage] = useState('');
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
    let cancelled = false;
    checkVowAccess().then((result) => {
      if (cancelled) return;
      setAccessAllowed(result.allowed);
      setAccessMessage(result.message || '');
    }).catch((error) => {
      if (cancelled) return;
      console.error('[VOW] Access gate failed:', error);
      setAccessAllowed(false);
      setAccessMessage('VOW could not verify access right now. Please try again.');
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (!session) { setSettings(null); setSettingsLoading(false); return; }
    localStorage.removeItem(CALENDAR_CACHE_KEY);
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
  const contentReady = accessAllowed !== null && !loading && (!session || !settingsLoading);
  useEffect(() => { if (splashMinElapsed && contentReady && !splashFadingOut) { setSplashFadingOut(true); const timer = window.setTimeout(() => setSplashMounted(false), SPLASH_FADE_OUT_MS); return () => window.clearTimeout(timer); } }, [splashMinElapsed, contentReady, splashFadingOut]);

  let content: React.ReactNode;
  if (accessAllowed === null || loading || (session && settingsLoading)) content = <AppLoading />;
  else if (!accessAllowed) content = <AccessBlocked message={accessMessage} />;
  else if (!session) content = <AuthPage />;
  else if (!settings || !settings.onboarding_complete) content = <Onboarding userId={session.user.id} onComplete={handleOnboardingComplete} />;
  else if (view === 'legal') content = <LegalPage onBack={goBack} />;
  else content = <AppShell currentView={view} onNavigate={navigate}>
    {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
    {view === 'calendar' && <><NativeCalendarSync /><CalendarPage /></>}
    {view === 'goals' && <GoalsJournalWorkspace><GoalHistoryActions /></GoalsJournalWorkspace>}
    {view === 'review' && <ReviewPage />}
    {view === 'premium' && <PremiumPage />}
    {view === 'profile' && <ProfilePage onLegal={() => navigate('legal')} />}
  </AppShell>;
  return <>{content}{splashMounted && <SplashOverlay fadingOut={splashFadingOut} />}</>;
}

function AccessBlocked({ message }: { message: string }) {
  return <div className="min-h-screen bg-vow-bg text-vow-text flex items-center justify-center px-6 text-center">
    <div className="max-w-md space-y-4">
      <BrandLogo className="mx-auto h-12 w-auto" />
      <h1 className="text-2xl font-semibold">Access restricted</h1>
      <p className="text-vow-muted">{message || 'Access to VOW is currently restricted from this network address.'}</p>
      <button type="button" onClick={() => window.location.reload()} className="vow-button-primary">Try again</button>
    </div>
  </div>;
}

function AppLoading() { return <div className="min-h-screen bg-vow-bg flex items-center justify-center" aria-label="Loading"><div className="vow-loading-dots"><span /><span /><span /></div></div>; }
export default function App() { return <ThemeProvider><AuthProvider><AppContent /></AuthProvider></ThemeProvider>; }
