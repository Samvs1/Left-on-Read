/**
 * Prerenders the static pages into the built HTML so the landing page paints
 * instantly (and is crawlable) before JavaScript runs.
 *   /               → dist/index.html
 *   /privacy/       → dist/privacy/index.html
 *   /how-it-works/  → dist/how-it-works/index.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');
const base = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const site = (process.env.SITE_URL || '').replace(/\/$/, '');

const entry = fs.readdirSync(ssrDir).find((f) => /^entry-server\.(m?js)$/.test(f));
if (!entry) throw new Error('SSR entry not found in dist-ssr');
const { render } = await import(pathToFileURL(path.join(ssrDir, entry)).href);
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const pages = [
  {
    url: `${base}`,
    out: 'index.html',
    title: 'Left on Read · Your chats, unwrapped',
    description:
      'Private chat analytics for WhatsApp chat exports. Story mode, 200+ stats, eras, awards and share cards. Runs 100% in your browser: nothing is ever uploaded.',
  },
  {
    url: `${base}privacy/`,
    out: 'privacy/index.html',
    title: 'Privacy · Left on Read',
    description: 'Your chat never leaves your device. No servers, no tracking, no cookies, enforced by a strict Content-Security-Policy.',
  },
  {
    url: `${base}how-it-works/`,
    out: 'how-it-works/index.html',
    title: 'How it works · Left on Read',
    description: 'Every statistic explained in plain language: conversations, response times, ghosting, double texts, eras, signature words and more.',
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

for (const p of pages) {
  const app = render(p.url);
  let html = template.replace('<!--app-html-->', app);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(p.title)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${esc(p.description)}" />`);
  html = html.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${esc(p.title)}" />`);
  if (site) {
    const canonical = `${site}${p.url}`;
    html = html.replace('</title>', `</title>\n    <link rel="canonical" href="${canonical}" />\n    <meta property="og:url" content="${canonical}" />`);
    html = html.replace(/content="(\/[^"]*og-image\.png)"/g, (_, u) => `content="${site}${u}"`);
  }
  const out = path.join(dist, p.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  console.log(`prerendered ${p.url} → dist/${p.out} (${(html.length / 1024).toFixed(1)} kB)`);
}

fs.rmSync(ssrDir, { recursive: true, force: true });
