import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './supabase';

export const NATIVE_OAUTH_REDIRECT = 'com.vow.app://callback';
export const NATIVE_CALENDAR_REDIRECT = 'com.vow.app://calendar-callback';
export const NATIVE_STRAVA_REDIRECT = 'com.vow.app://strava-callback';
export const WEB_CALENDAR_REDIRECT = 'https://vow.bolt.host/calendar/oauth/callback';
export const WEB_STRAVA_REDIRECT = 'https://vow.bolt.host/strava/oauth/callback';

export async function initNativeAuthListener() {
  const listener = await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url.startsWith(NATIVE_OAUTH_REDIRECT) && !url.startsWith(NATIVE_CALENDAR_REDIRECT) && !url.startsWith(NATIVE_STRAVA_REDIRECT)) return;
    try {
      const urlObj = new URL(url);
      if (url.startsWith(NATIVE_CALENDAR_REDIRECT)) {
        await Browser.close().catch(() => undefined);
        const success = urlObj.searchParams.get('success') === 'true';
        window.dispatchEvent(new CustomEvent(success ? 'vow:google-calendar-connected' : 'vow:google-calendar-error', { detail: urlObj.searchParams.get('error') || 'Google Calendar connection failed.' }));
        return;
      }
      if (url.startsWith(NATIVE_STRAVA_REDIRECT)) {
        await Browser.close().catch(() => undefined);
        const success = urlObj.searchParams.get('success') === 'true';
        window.dispatchEvent(new CustomEvent(success ? 'vow:strava-connected' : 'vow:strava-error', { detail: urlObj.searchParams.get('error') || 'Strava connection failed.' }));
        return;
      }
      await Browser.close().catch(() => undefined);
      const callbackError = urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error');
      if (callbackError) {
        console.error('[VOW OAuth] Provider returned an error:', callbackError);
        window.dispatchEvent(new CustomEvent('vow:oauth-error', { detail: callbackError }));
        return;
      }
      const code = urlObj.searchParams.get('code');
      if (!code) {
        window.dispatchEvent(new CustomEvent('vow:oauth-error', { detail: 'OAuth returned an incomplete callback. Please try again.' }));
        return;
      }
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) window.dispatchEvent(new CustomEvent('vow:oauth-error', { detail: error.message }));
    } catch (error) {
      console.error('[VOW OAuth] Callback handling failed:', error);
      window.dispatchEvent(new CustomEvent('vow:oauth-error', { detail: error instanceof Error ? error.message : 'OAuth connection failed.' }));
    }
  });
  return listener;
}
