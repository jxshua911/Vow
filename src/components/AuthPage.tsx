import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { supabase } from '@/lib/supabase';
import { NATIVE_OAUTH_REDIRECT } from '@/lib/nativeAuth';
import { Mail, Lock, ArrowRight } from '@/lib/ui-icons';
import { GoogleIcon } from './GoogleIcon';
import { BrandLogo } from './BrandLogo';
import { userFacingError } from '@/lib/userFacingError';

type AuthMode = 'signin' | 'signup';

export function AuthPage() {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
    setMessage('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage('');
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signUpError) throw signUpError;
        if (!data.session) setMessage('Check your email to confirm your account, then sign in.');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(userFacingError(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setMessage('');
    setLoading(true);
    try {
      const redirectTo = Capacitor.isNativePlatform() ? NATIVE_OAUTH_REDIRECT : window.location.origin;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: Capacitor.isNativePlatform() },
      });
      if (oauthError) throw oauthError;
      if (Capacitor.isNativePlatform() && data?.url) await Browser.open({ url: data.url });
    } catch (err) {
      setError(userFacingError(err, 'Google sign-in failed. Please try again.'));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-vow-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <BrandLogo className="mx-auto w-16 h-16 mb-5" />
          <h1 className="vow-heading text-4xl text-vow-ink mb-2">VOW</h1>
          <p className="text-vow-muted text-sm tracking-wide">Commit. Schedule. Execute. Review. Adjust.</p>
        </div>

        <div className="flex border border-vow-border mb-6">
          <button type="button" onClick={() => switchMode('signup')} className={`flex-1 py-3 text-sm transition-colors ${mode === 'signup' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted hover:text-vow-ink'}`}>Create account</button>
          <button type="button" onClick={() => switchMode('signin')} className={`flex-1 py-3 text-sm transition-colors border-l border-vow-border ${mode === 'signin' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted hover:text-vow-ink'}`}>Sign in</button>
        </div>

        <button type="button" onClick={handleGoogle} disabled={loading} className="w-full flex items-center justify-center gap-2 border border-vow-border py-3 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-40 mb-5">
          <GoogleIcon className="w-4 h-4" /> Continue with Google
        </button>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="vow-label block mb-2" htmlFor="vow-email">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" />
              <input id="vow-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="vow-input pl-10" placeholder="you@example.com" autoComplete="email" disabled={loading} />
            </div>
          </div>
          <div>
            <label className="vow-label block mb-2" htmlFor="vow-password">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" />
              <input id="vow-password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="vow-input pl-10" placeholder="At least 6 characters" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} disabled={loading} />
            </div>
          </div>
          {error && <div className="vow-error" role="alert"><span>{error}</span><button type="button" className="vow-error-dismiss" onClick={() => setError(null)} aria-label="Dismiss error">×</button></div>}
          {message && <p className="text-xs text-vow-muted" role="status">{message}</p>}
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-vow-ink text-vow-bg text-sm font-medium py-3 hover:opacity-85 transition-opacity disabled:opacity-40">
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-xs text-vow-muted mt-8 text-center leading-relaxed">Your goals and journal are private to your account. VOW only processes information needed to provide the service.</p>
      </div>
    </div>
  );
}
