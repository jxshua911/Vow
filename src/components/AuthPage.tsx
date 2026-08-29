import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase';
import { NATIVE_OAUTH_REDIRECT } from '@/lib/nativeAuth';
import { Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';

function AppleIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.36 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.49 4.09ZM12.03 7.25C11.88 5.02 13.69 3.18 15.8 3c.29 2.58-2.33 4.5-3.77 4.25Z" /></svg>; }

export function AuthPage() {
  const [emailMode, setEmailMode] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); const [loading, setLoading] = useState(false);
  const openEmail = (next: 'signin' | 'signup' = 'signin') => { setMode(next); setEmailMode(true); setError(null); };
  const closeEmail = () => { if (!loading) { setEmailMode(false); setError(null); setEmail(''); setPassword(''); } };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); if (loading) return;
    const cleanEmail = email.trim(); if (!cleanEmail || !password) { setError('Please enter your email and password.'); return; }
    setError(null); setLoading(true);
    try {
      const result = mode === 'signup' ? await supabase.auth.signUp({ email: cleanEmail, password }) : await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) setError('Account created. Check your email to confirm your account.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleOAuthSignIn(provider: 'google' | 'apple') {
    if (loading) return; setError(null); setLoading(true);
    let finished: { remove: () => Promise<void> } | null = null;
    try {
      const options = Capacitor.isNativePlatform() ? { redirectTo: NATIVE_OAUTH_REDIRECT, skipBrowserRedirect: true } : { redirectTo: window.location.origin };
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options });
      if (oauthError) throw oauthError; if (!data?.url) throw new Error('Unable to start sign-in. Please try again.');
      if (Capacitor.isNativePlatform()) {
        finished = await Browser.addListener('browserFinished', () => { setLoading(false); void finished?.remove(); finished = null; });
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
      } else setLoading(false);
    } catch (err) { if (finished) await finished.remove(); finished = null; setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.'); setLoading(false); }
  }

  return <div className="min-h-screen bg-vow-bg flex flex-col items-center justify-center px-6 py-12"><div className="w-full max-w-sm">
    <div className="text-center mb-12"><h1 className="vow-heading text-5xl text-vow-ink mb-3">VOW</h1><p className="text-vow-muted text-sm tracking-wide">Commit. Schedule. Execute. Review. Adjust.</p></div>
    {!emailMode ? <div className="space-y-3">
      <button onClick={() => handleOAuthSignIn('google')} disabled={loading} className="w-full flex items-center justify-center gap-2.5 border border-vow-border py-3 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-40"><GoogleIcon className="w-4 h-4" />Continue with Google</button>
      <button onClick={() => handleOAuthSignIn('apple')} disabled={loading} className="w-full flex items-center justify-center gap-2.5 border border-vow-border py-3 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-40"><AppleIcon />Continue with Apple</button>
      <button onClick={() => openEmail('signin')} disabled={loading} className="w-full flex items-center justify-center gap-2.5 bg-vow-ink text-vow-bg py-3 text-sm font-medium hover:opacity-85 transition-opacity disabled:opacity-40"><Mail className="w-4 h-4" />Sign in with email</button>
      {error && <p className="text-sm text-vow-ink leading-relaxed pt-3 border-l-2 border-vow-ink pl-3">{error}</p>}
      <p className="text-xs text-vow-muted mt-8 text-center leading-relaxed">New to VOW? <button onClick={() => openEmail('signup')} className="text-vow-ink underline underline-offset-2">Create an account with email</button></p>
    </div> : <div>
      <button onClick={closeEmail} disabled={loading} className="text-sm text-vow-muted hover:text-vow-ink mb-6 flex items-center gap-1 transition-colors disabled:opacity-40"><ArrowLeft className="w-4 h-4" />Back</button>
      <div className="flex border border-vow-border mb-8"><button onClick={() => setMode('signin')} disabled={loading} className={`flex-1 py-3 text-sm ${mode === 'signin' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted'}`}>Sign in</button><button onClick={() => setMode('signup')} disabled={loading} className={`flex-1 py-3 text-sm border-l border-vow-border ${mode === 'signup' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted'}`}>Create account</button></div>
      <form onSubmit={handleSubmit} className="space-y-5"><div><label className="vow-label block mb-2">Email</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" /><input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="vow-input pl-10" placeholder="you@example.com" autoFocus disabled={loading} /></div></div><div><label className="vow-label block mb-2">Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" /><input type="password" required minLength={6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className="vow-input pl-10" placeholder="At least 6 characters" disabled={loading} /></div></div>{error && <p className="text-sm text-vow-ink leading-relaxed border-l-2 border-vow-ink pl-3">{error}</p>}<button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-vow-ink text-vow-bg text-sm font-medium py-3 disabled:opacity-40">{loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}<ArrowRight className="w-4 h-4" /></button></form>
      <p className="text-xs text-vow-muted mt-8 text-center leading-relaxed">{mode === 'signup' ? 'Your journal and goals are private to you. No data is shared with third parties.' : 'Welcome back. Pick up where you left off.'}</p>
    </div>}
  </div></div>;
}
