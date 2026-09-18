import { useCallback, useEffect, useRef, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { AuthPage } from '@/components/AuthPage';
import { Onboarding } from '@/components/Onboarding';
import { TermsAcceptance, VOW_TERMS_VERSION } from '@/components/TermsAcceptance';
import { AppShell, type View } from '@/components/AppShell';
import { Dashboard } from '@/components/Dashboard';
import { GoalHistoryActions } from '@/components/GoalHistoryActions';
import { GoalsJournalWorkspace } from '@/components/GoalsJournalWorkspace';
import { ReviewPage } from '@/components/WeeklyReview';
import { ReviewEntitlementBanner } from '@/components/ReviewEntitlementBanner';
import { ProfilePage } from '@/components/Profile';
import { CalendarPage } from '@/components/Calendar';
import { LegalPage } from '@/components/Legal';
import { UpgradePage } from '@/components/Upgrade';
import { NativeCalendarSync } from '@/components/NativeCalendarSync';
import { syncUserUpcomingSessionNotifications } from '@/lib/notifications';
import type { UserSettings } from '@/types/database';
import { BrandLogo } from '@/components/BrandLogo';

const SPLASH_MIN_MS = 1400;
const SPLASH_FADE_OUT_MS = 420;

function SplashOverlay({ fadingOut }: { fadingOut: boolean }) { const { theme } = useTheme(); return <div className={`vow-splash-overlay${fadingOut ? ' vow-splash-fading' : ''}`} data-theme={theme} aria-hidden={fadingOut}><BrandLogo className="vow-splash-logo" /></div>; }

function AppContent() {
  const { session, loading } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsLoading, setTermsLoading] = useState(true);
  const [showTermsLegal, setShowTermsLegal] = useState(false);
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
    if (!session) {
      setSettings(null);
      setSettingsLoading(false);
      setTermsAccepted(false);
      setTermsLoading(false);
      return;
    }
    setSettingsLoading(true);
    setTermsLoading(true);
    void (async () => {
      try {
        const [settingsResult, termsResult] = await Promise.all([
          supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
          supabase.from('vow_terms_acceptances').select('id').eq('user_id', session.user.id).eq('terms_version', VOW_TERMS_VERSION).maybeSingle(),
        ]);
        if (cancelled) return;
        if (settingsResult.error) console.error('[VOW] Failed to load user settings:', settingsResult.error);
        if (termsResult.error) console.error('[VOW] Failed to load terms acceptance:', termsResult.error);
        setSettings(settingsResult.data as UserSettings | null);
        setTermsAccepted(Boolean(termsResult.data));
      } catch (err) {
        console.error('[VOW] Failed to load account state:', err);
        if (cancelled) return;
        setSettings(null);
        setTermsAccepted(false);
      } finally {
        if (!cancelled) {
          setSettingsLoading(false);
          setTermsLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [session]);

  useEffect(() => {
    if (!session || !termsAccepted) return;
    const sync = () => { void syncUserUpcomingSessionNotifications(session.user.id).catch((err) => console.warn('[VOW] Notification sync failed:', err)); };
    sync();
    const listener = CapacitorApp.addListener('resume', sync);
    return () => { listener.then((handle) => handle.remove()); };
  }, [session, termsAccepted]);

  async function handleOnboardingComplete() {
    if (!session) return;
    setSettingsLoading(true);
    const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle();
    if (error) console.error('[VOW] Failed to refresh settings:', error);
    setSettings(data as UserSettings | null); setSettingsLoading(false);
  }

  const contentReady = !loading && !settingsLoading && !termsLoading;
  useEffect(() => { if (splashMinElapsed && contentReady && !splashFadingOut) { setSplashFadingOut(true); const timer = window.setTimeout(() => setSplashMounted(false), SPLASH_FADE_OUT_MS); return () => window.clearTimeout(timer); } }, [splashMinElapsed, contentReady, splashFadingOut]);

  let content: React.ReactNode;
  if (loading || (session && (settingsLoading || termsLoading))) content = <AppLoading />;
  else if (!session) content = <AuthPage />;
  else if (!termsAccepted && showTermsLegal) content = <LegalPage onBack={() => setShowTermsLegal(false)} />;
  else if (!termsAccepted) content = <TermsAcceptance userId={session.user.id} onAccepted={() => setTermsAccepted(true)} onReadLegal={() => setShowTermsLegal(true)} />;
  else if (!settings || !settings.onboarding_complete) content = <Onboarding userId={session.user.id} onComplete={handleOnboardingComplete} />;
  else if (view === 'legal') content = <LegalPage onBack={goBack} />;
  else content = <AppShell currentView={view} onNavigate={navigate}>
    {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
    {view === 'calendar' && <><NativeCalendarSync /><CalendarPage /></>}
    {view === 'goals' && <GoalsJournalWorkspace><GoalHistoryActions /></GoalsJournalWorkspace>}
    {view === 'review' && <><ReviewEntitlementBanner /><ReviewPage /></>}
    {view === 'profile' && <ProfilePage onLegal={() => navigate('legal')} onUpgrade={() => navigate('upgrade')} />}
    {view === 'upgrade' && <UpgradePage />}
  </AppShell>;
  return <>{content}{splashMounted && <SplashOverlay fadingOut={splashFadingOut} />}</>;
}

function AppLoading() { return <div className="min-h-screen bg-vow-bg flex items-center justify-center" aria-label="Loading"><div className="vow-loading-dots"><span /><span /><span /></div></div>; }
export default function App() { return <ThemeProvider><AuthProvider><AppContent /></AuthProvider></ThemeProvider>; }
