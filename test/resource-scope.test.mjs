import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../src/decider.mjs';
import { fixtureRequests } from '../scripts/fixture-7.mjs';
import { createNotesService } from '../src/notes-api.mjs';

const id = '00000000-0000-4000-8000-000000000010';
const userId = '00000000-0000-4000-8000-000000000001';
const response = () => ({ headers: {}, setHeader(k, v) { this.headers[k] = v; },
  status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });

test('resource routes are exact and device and step-up rules remain active', async () => {
  const { normal, suspicious } = fixtureRequests();
  assert.equal((await decide(normal)).decision, 'allow');
  assert.equal((await decide(suspicious)).decision, 'step_up');
  assert.equal((await decide({ ...normal, deviceRegistered: false })).reasonCode, 'device_not_registered');
  for (const patch of [
    { path: '/notes/export' }, { path: `${normal.path}/extra` },
    { path: `${normal.path}?action=export` }, { method: 'PATCH' },
    { route: 'GET /announcements/:id' }, { subjectId: '' },
    { service: 'announcements', method: 'PUT', path: `/announcements/${id}`, route: 'PUT /announcements/:id', role: 'instructor' },
  ]) assert.equal((await decide({ ...normal, ...patch })).decision, 'deny');
});

test('API rejects zone query selectors and body role spoofing; only stored instructor can write notices', async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SECRET_KEY;
  const service = createNotesService(() => async () => ({ kind: 'student', userId }), 'announcements');
  const notes = createNotesService(() => async () => ({ kind: 'student', userId }));
  let instructor = false;
  let writes = 0;
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-only-placeholder';
    globalThis.fetch = async (url, init) => {
      const parsed = new URL(url);
      if (parsed.pathname.endsWith('/vault_instructors')) {
        assert.equal(parsed.searchParams.get('user_id'), `eq.${userId}`);
        return { ok: true, json: async () => instructor ? [{ user_id: userId }] : [] };
      }
      assert.equal(parsed.pathname, '/rest/v1/vault_announcements');
      if (init.method === 'PATCH') writes++;
      return { ok: true, json: async () => [{ note_id: id, title: 'test', content: 'fixture' }] };
    };
    const req = { method: 'PUT', headers: { authorization: 'Bearer test' }, body: { title: 'test', body: 'fixture', role: 'instructor' } };
    const denied = response();
    await service.item(req, denied, id);
    assert.equal(denied.code, 403);
    assert.equal(writes, 0);
    const queryDenied = response();
    await notes.collection({ ...req, method: 'GET', query: { owner_id: userId, zone: 'announcements' } }, queryDenied);
    assert.equal(queryDenied.code, 400);
    instructor = true;
    const allowed = response();
    await service.item(req, allowed, id);
    assert.equal(allowed.code, 200);
    assert.equal(writes, 1);
    globalThis.fetch = async () => { throw new Error('registry unavailable'); };
    const unavailable = response();
    await service.item(req, unavailable, id);
    assert.equal(unavailable.code, 403);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of [['SUPABASE_URL', originalUrl], ['SUPABASE_SECRET_KEY', originalKey]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
