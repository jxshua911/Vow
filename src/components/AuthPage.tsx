import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';

type AuthMethod = 'email' | 'phone';

function normalisePhone(value: string) {
  return value.trim().replace(/[\s().-]/g, '');
}

function isInternationalPhone(value: string) {
  return /^\+[1-9]\d{7,14}$/.test(normalisePhone(value));
}

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [method, setMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(newMode: 'signin' | 'signup') {
    setMode(newMode); setError(null); setPhoneCodeSent(false); setPhoneCode(''); setEmail(''); setPassword('');
  }
  function switchMethod(newMethod: AuthMethod) { setMethod(newMethod); setError(null); setPhoneCodeSent(false); setPhoneCode(''); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setLoading(true);
    try {
      if (mode === 'signup') { const { error: signUpError } = await supabase.auth.signUp({ email, password }); if (signUpError) throw signUpError; }
      else { const { error: signInError } = await supabase.auth.signInWithPassword({ email, password }); if (signInError) throw signInError; }
    } catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const normalizedPhone = normalisePhone(phone);
    if (!isInternationalPhone(normalizedPhone)) { setError('Enter a valid international phone number with its country code, for example +255712345678.'); return; }
    setLoading(true);
    try {
      if (!phoneCodeSent) {
        const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalizedPhone, options: { shouldCreateUser: mode === 'signup' } });
        if (otpError) throw otpError; setPhoneCodeSent(true);
      } else {
        const { error: verifyError } = await supabase.auth.verifyOtp({ phone: normalizedPhone, token: phoneCode.trim(), type: 'sms' });
        if (verifyError) throw verifyError;
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Phone sign-in failed. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null); setLoading(true);
    try {
      const redirectTo = Capacitor.isNativePlatform() ? 'com.vow.app://callback' : window.location.origin;
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: Capacitor.isNativePlatform() } });
      if (oauthError) throw oauthError;
      if (Capacitor.isNativePlatform() && data?.url) await Browser.open({ url: data.url });
    } catch (err) { setError(err instanceof Error ? err.message : `${provider === 'apple' ? 'Apple' : 'Google'} sign-in failed. Please try again.`); setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-vow-bg flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-12"><h1 className="vow-heading text-5xl text-vow-ink mb-3">VOW</h1><p className="text-vow-muted text-sm tracking-wide">Commit. Schedule. Execute. Review. Adjust.</p></div>
        <div className="flex border border-vow-border mb-8"><button onClick={() => switchMode('signup')} className={`flex-1 py-3 text-sm transition-colors ${mode === 'signup' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted hover:text-vow-ink'}`}>Create account</button><button onClick={() => switchMode('signin')} className={`flex-1 py-3 text-sm transition-colors border-l border-vow-border ${mode === 'signin' ? 'bg-vow-ink text-vow-bg font-medium' : 'text-vow-muted hover:text-vow-ink'}`}>Sign in</button></div>
        <div className="grid grid-cols-2 gap-2 mb-3"><button onClick={() => handleOAuth('google')} disabled={loading} className="w-full flex items-center justify-center gap-2 border border-vow-border py-3 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-40"><GoogleIcon className="w-4 h-4" />Google</button><button onClick={() => handleOAuth('apple')} disabled={loading} className="w-full flex items-center justify-center gap-2 border border-vow-border py-3 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-40">Apple</button></div>
        <div className="grid grid-cols-2 gap-2 mb-6"><button onClick={() => switchMethod('phone')} className={`flex items-center justify-center gap-2 border py-3 text-sm transition-colors ${method === 'phone' ? 'border-vow-ink text-vow-ink font-medium' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}>☎ Phone</button><button onClick={() => switchMethod('email')} className={`flex items-center justify-center gap-2 border py-3 text-sm transition-colors ${method === 'email' ? 'border-vow-ink text-vow-ink font-medium' : 'border-vow-border text-vow-muted hover:text-vow-ink'}`}><Mail className="w-4 h-4" />Email</button></div>
        {method === 'phone' ? (<form onSubmit={handlePhoneSubmit} className="space-y-5"><div><label className="vow-label block mb-2">Phone number</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-vow-muted">☎</span><input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="vow-input pl-10" placeholder="+255 712 345 678" autoComplete="tel" disabled={phoneCodeSent} /></div><p className="text-[10px] text-vow-muted mt-2">International numbers are supported. Include your country code.</p></div>{phoneCodeSent && <div><label className="vow-label block mb-2">Verification code</label><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))} className="vow-input tracking-[0.3em]" placeholder="123456" /><p className="text-[10px] text-vow-muted mt-2">A verification code was sent to your phone.</p></div>}{error && <p className="text-sm text-vow-ink leading-relaxed border-l-2 border-vow-ink pl-3">{error}</p>}<button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-vow-ink text-vow-bg text-sm font-medium py-3 hover:opacity-85 transition-opacity disabled:opacity-40">{loading ? 'Please wait...' : phoneCodeSent ? 'Verify & continue' : 'Send verification code'}<ArrowRight className="w-4 h-4" /></button>{phoneCodeSent && <button type="button" onClick={() => { setPhoneCodeSent(false); setPhoneCode(''); setError(null); }} className="w-full text-xs text-vow-muted hover:text-vow-ink">Use a different number</button>}</form>) : (<form onSubmit={handleSubmit} className="space-y-5"><div><label className="vow-label block mb-2">Email</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="vow-input pl-10" placeholder="you@example.com" /></div></div><div><label className="vow-label block mb-2">Password</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vow-muted" /><input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="vow-input pl-10" placeholder="At least 6 characters" /></div></div>{error && <p className="text-sm text-vow-ink leading-relaxed border-l-2 border-vow-ink pl-3">{error}</p>}<button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-vow-ink text-vow-bg text-sm font-medium py-3 hover:opacity-85 transition-opacity disabled:opacity-40">{loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}<ArrowRight className="w-4 h-4" /></button></form>)}
        <p className="text-xs text-vow-muted mt-8 text-center leading-relaxed">{mode === 'signup' ? 'Your journal and goals are private to you. No data is shared with third parties.' : 'Welcome back. Pick up where you left off.'}</p>
      </div>
    </div>
  );
}
