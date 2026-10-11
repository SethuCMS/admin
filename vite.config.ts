/**
 * Vite build config for the admin single-page app.
 */

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Where the app is served from. "/" for its own address; "/sethu/" when it is
// copied into another site's `public/sethu` folder (`pnpm build:site`).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  return {
    base: env['VITE_BASE'] ?? '/',
    plugins: [react()],
    server: { port: 5173 },
    build: {
      // Never inline files as data: URLs. The gateway serves the admin with a
      // strict
      // Content-Security-Policy (fonts and images only from its own address).
      assetsInlineLimit: 0,
    },
  };
});
