import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
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
import { cancelAllVowNotifications, clearCloudPushRegistration, getNotificationPermission, requestNotificationPermission, setNotificationPreferences, isRemotePushConfigured, setupCloudPushActionListener, setupCloudPushNotifications, syncUserUpcomingSessionNotifications } from '@/lib/notifications';
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
  const [accountSuspended, setAccountSuspended] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsLoading, setTermsLoading] = useState(true);
  const accountStateReady = useRef(false);
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
  }, []);

  useEffect(() => { viewHistoryRef.current = viewHistory; }, [viewHistory]);
  useEffect(() => {
    const listener = CapacitorApp.addListener('backButton', () => {
      // Give nested planner/detail screens first chance to consume Android back.
      const backEvent = new CustomEvent('vow:hardware-back', { cancelable: true });
      if (!window.dispatchEvent(backEvent)) return;
      if (viewHistoryRef.current.length > 1) goBack();
      else CapacitorApp.exitApp();
    });
    return () => { listener.then((handle) => handle.remove()); };
  }, [goBack]);
  useEffect(() => {
    if (!splashMounted) return;
    const timer = window.setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS);
    const timeout = window.setTimeout(() => { setSplashFadingOut(true); setSplashMounted(false); }, 6000);
    return () => { window.clearTimeout(timer); window.clearTimeout(timeout); };
  }, [splashMounted]);
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
      accountStateReady.current = false;
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
        const { data: accountState, error: accountStateError } = await supabase.rpc('vow_restore_or_purge_account');
        if (accountStateError) {
          console.warn('[VOW] Account-state verification is unavailable:', accountStateError.message);
          // A temporary network outage must not sign a returning user out of their
          // locally persisted session. The server remains authoritative when online.
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            await supabase.auth.signOut({ scope: 'local' });
            return;
          }
        } else if (accountState?.status === 'purged') {
          await supabase.auth.signOut({ scope: 'local' });
          return;
        }
        accountStateReady.current = true;

        const [settingsResult, termsResult] = await Promise.all([
          supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
          supabase.from('vow_terms_acceptances').select('id').eq('user_id', session.user.id).eq('terms_version', VOW_TERMS_VERSION).maybeSingle(),
        ]);
        if (cancelled) return;
        const settingsCacheKey = `vow:offline-settings:${session.user.id}`;
        const termsCacheKey = `vow:terms-accepted:${session.user.id}:${VOW_TERMS_VERSION}`;
        let cachedSettings: UserSettings | null = null;
        let cachedTerms = false;
        try {
          const rawSettings = localStorage.getItem(settingsCacheKey);
          if (rawSettings) cachedSettings = JSON.parse(rawSettings) as UserSettings;
          cachedTerms = localStorage.getItem(termsCacheKey) === 'true';
        } catch { /* Storage may be unavailable or contain an invalid cache. */ }

        if (settingsResult.error) console.warn('[VOW] Failed to load user settings:', settingsResult.error.message);
        if (termsResult.error) console.warn('[VOW] Failed to load terms acceptance:', termsResult.error.message);
        const resolvedSettings = settingsResult.data as UserSettings | null;
        if (resolvedSettings) {
          setSettings(resolvedSettings);
          try { localStorage.setItem(settingsCacheKey, JSON.stringify(resolvedSettings)); } catch { /* Offline cache is best-effort. */ }
        } else {
          setSettings(cachedSettings);
        }
        if (termsResult.data) {
          setTermsAccepted(true);
          try { localStorage.setItem(termsCacheKey, 'true'); } catch { /* Offline cache is best-effort. */ }
        } else if (termsResult.error && typeof navigator !== 'undefined' && !navigator.onLine) {
          // Offline launch: don't turn a transient read failure into a new legal gate.
          // If this is a returning account, allow offline access and reconcile on reconnect.
          setTermsAccepted(true);
        } else {
          setTermsAccepted(cachedTerms);
        }
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
    const reconcileOfflineState = async () => {
      const [settingsResult, termsResult] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('vow_terms_acceptances').select('id').eq('user_id', session.user.id).eq('terms_version', VOW_TERMS_VERSION).maybeSingle(),
      ]);
      if (settingsResult.data) {
        setSettings(settingsResult.data as UserSettings);
        try { localStorage.setItem(`vow:offline-settings:${session.user.id}`, JSON.stringify(settingsResult.data)); } catch { /* best-effort cache */ }
      }
      if (!termsResult.error) {
        const accepted = Boolean(termsResult.data);
        setTermsAccepted(accepted);
        try {
          const key = `vow:terms-accepted:${session.user.id}:${VOW_TERMS_VERSION}`;
          if (accepted) localStorage.setItem(key, 'true');
          else localStorage.removeItem(key);
        } catch { /* best-effort cache */ }
      }
    };
    window.addEventListener('online', reconcileOfflineState);
    return () => window.removeEventListener('online', reconcileOfflineState);
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
      if (!accountStateReady.current) return;
      const { data, error } = await supabase.rpc('vow_account_is_active');
      if (!active) return;
      if (error) {
        console.warn('[VOW] Account status check failed:', error.message);
        return;
      }
      if (data === false) {
        setAccountSuspended(true);
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
    if (!session || !termsAccepted || !Capacitor.isNativePlatform()) return;
    const promptKey = `vow:notification-permission-prompted:${session.user.id}`;
    try {
      if (localStorage.getItem(promptKey) === 'true') return;
    } catch {
      // Continue; the OS permission state remains authoritative.
    }

    void requestNotificationPermission()
      .then(async (permission) => {
        // The first-run OS prompt is also the user's choice to enable VOW
        // reminders. Keep the in-app preference aligned on that first grant;
        // later manual opt-outs are respected because this prompt runs once.
        if (permission === 'granted') {
          try {
            await setNotificationPreferences({ enabled: true });
          } catch (preferenceError) {
            console.warn('[VOW] Notification permission was granted, but the reminder preference could not be enabled:', preferenceError);
          }
        }
        try { localStorage.setItem(promptKey, 'true'); } catch { /* ignore */ }
      })
      .catch((err) => {
        console.warn('[VOW] Notification permission request failed:', err);
        try { localStorage.setItem(promptKey, 'true'); } catch { /* ignore */ }
      });
  }, [session, termsAccepted]);

  useEffect(() => {
    if (!session || !termsAccepted) return;

    let active = true;
    let cleanupPushAction: (() => void) | null = null;

    // Only setup push if permission already granted
    void getNotificationPermission()
      .then((permission) => {
        if (permission === 'granted' && isRemotePushConfigured()) {
          return setupCloudPushNotifications();
        }
      })
      .catch((err) => {
        console.warn('[VOW] Cloud push setup failed:', err);
      });

    void setupCloudPushActionListener(() => {
      window.dispatchEvent(new CustomEvent('vow:navigate', { detail: 'goals' }));
    }).then((cleanup) => {
      if (active) cleanupPushAction = cleanup;
      else cleanup();
    }).catch((err) => {
      console.warn('[VOW] Push action listener setup failed:', err);
    });

    return () => {
      active = false;
      cleanupPushAction?.();
    };
  }, [session, termsAccepted]);

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
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !contentReady) return;
    // Keep the native branded launch screen visible until the React app and its
    // initial account state are ready, then reveal the already-mounted web splash.
    void SplashScreen.hide().catch((error) => console.warn('[VOW] Native splash could not be hidden:', error));
  }, [contentReady]);
  useEffect(() => { if (splashMounted && splashMinElapsed && contentReady && !splashFadingOut) { setSplashFadingOut(true); const timer = window.setTimeout(() => setSplashMounted(false), SPLASH_FADE_OUT_MS); return () => window.clearTimeout(timer); } }, [splashMounted, splashMinElapsed, contentReady, splashFadingOut]);

  let content: React.ReactNode;
  if (loading || (session && (settingsLoading || termsLoading))) content = <AppLoading />;
  else if (!session) content = <AuthPage suspended={accountSuspended} onSuspensionDismiss={() => setAccountSuspended(false)} />;
  else content = (
    <ProtectedRoute fallback={<AuthPage suspended={accountSuspended} onSuspensionDismiss={() => setAccountSuspended(false)} />}>
      {!termsAccepted ? (
        <TermsAcceptance userId={session.user.id} onAccepted={() => setTermsAccepted(true)} />
      ) : !settings || !settings.onboarding_complete ? (
        <Onboarding userId={session.user.id} onComplete={handleOnboardingComplete} />
      ) : view === 'legal' ? (
        <LegalPage onBack={goBack} />
      ) : view === 'support' ? (
        <SupportPage onBack={goBack} onLegal={openLegalWebsite} />
      ) : (
        <AppShell currentView={view} onNavigate={navigate}>
          {view === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {view === 'calendar' && <><NativeCalendarSync /><CalendarPage /></>}
          {view === 'goals' && <GoalsJournalWorkspace><GoalHistoryActions /></GoalsJournalWorkspace>}
          {view === 'review' && <><ReviewEntitlementBanner /><ReviewPage /></>}
          {view === 'profile' && <ProfilePage onLegal={() => void openLegalWebsite()} />}
          {view === 'upgrade' && <UpgradePage />}
        </AppShell>
      )}
    </ProtectedRoute>
  );
  return <LanguageContext.Provider value={settings?.preferred_language || localStorage.getItem('vow:language') || 'en'}>{content}{splashMounted && <SplashOverlay fadingOut={splashFadingOut} />}</LanguageContext.Provider>;
}

function AppLoading() { return <div className="min-h-screen bg-vow-bg flex items-center justify-center" aria-label="Loading"><div className="vow-loading-dots"><span /><span /><span /></div></div>; }
export default function App() { return <ThemeProvider><AuthProvider><AppContent /></AuthProvider></ThemeProvider>; }
