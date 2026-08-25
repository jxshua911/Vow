import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

/**
 * The custom URL scheme Google (via Supabase) redirects back to once
 * sign-in finishes in the in-app browser. Must exactly match:
 *   1. `appId` in capacitor.config.ts (the scheme Capacitor registers), and
 *   2. a Redirect URL added in Supabase Dashboard → Authentication → URL
 *      Configuration, e.g. "com.vow.app://callback"
 */
export const NATIVE_OAUTH_REDIRECT = 'com.vow.app://callback';

/**
 * Registers the deep-link listener that catches the app re-opening after
 * OAuth and turns the returned tokens into a real Supabase session.
 * Call this once, as early as possible (see main.tsx), and only on native
 * platforms — on web, Supabase already handles this via detectSessionInUrl.
 */
export function initNativeAuthListener() {
  if (!Capacitor.isNativePlatform()) return;

  App.addListener('appUrlOpen', async ({ url }: URLOpenListenerEvent) => {
    if (!url.startsWith(NATIVE_OAUTH_REDIRECT)) return;

    try {
      // Implicit flow: tokens arrive in the URL fragment.
      const hashIndex = url.indexOf('#');
      const hashParams = new URLSearchParams(hashIndex >= 0 ? url.slice(hashIndex + 1) : '');
      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');

      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      } else {
        // PKCE flow: a `?code=` query param instead of a token fragment.
        const code = new URL(url).searchParams.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      }
    } catch (err) {
      console.error('Native OAuth completion failed:', err);
    } finally {
      await Browser.close();
    }
  });
}
