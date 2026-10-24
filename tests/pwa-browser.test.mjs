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

test('Site opens, installs service worker, restores a race backup, and exports backup', {timeout:90000}, async () => {
  await page.goto(url,{waitUntil:'domcontentloaded'});
  assert.match(await page.title(), /MY KEIBA LAB/);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, {timeout:20000});
  const registration = await page.evaluate(async () => {
    const sw = await navigator.serviceWorker.ready;
    return {scope:sw.scope, active:sw.active?.state};
  });
  assert.equal(registration.scope,url);
  assert.equal(registration.active,'activated');
  // The legacy add-race form is hidden by integrated-v4. Test the supported
  // JSON restore flow, then verify the visible integrated-v4 Save action.
  page.on('dialog', dialog => dialog.accept());
  const sample = { races:[{
    id:'pwa-smoke-1', track:'東京', raceNo:'11', raceName:'PWA動作確認',
    weather:'晴', going:'良', paceMemo:'', horses:[]
  }] };
  await page.locator('#importInput').setInputFiles({
    name:'pwa-smoke.json', mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(sample),'utf8')
  });
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('my-keiba-lab-v2');
    return raw && JSON.parse(raw).races.some(r => r.raceName==='PWA動作確認');
  });
  await page.reload({waitUntil:'domcontentloaded'});
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('my-keiba-lab-v2')));
  assert.ok(state.races.some(r => r.raceName === 'PWA動作確認'));

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#v4SaveBtn').click();
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

test('Android-size touch viewport shows integrated app navigation', {timeout:45000}, async () => {
  const mobile = await browser.newContext({
    viewport:{width:393,height:852}, deviceScaleFactor:2,
    isMobile:true, hasTouch:true, serviceWorkers:'allow'
  });
  try {
    const tab = await mobile.newPage();
    await tab.goto(url,{waitUntil:'domcontentloaded'});
    await tab.locator('#v4App').waitFor({state:'visible'});
    assert.equal(await tab.locator('#v4PdfBtn').isVisible(),true);
    assert.equal(await tab.locator('#v4SaveBtn').isVisible(),true);
    assert.equal(await tab.locator('.v4-bottom').isVisible(),true);
    await tab.locator('.v4-nav[data-tab="races"]').click();
    assert.equal(await tab.locator('.v4-view[data-view="races"]').isVisible(),true);
    assert.equal(await tab.locator('.v4-view[data-view="home"]').isVisible(),false);
    const manifest = await tab.evaluate(async () =>
      await (await fetch('./manifest.webmanifest')).json());
    assert.equal(manifest.display,'standalone');
  } finally {
    await mobile.close();
  }
});


test('Compact phone header keeps three actions visible without overlap or text wrapping', {timeout:60000}, async () => {
  const mobile = await browser.newContext({
    viewport:{width:393,height:852}, deviceScaleFactor:2,
    isMobile:true, hasTouch:true, serviceWorkers:'allow'
  });
  try {
    const tab = await mobile.newPage();
    await tab.goto(url,{waitUntil:'domcontentloaded'});
    await tab.locator('#v5HeaderImport').waitFor({state:'visible'});
    for (const width of [320, 360, 393, 560]) {
      await tab.setViewportSize({width,height:852});
      const layout = await tab.evaluate(() => {
        const header = document.querySelector('.v4-header');
        const brand = header.querySelector('.v4-brand');
        const buttons = [...header.querySelectorAll('.v4-actions .v4-icon-btn')];
        const shape = element => {
          const r = element.getBoundingClientRect();
          return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
        };
        return {
          header:shape(header),brand:shape(brand),buttons:buttons.map(shape),
          captions:buttons.map(x=>x.textContent.trim()),
          overflow:buttons.map(x=>x.scrollWidth-x.clientWidth),
          whitespace:buttons.map(x=>getComputedStyle(x).whiteSpace)
        };
      });
      assert.deepEqual(layout.captions,['ラップ君','新聞PDF','保存']);
      assert.equal(layout.buttons.length,3);
      for (let i=0;i<layout.buttons.length;i++) {
        const button=layout.buttons[i];
        assert.ok(button.top>=layout.brand.bottom-1, 'actions below brand at '+width);
        assert.ok(button.height>=42, 'touch target at '+width);
        assert.ok(button.width>55, 'action not squashed at '+width);
        assert.ok(button.left>=layout.header.left-1 && button.right<=layout.header.right+1,
          'action inside header at '+width);
        assert.ok(layout.overflow[i]<=1,'label must not overflow at '+width);
        assert.equal(layout.whitespace[i],'nowrap');
        if(i) assert.ok(layout.buttons[i-1].right<button.left,'distinct action targets at '+width);
      }
    }
  } finally {
    await mobile.close();
  }
});
