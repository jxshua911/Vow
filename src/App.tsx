import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AuthProvider, useAuth } from '@/lib/auth';
import { ThemeProvider, useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/telemetry';
import { getEntitlementSnapshot, subscribeToEntitlementChanges } from '@/lib/entitlements';
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
import { SupportPage } from '@/components/Support';
import { UpgradePage } from '@/components/Upgrade';
import { NativeCalendarSync } from '@/components/NativeCalendarSync';
import { cancelAllVowNotifications, clearCloudPushRegistration, syncUserUpcomingSessionNotifications } from '@/lib/notifications';
import type { UserSettings } from '@/types/database';
import { BrandLogo } from '@/components/BrandLogo';
import { LanguageContext } from '@/lib/i18n';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { VOW_BUILD_TIER } from '@/lib/buildTier';

const SPLASH_MIN_MS = 1400;
const SPLASH_FADE_OUT_MS = 420;

function SplashOverlay({ fadingOut }: { fadingOut: boolean }) { const { theme } = useTheme(); return <div className={`vow-splash-overlay${fadingOut ? ' vow-splash-fading' : ''}`} data-theme={theme} aria-hidden={fadingOut}><BrandLogo className="vow-splash-logo" /></div>; }

function AppContent() {
  const { session, loading } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsLoading, setTermsLoading] = useState(true);
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
      void track('view_changed', { screen: next });
      return nextHistory;
    });
  }, []);

  const openLegalWebsite = useCallback(() => { navigate('legal'); }, [navigate]);

  const goBack = useCallback(() => {
    setViewHistory((current) => {
      if (current.length <= 1) { viewHistoryRef.current = current; return current; }
      const nextHistory = current.slice(0, -1);
      viewHistoryRef.current = nextHistory;
      void track('view_changed', { screen: nextHistory[nextHistory.length - 1] });
      return nextHistory;
    });
  }, [navigate]);

  useEffect(() => { viewHistoryRef.current = viewHistory; }, [viewHistory]);
  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', () => {
      if (viewHistoryRef.current.length > 1) goBack();
      else CapacitorApp.exitApp();
    });
    return () => { listener.then((handle) => handle.remove()); };
  }, [goBack]);
  useEffect(() => { const timer = window.setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS); return () => window.clearTimeout(timer); }, []);
  useEffect(() => { const timeout = window.setTimeout(() => { setSplashFadingOut(true); setSplashMounted(false); }, 6000); return () => window.clearTimeout(timeout); }, []);
  useEffect(() => {
    const listener = (event: Event) => {
      const next = (event as CustomEvent<View>).detail;
      if (next) navigate(next);
    };
    window.addEventListener('vow:navigate', listener);
    return () => window.removeEventListener('vow:navigate', listener);
  }, [navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listener = LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const extra = event.notification.extra;
      const sessionId = extra && typeof extra === 'object' && 'sessionId' in extra
        ? (extra as { sessionId?: unknown }).sessionId
        : undefined;
      if (typeof sessionId === 'string' && sessionId) {
        window.dispatchEvent(new CustomEvent('vow:navigate', { detail: 'goals' }));
      }
    });
    return () => { listener.then((handle) => handle.remove()); };
  }, []);

  useEffect(() => {
    if (!session) return;
    let active = true;
    void getEntitlementSnapshot().then((snapshot) => {
      if (active && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vow:entitlement-changed', { detail: snapshot }));
      }
    });
    const unsubscribe = subscribeToEntitlementChanges(session.user.id, (snapshot) => {
      if (!active) return;
      window.dispatchEvent(new CustomEvent('vow:entitlement-changed', { detail: snapshot }));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [session]);

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
    if (!session) return;
    void supabase.rpc('vow_sync_personal_build_entitlement', { p_build_tier: VOW_BUILD_TIER }).then(({ error }) => {
      if (error) console.warn('[VOW] Personal build entitlement sync skipped:', error.message);
    });
  }, [session]);

  useEffect(() => {
    if (!session) return;
    let active = true;
    const validateAccount = async () => {
      const { data, error } = await supabase.rpc('vow_account_is_active');
      if (!active) return;
      if (error) {
        console.warn('[VOW] Account status check failed:', error.message);
        return;
      }
      if (data === false) {
        await cancelAllVowNotifications();
        await clearCloudPushRegistration();
        await supabase.auth.signOut({ scope: 'local' });
      }
    };
    void validateAccount();
    const listener = CapacitorApp.addListener('resume', () => { void validateAccount(); });
    const interval = window.setInterval(() => { void validateAccount(); }, 5 * 60 * 1000);
    return () => {
      active = false;
      listener.then((handle) => handle.remove());
      window.clearInterval(interval);
    };
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
  else content = (
    <ProtectedRoute fallback={<AuthPage />}>
      {!termsAccepted ? (
        <TermsAcceptance userId={session.user.id} onAccepted={() => setTermsAccepted(true)} />
      ) : !settings || !settings.onboarding_complete ? (
        <Onboarding userId={session.user.id} onComplete={handleOnboardingComplete} />
      ) : view === 'legal' ? (
        <LegalPage onBack={goBack} />
      ) : view === 'support' ? (
        <SupportPage onBack={goBack} />
      ) : (
        <AppShell currentView={view} onNavigate={navigate}>
          {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {view === 'calendar' && <><NativeCalendarSync /><CalendarPage /></>}
          {view === 'goals' && <GoalsJournalWorkspace><GoalHistoryActions /></GoalsJournalWorkspace>}
          {view === 'review' && <><ReviewEntitlementBanner /><ReviewPage /></>}
          {view === 'profile' && <ProfilePage onLegal={() => void openLegalWebsite()} onUpgrade={() => navigate('upgrade')} />}
          {view === 'upgrade' && <UpgradePage />}
        </AppShell>
      )}
    </ProtectedRoute>
  );
  return <LanguageContext.Provider value={settings?.preferred_language || localStorage.getItem('vow:language') || 'en'}>{content}{splashMounted && <SplashOverlay fadingOut={splashFadingOut} />}</LanguageContext.Provider>;
}

function AppLoading() { return <div className="min-h-screen bg-vow-bg flex items-center justify-center" aria-label="Loading"><div className="vow-loading-dots"><span /><span /><span /></div></div>; }
export default function App() { return <ThemeProvider><AuthProvider><AppContent /></AuthProvider></ThemeProvider>; }
