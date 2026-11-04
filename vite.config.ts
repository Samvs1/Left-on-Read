/// <reference types="vitest/config" />
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

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

/**
 * Inlines the tiny pre-paint boot script (theme + language) and allows exactly
 * that script via its SHA-256 hash, keeping `script-src` free of
 * 'unsafe-inline'. Inlining saves a render-blocking request.
 */
function cspPlugin(): Plugin {
  return {
    name: 'left-on-read:csp',
    apply: 'build',
    transformIndexHtml(html) {
      const boot = fs.readFileSync(path.resolve(import.meta.dirname, 'src/boot.js'), 'utf8').trim();
      const hash = createHash('sha256').update(boot).digest('base64');
      const csp = CSP.replace("script-src 'self'", `script-src 'self' 'sha256-${hash}'`);
      return html
        .replace(/<script src="[^"]*boot\.js"><\/script>/, `<script>${boot}</script>`)
        .replace('<!--csp-->', `<meta http-equiv="Content-Security-Policy" content="${csp}" />`);
    },
  };
}

const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const site = (process.env.SITE_URL || '').replace(/\/$/, '');
const isSsrBuild = process.argv.includes('--ssr');

const PAGES = [
  {
    path: '',
    file: 'index.html',
    title: 'Left on Read · Your chats, unwrapped',
    description:
      'Private chat analytics for WhatsApp chat exports. Story mode, 200+ stats, eras, awards and share cards. Runs 100% in your browser: nothing is ever uploaded.',
  },
  {
    path: 'privacy/',
    file: 'privacy/index.html',
    title: 'Privacy · Left on Read',
    description: 'Your chat never leaves your device. No servers, no tracking, no cookies, enforced by a strict Content-Security-Policy.',
  },
  {
    path: 'how-it-works/',
    file: 'how-it-works/index.html',
    title: 'How it works · Left on Read',
    description: 'Every statistic explained in plain language: conversations, response times, ghosting, double texts, eras, signature words and more.',
  },
];

/**
 * Prerenders the static pages (landing, privacy, how-it-works) into the
 * client bundle using the SSR build in dist-ssr/. Runs inside generateBundle
 * so the service worker's precache list includes the final HTML files.
 */
function prerenderPlugin(): Plugin {
  return {
    name: 'left-on-read:prerender',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_opts, bundle) {
      if (isSsrBuild) return;
      const ssrDir = path.resolve(import.meta.dirname, 'dist-ssr');
      const entry = fs.existsSync(ssrDir) ? fs.readdirSync(ssrDir).find((f) => /^entry-server\.m?js$/.test(f)) : undefined;
      const html = bundle['index.html'];
      if (!entry || !html || html.type !== 'asset') {
        this.warn('Skipping prerender: run `vite build --ssr src/ui/entry-server.tsx --outDir dist-ssr` first.');
        return;
      }
      const { render } = (await import(pathToFileURL(path.join(ssrDir, entry)).href)) as { render: (url: string) => string };
      const template = String(html.source);
      const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      for (const p of PAGES) {
        let out = template.replace('<!--app-html-->', render(`${base}${p.path}`));
        out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`);
        out = out.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(p.description)}" />`);
        out = out.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(p.title)}" />`);
        if (site) {
          const canonical = `${site}${base}${p.path}`;
          out = out.replace('</title>', `</title>\n    <link rel="canonical" href="${canonical}" />\n    <meta property="og:url" content="${canonical}" />`);
          out = out.replace(/content="([^"]*og-image\.png)"/g, (_m, u: string) => `content="${u.startsWith('http') ? u : site + u}"`);
        }
        if (p.file === 'index.html') html.source = out;
        else this.emitFile({ type: 'asset', fileName: p.file, source: out });
      }
      if (site) {
        const urls = PAGES.map((p) => `  <url><loc>${site}${base}${p.path}</loc></url>`).join('\n');
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n` });
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n${site ? `\nSitemap: ${site}${base}sitemap.xml\n` : ''}` });
    },
  };
}

const pwa = VitePWA({
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.ts',
  injectRegister: false,
  registerType: 'autoUpdate',
  manifestFilename: 'manifest.webmanifest',
  includeAssets: ['favicon.svg', 'icons/*.png', 'og-image.png'],
  manifest: {
    id: base,
    name: 'Left on Read',
    short_name: 'Left on Read',
    description: 'Private chat analytics for WhatsApp chat exports. Runs 100% in your browser.',
    lang: 'en',
    start_url: base,
    scope: base,
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0d0c12',
    theme_color: '#5b3df5',
    categories: ['social', 'lifestyle', 'utilities'],
    icons: [
      { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
      { src: `${base}icons/icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: `${base}favicon.svg`, sizes: 'any', type: 'image/svg+xml' },
    ],
    share_target: {
      action: `${base}share-target`,
      method: 'POST',
      enctype: 'multipart/form-data',
      params: {
        title: 'title',
        text: 'text',
        files: [{ name: 'chat', accept: ['text/plain', 'application/zip', 'application/x-zip-compressed', '.txt', '.zip'] }],
      },
    },
  },
  injectManifest: {
    globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
    maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  },
  devOptions: { enabled: false },
});

export default defineConfig({
  base,
  plugins: [react(), tailwindcss(), cspPlugin(), prerenderPlugin(), ...(isSsrBuild ? [] : [pwa])],
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
