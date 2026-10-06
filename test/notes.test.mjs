import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotesService } from '../src/notes-api.mjs';

const id = '00000000-0000-4000-8000-000000000010';
const row = { note_id: id, title: 'test', content: 'fixture' };

function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('authenticated notes CRUD uses verified identity and hides server credentials', async () => {
  const service = createNotesService(() => async () => ({ userId: '00000000-0000-4000-8000-000000000001' }));
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  const calls = [];
  const call = async (method, body, itemId) => {
    const res = response();
    const request = { method, body, headers: { authorization: 'Bearer test-token' } };
    if (itemId) await service.item(request, res, itemId); else await service.collection(request, res);
    return res;
  };
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-only-placeholder';
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      assert.equal(init.headers.apikey, process.env.SUPABASE_SECRET_KEY);
      if (init.method === 'POST') return { ok: true, json: async () => [row] };
      if (init.method === 'PATCH') return { ok: true, json: async () => [row] };
      if (init.method === 'DELETE') return { ok: true, json: async () => [row] };
      return { ok: true, json: async () => [row] };
    };
    assert.deepEqual((await call('GET')).body, [{ id, title: 'test', body: 'fixture' }]);
    assert.match(calls[0].url, /owner_id=eq.00000000-0000-4000-8000-000000000001/);
    assert.equal((await call('POST', { title: 'new', body: 'note' })).code, 201);
    const post = JSON.parse(calls[1].init.body);
    assert.equal(post.owner_id, '00000000-0000-4000-8000-000000000001');
    assert.match(post.note_id, /^[0-9a-f-]{36}$/i);
    assert.equal((await call('PUT', { title: 'new', body: 'note' }, id)).code, 200);
    assert.equal(calls[2].init.method, 'PATCH');
    assert.equal((await call('DELETE', undefined, id)).code, 204);
    assert.equal(calls[3].init.method, 'DELETE');
    assert.equal((await call('GET', undefined, 'not-an-id')).code, 404);
    assert.equal((await call('POST', { title: '', body: 'note' })).code, 400);
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of [['SUPABASE_URL', oldUrl], ['SUPABASE_SECRET_KEY', oldKey]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('unauthenticated requests are rejected before database access', async () => {
  const service = createNotesService(() => async () => null);
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('database should not be called'); };
  try {
    const res = response();
    await service.collection({ method: 'POST', headers: {}, body: { title: 'x', body: 'y' } }, res);
    assert.equal(res.code, 401);
    assert.deepEqual(res.body, { error: 'LOGIN_REQUIRED' });
  } finally { globalThis.fetch = oldFetch; }
});
