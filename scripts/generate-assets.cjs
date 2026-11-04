/**
 * Generates the PNG app icons and the Open Graph image from HTML/SVG with
 * Playwright (run once; outputs are committed in public/).
 *   node scripts/generate-assets.cjs
 */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const font = (p) => `data:font/woff2;base64,${fs.readFileSync(path.join(root, 'node_modules', p)).toString('base64')}`;
const display = font('@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2');
const body = font('@fontsource-variable/inter/files/inter-latin-wght-normal.woff2');

const mark = (size, pad = 0, rounded = true) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6a4bff"/><stop offset=".55" stop-color="#c24bd8"/><stop offset="1" stop-color="#ff6b57"/></linearGradient></defs>
  <rect width="64" height="64" rx="${rounded ? 18 : 0}" fill="url(#g)"/>
  <g transform="translate(${32 - 32 * (1 - pad)} ${32 - 32 * (1 - pad)}) scale(${1 - pad})">
    <path d="M17 19h30a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H31l-9 7v-7h-5a6 6 0 0 1-6-6V25a6 6 0 0 1 6-6z" fill="#fff"/>
    <circle cx="23.5" cy="31" r="3.2" fill="#6a4bff"/><circle cx="32" cy="31" r="3.2" fill="#c24bd8" opacity=".8"/><circle cx="40.5" cy="31" r="3.2" fill="#ff6b57" opacity=".6"/>
  </g>
</svg>`;

const ogHtml = `<!doctype html><html><head><style>
@font-face{font-family:D;src:url(${display}) format('woff2');font-weight:200 800}
@font-face{font-family:B;src:url(${body}) format('woff2');font-weight:100 900}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#0d0c12;font-family:B;color:#fff;overflow:hidden;position:relative}
.blob{position:absolute;border-radius:50%;filter:blur(70px)}
h1{font-family:D;font-weight:800;font-size:112px;line-height:.9;letter-spacing:-.035em}
.g{background:linear-gradient(100deg,#a493ff,#e07be8 45%,#ff8a72 80%,#ffc95c);-webkit-background-clip:text;color:transparent}
.chip{display:inline-flex;gap:10px;align-items:center;padding:10px 18px;border-radius:99px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);font-weight:600;font-size:22px}
.card{position:absolute;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:28px;backdrop-filter:blur(10px)}
.bars{display:flex;gap:10px;align-items:flex-end;height:150px}
.bars span{flex:1;border-radius:6px 6px 0 0}
</style></head><body>
<div class="blob" style="width:520px;height:520px;left:-120px;top:-200px;background:rgba(124,92,255,.55)"></div>
<div class="blob" style="width:460px;height:460px;right:-80px;bottom:-200px;background:rgba(255,107,87,.4)"></div>
<div style="position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:16px">${mark(56)}<span style="font-family:D;font-weight:750;font-size:34px;letter-spacing:-.03em">Left on Read</span></div>
<div style="position:absolute;left:72px;top:190px;width:620px">
  <h1>Your chats,<br><span class="g">unwrapped.</span></h1>
  <p style="margin-top:28px;font-size:27px;line-height:1.35;color:rgba(255,255,255,.8)">Story mode, 200+ stats, eras, awards and share cards for your WhatsApp chat exports.</p>
  <div style="margin-top:30px" class="chip">🔒 100% in your browser · nothing is uploaded</div>
</div>
<div class="card" style="right:70px;top:120px;width:380px;padding:28px">
  <div style="font-size:20px;color:rgba(255,255,255,.7);font-weight:600">You &amp; Noor</div>
  <div style="font-family:D;font-weight:780;font-size:72px;letter-spacing:-.03em;margin-top:6px">18,402</div>
  <div style="font-size:18px;color:rgba(255,255,255,.6);margin-bottom:22px">messages</div>
  <div class="bars">${[38, 60, 44, 72, 96, 80, 62, 88, 100, 70].map((h, i) => `<span style="height:${h}%;background:${i % 3 === 2 ? '#eb6834' : '#8f7cea'}"></span>`).join('')}</div>
</div>
<div class="card" style="right:300px;bottom:56px;padding:18px 22px;display:flex;gap:14px;align-items:center;background:linear-gradient(135deg,#2a2a72,#7c5cff)">
  <span style="font-size:44px">🦉</span><div><div style="font-family:D;font-weight:780;font-size:26px">The Night Owl</div><div style="font-size:16px;opacity:.8">23% after midnight</div></div>
</div>
</body></html>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const out = (f) => path.join(root, 'public', f);
  const shot = async (html, w, h, file) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${html}</body></html>`);
    await page.screenshot({ path: out(file), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  };
  await shot(mark(192), 192, 192, 'icons/icon-192.png');
  await shot(mark(512), 512, 512, 'icons/icon-512.png');
  await shot(mark(512, 0.22, false), 512, 512, 'icons/icon-maskable-512.png');
  await shot(mark(180, 0, false), 180, 180, 'icons/apple-touch-icon.png');
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.setContent(ogHtml);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('og-image.png') });
  await browser.close();
  console.log('assets written to public/');
})();
