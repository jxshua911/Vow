import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { initNativeAuthListener } from './lib/nativeAuth';
import App from './App.tsx';
import './index.css';

initNativeAuthListener();

if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Light }); // dark icons, for VOW's light background
  // Unsupported on Android 15+ (edge-to-edge status bars) — safe to ignore there.
  StatusBar.setBackgroundColor({ color: '#F7F7F5' }).catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
