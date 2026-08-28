import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ArrowRight } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';

type Country = { name: string; code: string };

const countries: Country[] = [
  ['Afghanistan','+93'],['Albania','+355'],['Algeria','+213'],['Andorra','+376'],['Angola','+244'],['Antigua and Barbuda','+1'],['Argentina','+54'],['Armenia','+374'],['Australia','+61'],['Austria','+43'],['Azerbaijan','+994'],['Bahamas','+1'],['Bahrain','+973'],['Bangladesh','+880'],['Barbados','+1'],['Belarus','+375'],['Belgium','+32'],['Belize','+501'],['Benin','+229'],['Bhutan','+975'],['Bolivia','+591'],['Bosnia and Herzegovina','+387'],['Botswana','+267'],['Brazil','+55'],['Brunei','+673'],['Bulgaria','+359'],['Burkina Faso','+226'],['Burundi','+257'],['Cambodia','+855'],['Cameroon','+237'],['Canada','+1'],['Cape Verde','+238'],['Central African Republic','+236'],['Chad','+235'],['Chile','+56'],['China','+86'],['Colombia','+57'],['Comoros','+269'],['Congo','+242'],['Costa Rica','+506'],['Croatia','+385'],['Cuba','+53'],['Cyprus','+357'],['Czechia','+420'],['Denmark','+45'],['Djibouti','+253'],['Dominica','+1'],['Dominican Republic','+1'],['Ecuador','+593'],['Egypt','+20'],['El Salvador','+503'],['Equatorial Guinea','+240'],['Eritrea','+291'],['Estonia','+372'],['Eswatini','+268'],['Ethiopia','+251'],['Fiji','+679'],['Finland','+358'],['France','+33'],['Gabon','+241'],['Gambia','+220'],['Georgia','+995'],['Germany','+49'],['Ghana','+233'],['Greece','+30'],['Grenada','+1'],['Guatemala','+502'],['Guinea','+224'],['Guinea-Bissau','+245'],['Guyana','+592'],['Haiti','+509'],['Honduras','+504'],['Hungary','+36'],['Iceland','+354'],['India','+91'],['Indonesia','+62'],['Iran','+98'],['Iraq','+964'],['Ireland','+353'],['Israel','+972'],['Italy','+39'],['Jamaica','+1'],['Japan','+81'],['Jordan','+962'],['Kazakhstan','+7'],['Kenya','+254'],['Kiribati','+686'],['Kuwait','+965'],['Kyrgyzstan','+996'],['Laos','+856'],['Latvia','+371'],['Lebanon','+961'],['Lesotho','+266'],['Liberia','+231'],['Libya','+218'],['Liechtenstein','+423'],['Lithuania','+370'],['Luxembourg','+352'],['Madagascar','+261'],['Malawi','+265'],['Malaysia','+60'],['Maldives','+960'],['Mali','+223'],['Malta','+356'],['Marshall Islands','+692'],['Mauritania','+222'],['Mauritius','+230'],['Mexico','+52'],['Micronesia','+691'],['Moldova','+373'],['Monaco','+377'],['Mongolia','+976'],['Montenegro','+382'],['Morocco','+212'],['Mozambique','+258'],['Myanmar','+95'],['Namibia','+264'],['Nauru','+674'],['Nepal','+977'],['Netherlands','+31'],['New Zealand','+64'],['Nicaragua','+505'],['Niger','+227'],['Nigeria','+234'],['North Korea','+850'],['North Macedonia','+389'],['Norway','+47'],['Oman','+968'],['Pakistan','+92'],['Palau','+680'],['Palestine','+970'],['Panama','+507'],['Papua New Guinea','+675'],['Paraguay','+595'],['Peru','+51'],['Philippines','+63'],['Poland','+48'],['Portugal','+351'],['Qatar','+974'],['Romania','+40'],['Russia','+7'],['Rwanda','+250'],['Saint Kitts and Nevis','+1'],['Saint Lucia','+1'],['Saint Vincent and the Grenadines','+1'],['Samoa','+685'],['San Marino','+378'],['Sao Tome and Principe','+239'],['Saudi Arabia','+966'],['Senegal','+221'],['Serbia','+381'],['Seychelles','+248'],['Sierra Leone','+232'],['Singapore','+65'],['Slovakia','+421'],['Slovenia','+386'],['Solomon Islands','+677'],['Somalia','+252'],['South Africa','+27'],['South Korea','+82'],['South Sudan','+211'],['Spain','+34'],['Sri Lanka','+94'],['Sudan','+249'],['Suriname','+597'],['Sweden','+46'],['Switzerland','+41'],['Syria','+963'],['Taiwan','+886'],['Tajikistan','+992'],['Tanzania','+255'],['Thailand','+66'],['Timor-Leste','+670'],['Togo','+228'],['Tonga','+676'],['Trinidad and Tobago','+1'],['Tunisia','+216'],['Turkey','+90'],['Turkmenistan','+993'],['Tuvalu','+688'],['Uganda','+256'],['Ukraine','+380'],['United Arab Emirates','+971'],['United Kingdom','+44'],['United States','+1'],['Uruguay','+598'],['Uzbekistan','+998'],['Vanuatu','+678'],['Vatican City','+39'],['Venezuela','+58'],['Vietnam','+84'],['Yemen','+967'],['Zambia','+260'],['Zimbabwe','+263'],['Kosovo','+383'],['Jersey','+44'],['Guernsey','+44'],['Isle of Man','+44'],['Hong Kong','+852'],['Macao','+853'],['Puerto Rico','+1'],['Greenland','+299'],['Faroe Islands','+298']
].map(([name, code]) => ({ name, code }));

function normaliseLocalPhone(value: string) {
  return value.replace(/[^0-9]/g, '');
}

export function AuthPage() {
  const [countryCode, setCountryCode] = useState('+255');
  const [phone, setPhone] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null);
    const localDigits = normaliseLocalPhone(phone);
    const normalizedPhone = `${countryCode}${localDigits}`;
    if (localDigits.length < 4 || localDigits.length > 14) { setError('Enter a valid phone number for the selected country.'); return; }
    setLoading(true);
    try {
      if (!phoneCodeSent) {
        const { error: otpError } = await supabase.auth.signInWithOtp({ phone: normalizedPhone, options: { shouldCreateUser: true } });
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
        <div className="space-y-3">
          <button onClick={() => handleOAuth('google')} disabled={loading} className="w-full flex items-center justify-center gap-3 border border-vow-border py-3.5 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-40"><GoogleIcon className="w-4 h-4" />Sign in with Google</button>
          <button onClick={() => handleOAuth('apple')} disabled={loading} className="w-full flex items-center justify-center gap-3 border border-vow-border py-3.5 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors disabled:opacity-40"><span className="text-base leading-none" aria-hidden="true">●</span>Sign in with Apple</button>
          <button type="button" onClick={() => { setPhoneCodeSent(false); setError(null); }} className="w-full border border-vow-border py-3.5 text-sm font-medium text-vow-ink hover:border-vow-ink transition-colors">Sign in using the phone number</button>
        </div>
        <form onSubmit={handlePhoneSubmit} className="mt-6 border-t border-vow-border pt-6 space-y-5">
          <div><label className="vow-label block mb-2">Phone number</label><div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2"><select value={countryCode} onChange={(e) => { setCountryCode(e.target.value); setPhoneCodeSent(false); setError(null); }} className="vow-input" aria-label="Country calling code">{countries.sort((a,b) => a.name.localeCompare(b.name)).map((country) => <option key={`${country.name}-${country.code}`} value={country.code}>{country.name} {country.code}</option>)}</select><input type="text" inputMode="text" autoComplete="tel-national" required value={phone} onChange={(e) => setPhone(e.target.value)} className="vow-input" placeholder="712 345 678" disabled={phoneCodeSent} /></div><p className="text-[10px] text-vow-muted mt-2">Choose your country code, then enter your number. Spaces are allowed.</p></div>
          {phoneCodeSent && <div><label className="vow-label block mb-2">Verification code</label><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, ''))} className="vow-input tracking-[0.3em]" placeholder="123456" /><p className="text-[10px] text-vow-muted mt-2">A verification code was sent to your phone.</p></div>}
          {error && <p className="text-sm text-vow-ink leading-relaxed border-l-2 border-vow-ink pl-3">{error}</p>}
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 bg-vow-ink text-vow-bg text-sm font-medium py-3 hover:opacity-85 transition-opacity disabled:opacity-40">{loading ? 'Please wait...' : phoneCodeSent ? 'Verify & continue' : 'Send verification code'}<ArrowRight className="w-4 h-4" /></button>
          {phoneCodeSent && <button type="button" onClick={() => { setPhoneCodeSent(false); setPhoneCode(''); setError(null); }} className="w-full text-xs text-vow-muted hover:text-vow-ink">Use a different number</button>}
        </form>
        <p className="text-xs text-vow-muted mt-8 text-center leading-relaxed">Your journal and goals are private to you. No data is shared with third parties.</p>
      </div>
    </div>
  );
}
