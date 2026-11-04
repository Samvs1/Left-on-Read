/**
 * Verifies the privacy promise in a real browser (Playwright + Chromium):
 *  1. Load the app and wait for the service worker to take control.
 *  2. Go offline and record every request from that point on.
 *  3. Analyse a .txt and a .zip export, play the story, open every view,
 *     search, change settings, toggle anonymous mode, export a share card,
 *     play the Wrapped preview with sound and export the Wrapped video.
 *  4. Assert: zero requests reached the network, and the CSP blocks fetch()
 *     in the page and in blob workers.
 * Usage: npm run build && npm run verify:network
 */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');

const root = path.resolve(__dirname, '..');
const PORT = 4321;
const URL = `http://localhost:${PORT}/`;

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

(async () => {
  const server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
  let failed = false;
  const check = (ok, label) => {
    console.log(`${ok ? '✔' : '✘'} ${label}`);
    if (!ok) failed = true;
  };
  try {
    await waitForServer();
    const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'lor-'));
    const txt = path.join(root, 'scripts/fixtures/sample-chat.txt');
    const zipPath = path.join(tmp, 'WhatsApp Chat - Sam.zip');
    const zip = new JSZip();
    zip.file('_chat.txt', fs.readFileSync(txt));
    zip.file('00000012-PHOTO-2025-01-03-09-00-00.jpg', Buffer.alloc(2048, 7));
    fs.writeFileSync(zipPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    });
    check(true, 'service worker installed and controlling the page');

    // ---- From here on: offline, and every request is recorded ----
    const requests = [];
    const record = (req) => {
      const u = req.url();
      if (u.startsWith('data:') || u.startsWith('blob:')) return;
      requests.push(req);
    };
    context.on('request', record);
    await context.setOffline(true);

    // CSP must block fetch in the page and in blob workers
    const pageFetch = await page.evaluate(() => fetch('https://example.com/collect').then(() => 'sent', () => 'blocked'));
    check(pageFetch === 'blocked', `CSP blocks fetch() in the page (${pageFetch})`);
    const workerFetch = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const src = "fetch('https://example.com/x').then(()=>postMessage('sent'),()=>postMessage('blocked'))";
          const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
          w.onmessage = (e) => resolve(e.data);
          setTimeout(() => resolve('timeout'), 4000);
        }),
    );
    check(workerFetch === 'blocked', `CSP blocks fetch() inside blob workers (${workerFetch})`);

    // 1) .txt via the file picker
    await page.setInputFiles('input[type=file]', txt);
    await page.waitForSelector('[aria-roledescription="story"]', { timeout: 20000 });
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(400);
    }
    await page.keyboard.press('Escape');
    await page.waitForSelector('#section-overview', { timeout: 20000 });
    check(true, '.txt export analysed, story played, dashboard rendered');

    for (const id of ['people', 'dynamics', 'time', 'eras', 'words', 'emojis', 'media', 'mood', 'awards']) {
      await page.evaluate((s) => document.getElementById(`section-${s}`)?.scrollIntoView(), id);
      await page.waitForTimeout(250);
    }
    await page.fill('input[type=search]', 'pizza');
    await page.waitForTimeout(900);
    const searchOk = await page.locator('#search .num').first().textContent().catch(() => null);
    check(!!searchOk, `word search works offline (${searchOk} hits)`);

    // Settings change → recompute in the worker
    await page.click('button[aria-label="Settings"]');
    await page.waitForSelector('[role=dialog]');
    await page.locator('[role=dialog] input[type=range]').first().fill('3');
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');

    // Anonymous mode + profile + share card download
    await page.click('button[aria-label="Anonymous mode"]');
    await page.evaluate(() => { location.hash = '#/person/0'; });
    await page.waitForTimeout(1200);
    await page.evaluate(() => { location.hash = '#/dashboard'; });
    await page.waitForSelector('#section-overview');
    await page.locator('#section-overview button:has-text("Share")').click();
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.locator('[role=dialog] button:has-text("Square")').click()]);
    const pngPath = path.join(tmp, 'card.png');
    await download.saveAs(pngPath);
    const png = fs.readFileSync(pngPath);
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    check(w === 1080 && h === 1080, `share card exported offline as ${w}×${h} PNG`);
    await page.keyboard.press('Escape');

    // 2) .zip via compare mode
    await page.evaluate(() => { location.hash = '#/compare'; });
    await page.waitForTimeout(800);
    await page.setInputFiles('input[type=file]', zipPath);
    await page.waitForSelector('text=vs', { timeout: 20000 });
    await page.waitForTimeout(1500);
    check(true, '.zip export analysed in compare mode');

    // 3) Wrapped: live preview with sound (synthesised in a worker), the
    //    summary image and a full video export, all offline.
    await page.evaluate(() => { location.hash = '#/wrapped'; });
    await page.waitForSelector('canvas[role=img]', { timeout: 30000 });
    await page.click('button[aria-label="Turn sound on"]');
    await page.waitForSelector('button[aria-label="Turn sound off"]', { timeout: 20000 });
    await page.waitForTimeout(1500);
    const [still] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('text=Download summary image')]);
    const stillPath = path.join(tmp, 'wrapped.png');
    await still.saveAs(stillPath);
    const sp = fs.readFileSync(stillPath);
    check(sp.readUInt32BE(16) === 1080 && sp.readUInt32BE(20) === 1920, `Wrapped summary image exported offline as ${sp.readUInt32BE(16)}×${sp.readUInt32BE(20)} PNG`);
    const t0 = Date.now();
    await page.click('text=Create video');
    await page.waitForSelector('video', { timeout: 600000 });
    const vid = await page.evaluate(async () => {
      const v = document.querySelector('video');
      if (v.readyState < 1) await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
      return { d: v.duration, w: v.videoWidth, h: v.videoHeight };
    });
    const label = ((await page.locator('p.text-xs').first().textContent()) || '').trim();
    check(vid.w === 1080 && vid.h === 1920 && vid.d > 10, `Wrapped video created offline in ${((Date.now() - t0) / 1000).toFixed(0)} s: ${label}, ${vid.d.toFixed(1)} s long`);

    // 4) Android share target: the OS POSTs the export to /share-target; the
    //    service worker stores it locally and redirects into the app.
    await page.evaluate(() => { location.hash = ''; });
    await page.evaluate(() => {
      const f = document.createElement('form');
      f.method = 'post';
      f.enctype = 'multipart/form-data';
      f.action = '/share-target';
      const input = document.createElement('input');
      input.type = 'file';
      input.name = 'chat';
      input.id = 'share-input';
      f.appendChild(input);
      f.id = 'share-form';
      document.body.appendChild(f);
    });
    await page.setInputFiles('#share-input', txt);
    await Promise.all([page.waitForURL(/shared=1|#\/story/, { timeout: 20000 }), page.evaluate(() => document.getElementById('share-form').submit())]);
    await page.waitForSelector('[aria-roledescription="story"]', { timeout: 20000 });
    check(true, 'Android share target: shared export opened straight into the story');

    const viaNetwork = [];
    for (const r of requests) {
      const resp = await r.response().catch(() => null);
      if (!resp || !resp.fromServiceWorker()) viaNetwork.push(r.url());
    }
    console.log(`  requests after load: ${requests.length} total, ${requests.length - viaNetwork.length} answered locally by the service worker cache, ${viaNetwork.length} reached the network`);
    check(viaNetwork.length === 0, 'zero network requests after the page loaded');
    if (viaNetwork.length) console.log(viaNetwork.slice(0, 10).join('\n'));
    check(errors.length === 0, `no uncaught page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    await browser.close();
  } catch (e) {
    console.error(e);
    failed = true;
  } finally {
    server.kill();
  }
  process.exit(failed ? 1 : 0);
})();
