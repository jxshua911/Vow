import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase';
import { NATIVE_OAUTH_REDIRECT } from '@/lib/nativeAuth';
import { Mail, Lock, ArrowRight, ArrowLeft } from '@/lib/ui-icons';
import { GoogleIcon } from './GoogleIcon';
import { BrandLogo } from './BrandLogo';
import { userFacingError } from '@/lib/userFacingError';

function AppleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.08-.13-1.02.34-1.77.16-2.52-.53C5.03 17.02 5.26 9.5 9.4 7.28c1.3-.7 2.53-.3 3.5.15.94.45 2.03.47 3.12-.1 1.36-.71 2.82-.4 3.86.6-3.05 1.87-2.33 5.9.47 7.1-.5 1.4-1.25 2.8-2.3 4.03ZM12.03 7.25C11.88 5.02 13.69 3.18 15.8 3c.29 2.58-2.33 4.5-3.77 4.25Z" /></svg>; }

export function AuthPage() {
  const [emailMode, setEmailMode] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const openEmail = (next: 'signin' | 'signup' = 'signin') => { setMode(next); setEmailMode(true); setError(null); };
  const closeEmail = () => { if (!loading) { setEmailMode(false); setError(null); setEmail(''); setPassword(''); } };

  useEffect(() => {
    function onOAuthError(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      setError(userFacingError(detail, 'Sign-in failed. Please try again.'));
      setLoading(false);
    }
    window.addEventListener('vow:oauth-error', onOAuthError);
    return () => window.removeEventListener('vow:oauth-error', onOAuthError);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (loading) return;
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) { setError('Enter your email and password to continue.'); return; }
    setError(null); setLoading(true);
    try {
      const result = mode === 'signup'
        ? await supabase.auth.signUp({ email: cleanEmail, password })
        : await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) setError('Account created. Check your email to confirm your account.');
    } catch (err) {
      setError(userFacingError(err, mode === 'signup' ? 'We could not create your account. Please try again.' : 'We could not sign you in. Check your details and try again.'));
    } finally { setLoading(false); }
  }

  async function handleOAuthSignIn(provider: 'google' | 'apple') {
    if (loading) return; setError(null); setLoading(true);
    let finished: { remove: () => Promise<void> } | null = null;
    try {
      const options = Capacitor.isNativePlatform() ? { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true } : { redirectTo: window.location.origin };
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options });
      if (oauthError) throw oauthError; if (!data?.url) throw new Error('OAUTH_START_FAILED');
      if (Capacitor.isNativePlatform()) {
        finished = await Browser.addListener('browserFinished', () => { setLoading(false); void finished?.remove(); finished = null; });
        await Browser.open({ url: data.url, presentationStyle: 'fullscreen' });
      } else setLoading(false);
    } catch (err) {
      if (finished) await finished.remove(); finished = null;
      setError(userFacingError(err, 'We could not start sign-in. Please try again.')); setLoading(false);
    }
  }

  return <div className="min-h-screen bg-vow-bg flex flex-col items-center justify-center px-6 py-12"><div className="w-full max-w-sm">
    <div className="text-center mb-12"><BrandLogo className="w-44 max-w-full h-auto mx-auto mb-7" /><p className="text-vow-muted text-sm tracking-wide">Commit. Schedule. Execute. Review. Adjust.</p></div>
    {!emailMode ? <div className="space-y-3">
      <button onClick={() => handleOAuthSignIn('google')} disabled={loading} aria-busy={loading} className="w-full min-h-12 flex items-center justify-center gap-2.5 border border-vow-border py-3 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vow-ink">{loading ? 'Connecting…' : <><GoogleIcon className="w-4 h-4" />Continue with Google</>}</button>
      <button onClick={() => handleOAuthSignIn('apple')} disabled={loading} aria-busy={loading} className="w-full min-h-12 flex items-center justify-center gap-2.5 border border-vow-border py-3 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vow-ink">{loading ? 'Connecting…' : <><AppleIcon />Continue with Apple</>}</button>
      <button onClick={() => openEmail('signin')} disabled={loading} className="w-full min-h-12 flex items-center justify-center gap-2.5 bg-vow-ink text-vow-bg py-3 text-sm font-medium hover:opacity-85 transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vow-ink">{loading ? 'Please wait…' : <><Mail className="w-4 h-4" />Sign in with email</>}</button>
      {error && <div role="alert" className="vow-error mt-4"><p>{error}</p><button type="button" onClick={() => setError(null)} className="vow-error-dismiss" aria-label="Dismiss error">Dismiss</button></div>}
      <p className="text-xs text-vow-muted mt-8 text-center leading-relaxed">New to VOW? <button onClick={() => openEmail('signup')} className="text-vow-ink underline underline-offset-2">Create an account with email</button></p>
    </div> : <div>
      <button onClick={closeEmail} disabled={loading} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vow-ink"><ArrowLeft className="w-4 h-4" />Back</button>
      <div className="flex border border-vow-border mb-8" role="tablist" aria-label="Account action"><button type="button" onClick={() => setMode('signin')} disabled={loading} role="tab" aria-selected={mode === 'signin'} className={`flex-1 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vow-ink ${mode === 'signin' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted'}`}>Sign in</button><button type="button" onClick={() => setMode('signup')} disabled={loading} role="tab" aria-selected={mode === 'signup'} className={`flex-1 py-3 text-sm border-l border-vow-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vow-ink ${mode === 'signup' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted'}`}>Create account</button></div>
      <form onSubmit={handleSubmit} className="space-y-5"><div><label htmlFor="vow-email" className="vow-label block mb-2">Email</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" /><input id="vow-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="vow-input pl-10 min-h-11" placeholder="you@example.com" autoFocus disabled={loading} /></div></div><div><label htmlFor="vow-password" className="vow-label block mb-2">Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" /><input id="vow-password" type="password" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="vow-input pl-10 min-h-11" placeholder="At least 6 characters" disabled={loading} /></div></div>{error && <div role="alert" className="vow-error"><p>{error}</p><button type="button" onClick={() => setError(null)} className="vow-error-dismiss" aria-label="Dismiss error">Dismiss</button></div>}<button type="submit" disabled={loading} aria-busy={loading} className="w-full min-h-12 flex items-center justify-center gap-2 bg-vow-ink text-vow-bg text-sm font-medium py-3 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vow-ink">{loading ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}{!loading && <ArrowRight className="w-4 h-4" />}</button></form>
      <p className="text-xs text-vow-muted mt-8 text-center leading-relaxed">{mode === 'signup' ? 'Your journal and goals are private to you.' : 'Welcome back. Pick up where you left off.'}</p>
    </div>}
  </div></div>;
}
