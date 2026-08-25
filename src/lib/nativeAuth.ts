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

      if (url.startsWith(NATIVE_CALENDAR_REDIRECT)) {
        const success = urlObj.searchParams.get('success') === 'true';
        const error = urlObj.searchParams.get('error');

        if (success) {
          console.log('[VOW Calendar] Google Calendar connected successfully.');
          window.dispatchEvent(new CustomEvent('vow:google-calendar-connected'));
        } else {
          console.error('[VOW Calendar] Google Calendar connection failed:', error || 'Unknown error');
          window.dispatchEvent(new CustomEvent('vow:google-calendar-error', { detail: error || 'Google Calendar connection failed.' }));
        }
        return;
      }

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
