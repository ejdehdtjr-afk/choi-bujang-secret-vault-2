import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createDeviceApprovalService } from '../src/device-approval.mjs';

function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('device status and request fail closed without the engine approval contract', async () => {
  const service = createDeviceApprovalService(() => async () => ({ userId: 'fixture-user' }));
  for (const [method, handler] of [['GET', service.status], ['POST', service.request]]) {
    const anonymous = response();
    await handler({ method, headers: {} }, anonymous);
    assert.equal(anonymous.code, 401);
    assert.deepEqual(anonymous.body, { error: 'LOGIN_REQUIRED' });
    const loggedIn = response();
    await handler({ method, headers: { authorization: 'Bearer fixture-token' }, body: { approved: true } }, loggedIn);
    assert.equal(loggedIn.code, method === 'GET' ? 200 : 503);
    assert.notEqual(loggedIn.body.approved, true);
    assert.equal(loggedIn.headers['cache-control'], 'no-store');
  }
});

test('install shell keeps auth sessions in memory and never caches API responses', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.match(html, /persistSession: false/u);
  assert.match(html, /deviceApproved = response\.ok && result\?\.approved === true/u);
  assert.match(html, /if \(!deviceApproved\) throw new Error/u);
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  assert.doesNotMatch(worker, /cache\.addAll\(\[[^\]]*api\//u);
});
