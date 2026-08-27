import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { AuthPage } from '@/components/AuthPage';
import { Onboarding } from '@/components/Onboarding';
import { AppShell, type View } from '@/components/AppShell';
import { Dashboard } from '@/components/Dashboard';
import { GoalsPage } from '@/components/Goals';
import { GoalHistoryActions } from '@/components/GoalHistoryActions';
import { JournalPage } from '@/components/Journal';
import { ReviewPage } from '@/components/WeeklyReview';
import { ProfilePage } from '@/components/Profile';
import { CalendarPage } from '@/components/Calendar';
import { ConnectPage } from '@/components/Connect';
import { LegalPage } from '@/components/Legal';
import { NativeCalendarSync } from '@/components/NativeCalendarSync';
import type { UserSettings } from '@/types/database';

const SPLASH_MIN_MS = 900;
const SPLASH_FADE_OUT_MS = 320;

function SplashOverlay({ fadingOut }: { fadingOut: boolean }) {
  return <div className={`vow-splash-overlay${fadingOut ? ' vow-splash-fading' : ''}`} aria-hidden={fadingOut}><img src="/Vow-Loading_Screen.png" alt="VOW" className="vow-splash-logo" /></div>;
}

function AppContent() {
  const { session, loading } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');
  const [splashMounted, setSplashMounted] = useState(true);
  const [splashFadingOut, setSplashFadingOut] = useState(false);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);

  useEffect(() => { const timer = window.setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    let cancelled = false;
    if (!session) { setSettings(null); setSettingsLoading(false); return; }
    setSettingsLoading(true);
    supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error('[VOW] Failed to load user settings:', error);
      setSettings(data as UserSettings | null); setSettingsLoading(false);
    });
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
  useEffect(() => {
    if (splashMinElapsed && contentReady && !splashFadingOut) {
      setSplashFadingOut(true);
      const timer = window.setTimeout(() => setSplashMounted(false), SPLASH_FADE_OUT_MS);
      return () => window.clearTimeout(timer);
    }
  }, [splashMinElapsed, contentReady, splashFadingOut]);

  let content: React.ReactNode;
  if (loading || (session && settingsLoading)) content = <div className="min-h-screen bg-vow-bg flex items-center justify-center"><div className="text-vow-muted text-sm">Loading...</div></div>;
  else if (!session) content = <AuthPage />;
  else if (!settings || !settings.onboarding_complete) content = <Onboarding userId={session.user.id} onComplete={handleOnboardingComplete} />;
  else if (view === 'legal') content = <LegalPage onBack={() => setView('profile')} />;
  else content = <AppShell currentView={view} onNavigate={setView}>
    <NativeCalendarSync />
    {view === 'dashboard' && <Dashboard onNavigate={setView} />}
    {view === 'calendar' && <CalendarPage />}
    {view === 'goals' && <><GoalsPage /><GoalHistoryActions /></>}
    {view === 'journal' && <JournalPage />}
    {view === 'review' && <ReviewPage />}
    {view === 'profile' && <ProfilePage onLegal={() => setView('legal')} />}
    {view === 'connect' && <ConnectPage />}
  </AppShell>;

  return <>{content}{splashMounted && <SplashOverlay fadingOut={splashFadingOut} />}</>;
}

export default function App() { return <AuthProvider><AppContent /></AuthProvider>; }
