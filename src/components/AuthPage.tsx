import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(newMode: 'signin' | 'signup') {
    setMode(newMode);
    setError(null);
    setEmail('');
    setPassword('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (googleError) throw googleError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-vow-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Wordmark */}
        <div className="text-center mb-12">
          <h1 className="vow-heading text-5xl text-vow-ink mb-3">VOW</h1>
          <p className="text-vow-muted text-sm tracking-wide">
            Commit. Schedule. Execute. Review. Adjust.
          </p>
        </div>

        {/* Mode toggle — clean, no border overlap */}
        <div className="flex border border-vow-border mb-8">
          <button
            onClick={() => switchMode('signup')}
            className={`flex-1 py-3 text-sm transition-colors ${
              mode === 'signup'
                ? 'bg-vow-ink text-vow-bg font-medium'
                : 'text-vow-muted hover:text-vow-ink'
            }`}
          >
            Create account
          </button>
          <button
            onClick={() => switchMode('signin')}
            className={`flex-1 py-3 text-sm transition-colors border-l border-vow-border ${
              mode === 'signin'
                ? 'bg-vow-ink text-vow-bg font-medium'
                : 'text-vow-muted hover:text-vow-ink'
            }`}
          >
            Sign in
          </button>
        </div>

        {/* Google sign-in */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2.5 border border-vow-border py-3 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors mb-6 disabled:opacity-40"
        >
          <GoogleIcon className="w-4 h-4" />
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px bg-vow-border" />
          <span className="text-xs text-vow-muted uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-vow-border" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="vow-label block mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="vow-input pl-10"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="vow-label block mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="vow-input pl-10"
                placeholder="At least 6 characters"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-vow-ink leading-relaxed" style={{ borderLeft: '2px solid #111', paddingLeft: '0.75rem' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-vow-ink text-vow-bg text-sm font-medium py-3 hover:opacity-85 transition-opacity disabled:opacity-40"
          >
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-xs text-vow-muted mt-8 text-center leading-relaxed">
          {mode === 'signup'
            ? 'Your journal and goals are private to you. No data is shared with third parties.'
            : 'Welcome back. Pick up where you left off.'}
        </p>
      </div>
    </div>
  );
}
