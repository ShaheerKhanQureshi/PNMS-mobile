import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

/** Static checks of the PWA assets: manifest, icons, and the service worker's security policy. */
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const pngSize = (p) => {
  const b = fs.readFileSync(new URL(`../${p}`, import.meta.url));
  assert.equal(b.subarray(1, 4).toString('latin1'), 'PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test('manifest is installable: name, standalone display, scope/start_url, 192/512/maskable icons', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.name, 'Patient Non-Compliance Monitoring System');
  assert.equal(m.short_name, 'PNMS');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/');
  assert.equal(m.scope, '/');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  const sizes = m.icons.map((i) => `${i.sizes}:${i.purpose}`);
  assert.ok(sizes.includes('192x192:any') && sizes.includes('512x512:any') && sizes.includes('512x512:maskable'));
  for (const icon of m.icons) {
    const [w, h] = pngSize(`public${icon.src}`);
    assert.equal(`${w}x${h}`, icon.sizes);
  }
  assert.deepEqual(pngSize('public/apple-touch-icon.png'), [180, 180]);
});

test('index.html links the manifest and the Apple home-screen metadata, with viewport-fit=cover', () => {
  const html = read('index.html');
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon\.png"/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /viewport-fit=cover/);
});

/** Loads sw.js in a sandbox with fake Cache/fetch and returns the registered listeners. */
function loadServiceWorker() {
  const listeners = {};
  const stored = [];
  const self = {
    location: new URL('https://pnms.example/'),
    addEventListener: (type, fn) => (listeners[type] = fn),
    skipWaiting: () => (self.skipped = true),
  };
  const caches = {
    open: async () => ({ addAll: async () => {}, put: async (req) => stored.push(req.url) }),
    keys: async () => [],
    match: async () => undefined,
    delete: async () => true,
  };
  const context = { self, caches, URL, Response, fetch: async () => ({ ok: true, status: 200, type: 'basic', clone() { return this; } }) };
  vm.runInNewContext(read('public/sw.js'), context);
  return { listeners, stored, self };
}

function dispatchFetch(listeners, request) {
  let handled = false;
  let promise;
  listeners.fetch({ request, respondWith: (p) => { handled = true; promise = p; } });
  return { handled, promise };
}

test('service worker never intercepts API, health, non-GET or cross-origin requests', () => {
  const { listeners } = loadServiceWorker();
  const req = (url, method = 'GET', mode = 'cors') => ({ url, method, mode });
  for (const r of [
    req('https://pnms.example/api/reports'),
    req('https://pnms.example/api/auth/me'),
    req('https://pnms.example/api/exports/reports.pdf'),
    req('https://pnms.example/health/ready'),
    req('https://pnms.example/api/reports', 'POST'),
    req('https://other.example/assets/app.js'),
    req('https://pnms.example/some/data.json'),
  ]) {
    assert.equal(dispatchFetch(listeners, r).handled, false, r.url);
  }
});

test('service worker caches only same-origin hashed assets/icons, and navigations are network-only', async () => {
  const { listeners, stored } = loadServiceWorker();
  const asset = dispatchFetch(listeners, { url: 'https://pnms.example/assets/index-abc123.js', method: 'GET', mode: 'cors' });
  assert.equal(asset.handled, true);
  await asset.promise;
  assert.deepEqual(stored, ['https://pnms.example/assets/index-abc123.js']);
  const nav = dispatchFetch(listeners, { url: 'https://pnms.example/reports', method: 'GET', mode: 'navigate' });
  assert.equal(nav.handled, true);
  await nav.promise;
  assert.equal(stored.length, 1, 'HTML documents are never written to the cache');
});

test('service worker updates wait for the user (no automatic skipWaiting) and the source never caches /api', () => {
  const source = read('public/sw.js');
  assert.ok(!/self\.skipWaiting\(\);\s*\n\s*event\.waitUntil/.test(source));
  const { listeners, self } = loadServiceWorker();
  listeners.message({ data: { type: 'SOMETHING_ELSE' } });
  assert.equal(self.skipped, undefined);
  listeners.message({ data: { type: 'SKIP_WAITING' } });
  assert.equal(self.skipped, true);
  assert.ok(!/cache\.put\([^)]*api/i.test(source));
});
