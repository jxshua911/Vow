import { App } from '@capacitor/app';
import { supabase } from './supabase';

export const NATIVE_OAUTH_REDIRECT = 'com.vow.app://callback';

export async function initNativeAuthListener() {
  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_OAUTH_REDIRECT)) {
      return;
    }

    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');

      if (!code) {
        console.error('[VOW OAuth] Callback received without authorization code.');
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('[VOW OAuth] Failed to exchange code for session:', error);
        return;
      }

      console.log('[VOW OAuth] Session established successfully.');
    } catch (error) {
      console.error('[VOW OAuth] Callback handling failed:', error);
    }
  });
}
