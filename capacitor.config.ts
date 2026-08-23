import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Change this to your own reverse-DNS identifier before you submit to
  // the App Store / Play Store. It must be unique and, once published,
  // should never change.
  appId: 'com.vow.app',
  appName: 'VOW',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      // Matches the in-app <SplashOverlay> in App.tsx so the native splash
      // and the JS splash hand off without a flash of a different color.
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#F7F7F5',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      // Dark text/icons, for VOW's light (#F7F7F5) background.
      style: 'LIGHT',
      backgroundColor: '#F7F7F5',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
