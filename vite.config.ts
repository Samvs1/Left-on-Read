/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Strict Content-Security-Policy, injected into the built HTML only (the dev
 * server needs a websocket for hot reload). `connect-src 'none'` blocks every
 * fetch/XHR/WebSocket/EventSource/beacon, so the page cannot send data
 * anywhere. The analysis worker is created from a blob: URL and therefore
 * inherits this policy too.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'left-on-read:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), cspPlugin()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    cssTarget: 'safari15',
    sourcemap: false,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
