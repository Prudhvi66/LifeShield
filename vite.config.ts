import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // base: './' is REQUIRED for Capacitor Android WebView.
  // Without this, Vite outputs absolute /assets/ paths which fail with
  // crossorigin errors on Android's http://localhost scheme.
  base: './',
  server: {
    port: 3000,
    open: false,
  }
});
