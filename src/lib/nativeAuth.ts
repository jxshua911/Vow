import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabase';

export const NATIVE_OAUTH_REDIRECT = 'com.vow.app://callback';
export const NATIVE_CALENDAR_REDIRECT = 'com.vow.app://calendar-callback';

export async function initNativeAuthListener() {
  const listener = await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_OAUTH_REDIRECT) && !url.startsWith(NATIVE_CALENDAR_REDIRECT)) return;

    try {
      const urlObj = new URL(url);

      if (url.startsWith(NATIVE_CALENDAR_REDIRECT)) {
        await Browser.close().catch(() => undefined);
        const success = urlObj.searchParams.get('success') === 'true';
        const error = urlObj.searchParams.get('error');
        if (success) {
          window.dispatchEvent(new CustomEvent('vow:google-calendar-connected'));
        } else {
          window.dispatchEvent(new CustomEvent('vow:google-calendar-error', {
            detail: error || 'Google Calendar connection failed.',
          }));
        }
        return;
      }

      await Browser.close().catch(() => undefined);

      // Supabase may return OAuth errors on the callback instead of a code.
      const callbackError = urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error');
      if (callbackError) {
        console.error('[VOW OAuth] Provider returned an error:', callbackError);
        window.dispatchEvent(new CustomEvent('vow:oauth-error', { detail: callbackError }));
        return;
      }

      const code = urlObj.searchParams.get('code');
      if (!code) {
        console.error('[VOW OAuth] Callback received without authorization code.');
        window.dispatchEvent(new CustomEvent('vow:oauth-error', {
          detail: 'Google sign-in returned an incomplete callback. Please try again.',
        }));
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error('[VOW OAuth] Failed to exchange code for session:', error);
        window.dispatchEvent(new CustomEvent('vow:oauth-error', { detail: error.message }));
        return;
      }

      console.log('[VOW OAuth] Session established successfully.');
    } catch (error) {
      console.error('[VOW OAuth] Callback handling failed:', error);
      window.dispatchEvent(new CustomEvent('vow:oauth-error', {
        detail: error instanceof Error ? error.message : 'Google sign-in failed. Please try again.',
      }));
    }
  });

  return listener;
}
