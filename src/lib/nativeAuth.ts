import { App } from '@capacitor/app';
import { supabase } from './supabase';

export const NATIVE_OAUTH_REDIRECT = 'com.vow.app://callback';

export async function initNativeAuthListener() {
  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_OAUTH_REDIRECT)) {
      return;
    }

    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');

    if (!code) {
      return;
    }

    await supabase.auth.exchangeCodeForSession(code);
  });
}
