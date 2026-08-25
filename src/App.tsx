import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { AuthPage } from '@/components/AuthPage';
import { Onboarding } from '@/components/Onboarding';
import { AppShell, type View } from '@/components/AppShell';
import { Dashboard } from '@/components/Dashboard';
import { GoalsPage } from '@/components/Goals';
import { JournalPage } from '@/components/Journal';
import { ReviewPage } from '@/components/WeeklyReview';
import type { UserSettings } from '@/types/database';

const SPLASH_MIN_MS = 2800;
const SPLASH_FADE_OUT_MS = 480;

function SplashOverlay({ fadingOut }: { fadingOut: boolean }) {
  return (
    <div
      className={`vow-splash-overlay${fadingOut ? ' vow-splash-fading' : ''}`}
      aria-hidden={fadingOut}
    >
      <img
        src="/Vow-Loading_Screen.png"
        alt="VOW"
        className="vow-splash-logo"
      />
    </div>
  );
}

function AppContent() {
  const { session, loading } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [view, setView] = useState<View>('dashboard');

  const [splashMounted, setSplashMounted] = useState(true);
  const [splashFadingOut, setSplashFadingOut] = useState(false);
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!session) {
      setSettings(null);
      setSettingsLoading(false);
      return;
    }

    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setSettings(data as UserSettings | null);
        setSettingsLoading(false);
      });
  }, [session]);

  function handleOnboardingComplete() {
    setSettingsLoading(true);
    supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session!.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setSettings(data as UserSettings | null);
        setSettingsLoading(false);
      });
  }

  const contentReady = !loading && (!session || !settingsLoading);

  useEffect(() => {
    if (splashMinElapsed && contentReady && !splashFadingOut) {
      setSplashFadingOut(true);
      const timer = window.setTimeout(
        () => setSplashMounted(false),
        SPLASH_FADE_OUT_MS,
      );
      return () => window.clearTimeout(timer);
    }
  }, [splashMinElapsed, contentReady, splashFadingOut]);

  let content: React.ReactNode;
  if (loading || (session && settingsLoading)) {
    content = (
      <div className="min-h-screen bg-vow-bg flex items-center justify-center">
        <div className="text-vow-muted text-sm">Loading...</div>
      </div>
    );
  } else if (!session) {
    content = <AuthPage />;
  } else if (!settings || !settings.onboarding_complete) {
    content = (
      <Onboarding userId={session.user.id} onComplete={handleOnboardingComplete} />
    );
  } else {
    content = (
      <AppShell currentView={view} onNavigate={setView}>
        {view === 'dashboard' && <Dashboard onNavigate={setView} />}
        {view === 'goals' && <GoalsPage />}
        {view === 'journal' && <JournalPage />}
        {view === 'review' && <ReviewPage />}
      </AppShell>
    );
  }

  return (
    <>
      {content}
      {splashMounted && <SplashOverlay fadingOut={splashFadingOut} />}
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
