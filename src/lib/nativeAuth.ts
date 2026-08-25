import { App } from '@capacitor/app';
import { supabase } from './supabase';

export const NATIVE_OAUTH_REDIRECT = 'com.vow.app://callback';
export const NATIVE_CALENDAR_REDIRECT = 'com.vow.app://calendar-callback';

export async function initNativeAuthListener() {
  await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_OAUTH_REDIRECT) && !url.startsWith(NATIVE_CALENDAR_REDIRECT)) {
      return;
    }

    try {
      const urlObj = new URL(url);
      const code = urlObj.searchParams.get('code');

      if (!code) {
        console.error('[VOW OAuth] Callback received without authorization code.');
        return;
      }

      if (url.startsWith(NATIVE_CALENDAR_REDIRECT)) {
        const { error } = await supabase.functions.invoke('google-calendar-auth', {
          body: { code },
        });

        if (error) {
          console.error('[VOW Calendar] Failed to connect Google Calendar:', error);
          return;
        }

        console.log('[VOW Calendar] Google Calendar connected successfully.');
        window.dispatchEvent(new CustomEvent('vow:google-calendar-connected'));
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
