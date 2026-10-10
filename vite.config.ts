/**
 * Vite build config for the admin single-page app.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Never inline files as data: URLs. The gateway serves the admin with a
    // strict
    // Content-Security-Policy (fonts and images only from its own address).
    assetsInlineLimit: 0,
  },
});
