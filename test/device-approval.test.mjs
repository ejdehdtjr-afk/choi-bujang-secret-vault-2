import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createDeviceApprovalService } from '../src/device-approval.mjs';
import { createNotesService } from '../src/notes-api.mjs';
import { createRestoreHandler } from '../src/restore-note.mjs';
import deviceHandler from '../api/device/[action].js';

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

test('one device function preserves both public paths and rejects unknown actions', async () => {
  for (const [url, method, expected] of [
    ['/api/device/status', 'GET', 401],
    ['/api/device/request', 'POST', 401],
    ['/api/device/other', 'GET', 404],
  ]) {
    const result = response();
    await deviceHandler({ url, method, headers: {} }, result);
    assert.equal(result.code, expected, url);
  }
});

test('protected note and restore APIs reject a logged-in but unapproved device before database access', async () => {
  const verifier = () => async () => ({ userId: '00000000-0000-4000-8000-000000000001' });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('database must not be called'); };
  try {
    const notes = createNotesService(verifier);
    for (const [method, handler] of [
      ['GET', (req, res) => notes.collection(req, res)],
      ['POST', (req, res) => notes.collection(req, res)],
      ['GET', (req, res) => notes.item(req, res, '00000000-0000-4000-8000-000000000010')],
      ['PUT', (req, res) => notes.item(req, res, '00000000-0000-4000-8000-000000000010')],
      ['DELETE', (req, res) => notes.item(req, res, '00000000-0000-4000-8000-000000000010')],
    ]) {
      const denied = response();
      await handler({ method, headers: { authorization: 'Bearer fixture' } }, denied);
      assert.equal(denied.code, 403);
      assert.deepEqual(denied.body, { error: 'DEVICE_NOT_APPROVED' });
    }
    const restore = response();
    await createRestoreHandler(verifier, async () => { throw new Error('database must not be called'); })({
      method: 'POST', headers: { authorization: 'Bearer fixture' },
      query: { noteId: '00000000-0000-4000-8000-000000000010' },
    }, restore);
    assert.equal(restore.code, 403);
    assert.deepEqual(restore.body, { error: 'DEVICE_NOT_APPROVED' });
  } finally { globalThis.fetch = oldFetch; }
});

test('status reports approved only from the injected trusted server verifier', async () => {
  const service = createDeviceApprovalService(() => async () => ({ userId: 'fixture-user' }),
    async () => true);
  const approved = response();
  await service.status({ method: 'GET', headers: { authorization: 'Bearer fixture' },
    query: { approved: false }, body: { approved: false } }, approved);
  assert.equal(approved.code, 200);
  assert.deepEqual(approved.body, { approved: true });
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
