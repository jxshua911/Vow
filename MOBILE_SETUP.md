# VOW — Mobile app setup

This project now wraps your existing React/Supabase web app with
[Capacitor](https://capacitorjs.com), so it can run as a real iOS and
Android app while talking to the same Supabase backend. Everything below
is new; nothing about your web app's logic, styling, or database changed.

## What was added

- `capacitor.config.ts` — app name, bundle ID, splash/status bar colors
  (matched to your `#F7F7F5` / `#111111` palette)
- `ios/` and `android/` — the native Xcode and Android Studio projects
- `assets/` — the source icon/splash images (generated from your existing
  `favicon.svg` V-mark), plus every native size Xcode/Android Studio need,
  already generated into `ios/` and `android/`
- `src/lib/nativeAuth.ts` — new file. Handles Google sign-in on native
  (see "Google sign-in" below — this needs one step from you)
- Small edits to `src/components/AuthPage.tsx` and `src/main.tsx` to wire
  the above in. Email/password sign-in is untouched and works as-is.
- `index.html` — added `viewport-fit=cover` so content flows correctly
  around notches/home indicators

Your app already had its own splash screen (the `SplashOverlay` in
`App.tsx`, showing the full VOW wordmark). That's untouched — the native
splash now just shows your V mark on `#F7F7F5` for an instant, then hands
off to your existing one. That handoff is intentional, not a glitch.

## 1. Get it building locally

```bash
npm install
cp .env.example .env    # then fill in your real Supabase URL + anon key
npm run build
npx cap sync
```

`npx cap sync` copies your latest build into both native projects — run
it again any time you change web code and want to see it natively.

## 2. iOS (needs a Mac + Xcode)

```bash
npx cap open ios
```

This opens the project in Xcode. From there: pick a simulator or your
plugged-in iPhone, hit Run. To submit to the App Store, you'll need an
Apple Developer account ($99/yr) and to set your own Team under
Signing & Capabilities.

## 3. Android (needs Android Studio)

```bash
npx cap open android
```

Same idea: pick an emulator or plugged-in device, hit Run. A Google Play
Console account is $25 one-time, paid when you're ready to publish.

## 4. Google sign-in — one thing you must do first

Your Google sign-in button now detects native apps and opens Google's
consent screen in an in-app browser, then routes back into VOW via a
custom link: `com.vow.app://callback`. For that hand-back to work, add
it as an allowed redirect in **Supabase Dashboard → Authentication → URL
Configuration → Redirect URLs**. Without this step, native Google
sign-in will fail even though it works fine on the web.

Email/password sign-in needs no such step and will work immediately.

## 5. Before you submit: your app ID

Everything above uses `com.vow.app` as a placeholder bundle identifier —
change it to something you actually own before submitting (e.g.
`com.yourname.vow`). It appears in four places and **all four must
match exactly**:

1. `capacitor.config.ts` → `appId`
2. `ios/App/App/Info.plist` → `CFBundleURLSchemes`
3. `android/app/src/main/AndroidManifest.xml` → the `<data android:scheme=…>` line
4. The Supabase redirect URL from step 4 above (update it to match)

## 6. Worth knowing before App Store review

Apple's guidelines generally require offering **Sign in with Apple** as
an option on iOS if you offer Google (or any other third-party) sign-in.
Your app doesn't have this yet — worth adding before you submit to
Apple, even though it's not needed for Android or for testing.

## Everything else

Your Supabase client, database calls, and auth session handling are
completely unchanged — they work the same on native as they did on the
web, since Capacitor just wraps your existing app in a native shell.
