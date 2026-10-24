import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = name => fs.readFileSync(path.join(root, name));

test('PWA manifest has install settings and three valid PNG icons', () => {
  const manifest = JSON.parse(read('manifest.webmanifest').toString('utf8'));
  assert.equal(manifest.name, 'MY KEIBA LAB');
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.icons.map(x => [x.sizes, x.purpose]), [
    ['192x192', 'any'], ['512x512', 'any'], ['512x512', 'maskable']
  ]);
  for (const icon of manifest.icons) {
    const bytes = read(icon.src.replace(/^\.\//, ''));
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    const [width, height] = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    const expected = Number(icon.sizes.split('x')[0]);
    assert.equal(width, expected);
    assert.equal(height, expected);
    // Verify IDAT can actually be decompressed and contains all rows.
    const idats = [];
    for (let pos = 8; pos < bytes.length;) {
      const size = bytes.readUInt32BE(pos);
      const type = bytes.toString('ascii', pos + 4, pos + 8);
      if (type === 'IDAT') idats.push(bytes.subarray(pos + 8, pos + 8 + size));
      pos += size + 12;
      assert.ok(pos <= bytes.length, 'PNG chunk extends beyond file');
    }
    assert.ok(idats.length);
    const uncompressed = inflateSync(Buffer.concat(idats));
    assert.equal(uncompressed.length, height * (Math.ceil(width / 8) + 1));
  }
});

test('PWA root wiring exists and DB Lab data storage is untouched', () => {
  const html = read('index.html').toString('utf8');
  const app = read('app.js').toString('utf8');
  const sw = read('sw.js').toString('utf8');
  assert.match(html, /rel="manifest"\s+href="manifest.webmanifest"/);
  assert.match(html, /rel="icon"/);
  assert.match(app, /my-keiba-lab-v2/);
  assert.match(app, /navigator\.serviceWorker\.register\('\.\/sw\.js'\)/);
  assert.match(sw, /my-keiba-lab-v60-pwa/);
  assert.match(sw, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(sw, /url\.pathname\.startsWith\(DB_LAB_PATH\)/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.ok(fs.existsSync(path.join(root, 'db-lab/index.html')));
});
