import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase';
import { NATIVE_OAUTH_REDIRECT } from '@/lib/nativeAuth';
import { Mail, Lock, ArrowRight } from '@/lib/ui-icons';
import { GoogleIcon } from './GoogleIcon';
import { BrandLogo } from './BrandLogo';
import { userFacingError } from '@/lib/userFacingError';
import { AccountSuspendedPage } from './AccountSuspendedPage';

type AuthMode = 'signin' | 'signup'; type AuthMethod = 'options' | 'email';
type AuthPageProps = { suspended?: boolean; onSuspensionDismiss?: () => void };

export function AuthPage({ suspended: accountSuspended = false, onSuspensionDismiss }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('signup'); const [method, setMethod] = useState<AuthMethod>('options');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState(''); const [loading, setLoading] = useState(false); const [suspended, setSuspended] = useState(false);

  const handleAuthError = useCallback((err: unknown) => {
    const detail = err instanceof Error ? err.message : String(err ?? '');
    if (/user.{0,24}banned|banned.?until|account.{0,20}(suspend|ban)|temporarily banned|suspended/i.test(detail)) {
      setSuspended(true);
      setError(null);
      setMessage('');
    } else {
      setError(userFacingError(err, 'Sign-in failed. Please try again.'));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const onOAuthError = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      handleAuthError(new Error(typeof detail === 'string' ? detail : 'Google sign-in failed. Please try again.'));
    };
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const callbackError = params.get('error_description') || params.get('error') || hashParams.get('error_description') || hashParams.get('error');
    if (callbackError) handleAuthError(new Error(callbackError.replace(/\+/g, ' ')));
    window.addEventListener('vow:oauth-error', onOAuthError);
    return () => window.removeEventListener('vow:oauth-error', onOAuthError);
  }, [handleAuthError]);

  function switchMode(next: AuthMode) { setMode(next); setError(null); setMessage(''); }
  async function handleSubmit(event: React.FormEvent) { event.preventDefault(); setError(null); setMessage(''); setSuspended(false); setLoading(true); try {
    if (mode === 'signup') { if (password.length < 12) throw new Error('Use a password with at least 12 characters.'); if (password.length > 128) throw new Error('Use a password with 128 characters or fewer.'); if (await isPasswordCompromised(password)) throw new Error('That password has appeared in a known data breach. Please choose a different password.'); const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password }); if (signUpError) throw signUpError; if (!data.session) setMessage('Check your email to confirm your account, then sign in.'); }
    else { const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); if (signInError) throw signInError; }
  } catch (err) { handleAuthError(err); } finally { setLoading(false); } }
  async function handleGoogle() { setError(null); setMessage(''); setSuspended(false); setLoading(true); try {
    const redirectTo = Capacitor.isNativePlatform() ? NATIVE_OAUTH_REDIRECT : window.location.origin;
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: Capacitor.isNativePlatform() } });
    if (oauthError) throw oauthError; if (Capacitor.isNativePlatform() && data?.url) { const finished = await Browser.addListener('browserFinished', () => setLoading(false)); await Browser.open({ url: data.url }); window.setTimeout(() => { void finished.remove(); setLoading(false); }, 120000); }
  } catch (err) { handleAuthError(err); } }
  return <div className="min-h-screen bg-vow-bg flex flex-col items-center justify-center px-6 py-12"><div className="w-full max-w-sm">
    <div className="text-center mb-10"><BrandLogo className="mx-auto w-28 h-auto mb-6" /><p className="text-vow-muted text-sm tracking-wide">Commit. Schedule. Execute. Review. Adjust.</p></div>
    {(accountSuspended || suspended) ? <AccountSuspendedPage onBack={() => { setSuspended(false); onSuspensionDismiss?.(); setLoading(false); setError(null); setMethod('options'); }} /> : method === 'options' ? <div className="space-y-4">
      <button type="button" onClick={handleGoogle} disabled={loading} className="w-full flex items-center justify-center gap-3 border border-vow-border bg-vow-surface py-3.5 text-sm font-medium text-vow-ink hover:bg-vow-border transition-colors disabled:opacity-40"><GoogleIcon className="w-5 h-5" /> Continue with Google</button>
      <div className="flex items-center gap-4"><div className="h-px flex-1 bg-vow-border" /><span className="text-xs text-vow-muted">or</span><div className="h-px flex-1 bg-vow-border" /></div>
      <button type="button" onClick={() => { setError(null); setMessage(''); setMethod('email'); }} className="w-full flex items-center justify-center gap-3 border border-vow-border bg-vow-surface py-3.5 text-sm font-medium text-vow-ink hover:bg-vow-border transition-opacity"><Mail className="w-5 h-5 shrink-0" /> Continue with Email</button>
    </div> : <><button type="button" onClick={() => { setError(null); setMessage(''); setLoading(false); setMethod('options'); }} className="text-sm text-vow-muted hover:text-vow-ink transition-colors mb-6">← Back</button>
      <div className="flex border border-vow-border mb-6"><button type="button" onClick={() => switchMode('signup')} className={`flex-1 py-3 text-sm transition-colors ${mode === 'signup' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted hover:text-vow-ink'}`}>Create account</button><button type="button" onClick={() => switchMode('signin')} className={`flex-1 py-3 text-sm transition-colors border-l border-vow-border ${mode === 'signin' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted hover:text-vow-ink'}`}>Sign in</button></div>
      <form onSubmit={handleSubmit} className="space-y-5"><div><label className="vow-label block mb-2" htmlFor="vow-email">Email</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" /><input id="vow-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="vow-input pl-10" placeholder="you@example.com" autoComplete="email" disabled={loading} /></div></div><div><label className="vow-label block mb-2" htmlFor="vow-password">Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" /><input id="vow-password" type="password" required minLength={mode === 'signup' ? 12 : 1} value={password} onChange={(e) => setPassword(e.target.value)} className="vow-input pl-10" placeholder={mode === 'signup' ? 'At least 12 characters' : 'Your password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} disabled={loading} /></div></div>{error && <div className="vow-error" role="alert"><span>{error}</span><button type="button" className="vow-error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}{message && <p className="text-xs text-vow-muted" role="status">{message}</p>}<button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-vow-ink text-vow-bg text-sm font-medium py-3 hover:opacity-85 transition-opacity disabled:opacity-40">{loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight className="w-4 h-4" /></button></form>
    </>}
  </div></div>;
}
