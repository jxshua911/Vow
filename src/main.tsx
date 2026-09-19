import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { Capacitor } from '@capacitor/core';
import { initNativeAuthListener } from './lib/nativeAuth';

function showBootError(error: unknown) {
  const root = document.getElementById('root');
  if (!root) return;
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px;box-sizing:border-box;background:#F7F7F5;color:#111;font-family:system-ui,sans-serif;text-align:center">
      <div style="max-width:420px">
        <div style="font-size:28px;font-weight:700;letter-spacing:-.04em;margin-bottom:12px">VOW</div>
        <div style="font-size:15px;line-height:1.5;margin-bottom:20px">VOW could not start correctly. Please close and reopen the app.</div>
        <div style="font-size:11px;line-height:1.4;opacity:.55;word-break:break-word">${message.replace(/[&<>"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[char] || char))}</div>
      </div>
    </main>
  `;
  console.error('[VOW] Fatal startup error:', error);
}

window.addEventListener('error', (event) => {
  console.error('[VOW] Unhandled window error:', event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[VOW] Unhandled promise rejection:', event.reason);
});

try {
  if (Capacitor.isNativePlatform()) {
    void initNativeAuthListener().catch((error) => {
      console.error('[VOW] Native auth listener failed to initialise:', error);
    });
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('VOW root element is missing.');

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
} catch (error) {
  showBootError(error);
}
