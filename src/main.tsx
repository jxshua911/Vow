import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { initNativeAuthListener } from './lib/nativeAuth';

if (Capacitor.isNativePlatform()) {
  initNativeAuthListener();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
