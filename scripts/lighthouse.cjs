/**
 * Runs Lighthouse (mobile + desktop) against the production build.
 * Usage: npm run build && npm run lighthouse
 * Needs Chrome/Chromium: set CHROME_PATH if it is not auto-detected.
 */
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const PORT = 4322;
const pages = ['/', '/privacy/', '/how-it-works/'];

(async () => {
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2000));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lh-'));
  try {
    for (const preset of ['mobile', 'desktop']) {
      for (const p of pages) {
        const file = path.join(out, `${preset}${p.replace(/\//g, '_')}.json`);
        const args = ['--yes', 'lighthouse@12', `http://localhost:${PORT}${p}`, '--quiet', '--chrome-flags=--headless=new --no-sandbox', '--only-categories=performance,accessibility,best-practices,seo', '--output=json', `--output-path=${file}`];
        if (preset === 'desktop') args.push('--preset=desktop');
        spawnSync('npx', args, { stdio: 'ignore', env: process.env });
        if (!fs.existsSync(file)) {
          console.log(`${preset} ${p}: lighthouse failed (is Chrome installed? set CHROME_PATH)`);
          continue;
        }
        const r = JSON.parse(fs.readFileSync(file, 'utf8'));
        const scores = Object.entries(r.categories).map(([k, v]) => `${k}=${Math.round(v.score * 100)}`).join('  ');
        console.log(`${preset.padEnd(7)} ${p.padEnd(15)} ${scores}`);
        if (r.audits['robots-txt']?.score === 0) console.log('        note: robots.txt check is blocked by the CSP (connect-src \'none\'), see README');
      }
    }
  } finally {
    server.kill();
  }
})();
