import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const root = document.getElementById('root');

function showBootError(error: unknown) {
  if (!root) return;
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown startup error');
  root.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#F7F7F5;color:#111;font-family:Inter,system-ui,sans-serif;text-align:center">
      <div style="max-width:520px">
        <div style="font-size:14px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:16px">VOW</div>
        <h1 style="font-size:24px;margin:0 0 10px">VOW could not start</h1>
        <p style="font-size:14px;line-height:1.6;color:#6B6B6B;margin:0 0 16px">The app hit an error while loading. Please restart VOW. If this keeps happening, send this code to support.</p>
        <code style="display:block;padding:12px;background:#E8E8E4;border-radius:8px;font-size:12px;line-height:1.5;word-break:break-word;text-align:left">${message.replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char] || char)}</code>
      </div>
    </main>`;
}

async function bootstrap() {
  try {
    const [{ default: App }, { Capacitor }] = await Promise.all([
      import('./App.tsx'),
      import('@capacitor/core'),
    ]);
    const { initNativeAuthListener } = await import('./lib/nativeAuth');
    const { installGlobalErrorTelemetry, track } = await import('./lib/telemetry');

    if (Capacitor.isNativePlatform()) {
      void initNativeAuthListener();
    }

    installGlobalErrorTelemetry();
    void track('app_opened', { source: 'startup' });

    if (!root) throw new Error('VOW startup error: root element was not found.');

    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error('[VOW] Startup failed:', error);
    showBootError(error);
  }
}

void bootstrap();
