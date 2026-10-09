import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Capacitor serves the built web app from a local file:// / capacitor:// origin.
  // Relative asset URLs are required; an absolute "/" base can point the WebView
  // at the device root instead of the bundled dist/ assets.
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
