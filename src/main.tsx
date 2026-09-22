import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { initNativeAuthListener } from './lib/nativeAuth';
import { installGlobalErrorTelemetry, track } from './lib/telemetry';

if (Capacitor.isNativePlatform()) {
  initNativeAuthListener();
}

installGlobalErrorTelemetry();
void track('app_opened', { source: 'startup' });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
