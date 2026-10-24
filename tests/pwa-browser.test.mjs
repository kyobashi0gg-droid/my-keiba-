import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { before, after, test } from 'node:test';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '..');
const contentType = file => ({
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json',
  '.webmanifest':'application/manifest+json',
  '.png':'image/png', '.svg':'image/svg+xml'
}[path.extname(file)] || 'application/octet-stream');
let server, browser, context, page, url;

before(async () => {
  server = http.createServer((req,res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end(); return; }
    const file = path.resolve(root, '.' + (pathname.endsWith('/') ? pathname+'index.html' : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end('Not found'); return;
    }
    res.setHeader('Content-Type', contentType(file));
    res.setHeader('Cache-Control','no-store');
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  url = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch({
    executablePath: process.env.CHROME_BIN || undefined,
    args:['--no-sandbox'],
    headless:true
  });
  context = await browser.newContext({ acceptDownloads:true, serviceWorkers:'allow' });
  page = await context.newPage();
});

after(async () => {
  await context?.close();
  await browser?.close();
  await new Promise(resolve => server?.close(resolve));
});

test('Site opens, installs service worker, saves a race, and exports backup', {timeout:90000}, async () => {
  await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.match(await page.title(), /MY KEIBA LAB/);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, {timeout:20000});
  const registration = await page.evaluate(async () => {
    const sw = await navigator.serviceWorker.ready;
    return {scope:sw.scope, active:sw.active?.state};
  });
  assert.equal(registration.scope,url);
  assert.equal(registration.active,'activated');
  await page.locator('#newRaceBtn').click();
  await page.locator('#track').fill('東京');
  await page.locator('#raceName').fill('PWA動作確認');
  await page.locator('#raceForm button[type="submit"]').click();
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('my-keiba-lab-v2');
    return raw && JSON.parse(raw).races.some(r => r.raceName==='PWA動作確認');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('my-keiba-lab-v2')));
  assert.ok(state.races.some(r => r.raceName === 'PWA動作確認'));

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportBtn').click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /my-keiba-backup-.*\.json$/);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const backup = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.ok(backup.races.some(r => r.raceName === 'PWA動作確認'));
});

test('DB Lab stays reachable and its scripts are not cached by the PWA', {timeout:45000}, async () => {
  await page.goto(url+'db-lab/',{waitUntil:'domcontentloaded'});
  assert.match(await page.title(), /MY KEIBA DB LAB/);
  // Browsing DB Lab must not cause its JS to enter the separate PWA cache.
  await page.waitForTimeout(2000);
  const cached = await page.evaluate(async () => {
    const request = new Request(new URL('./app.js',location.href));
    return !!(await caches.match(request));
  });
  assert.equal(cached,false);
});

test('Application shell opens offline after a successful online visit', {timeout:45000}, async () => {
  await context.setOffline(true);
  try {
    await page.goto(url,{waitUntil:'domcontentloaded'});
    assert.match(await page.title(), /MY KEIBA LAB/);
    const hasRace = await page.evaluate(() => {
      const value = localStorage.getItem('my-keiba-lab-v2');
      return !!value && JSON.parse(value).races.some(r => r.raceName === 'PWA動作確認');
    });
    assert.equal(hasRace,true);
  } finally {
    await context.setOffline(false);
  }
});
