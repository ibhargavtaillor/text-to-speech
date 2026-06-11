import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest/manifest.config';

// CRXJS wires the MV3 manifest into Vite's multi-entry build (popup HTML,
// service worker, content script) and gives HMR in the popup during `dev`.
export default defineConfig({
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  plugins: [react(), crx({ manifest })],
  build: {
    target: 'es2022',
    rollupOptions: {
      // Offscreen document is created at runtime (not referenced by the
      // manifest), so it must be declared as an explicit input to be emitted.
      input: {
        offscreen: resolve(__dirname, 'src/offscreen/index.html'),
      },
    },
  },
  // CRXJS uses a websocket for HMR; pin the port so the worker can reach it.
  server: { port: 5173, strictPort: true, hmr: { port: 5173 } },
});
