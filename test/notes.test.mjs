import test from 'node:test';
import assert from 'node:assert/strict';
import { createNotesHandler } from '../api/notes.js';
const handler = createNotesHandler(() => async () => ({ userId: 'test-user' }));

test('notes API protects credentials and projects only allowed fields', async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  const call = async (method = 'GET') => {
    const response = { headers: {}, setHeader(k,v) { this.headers[k]=v; },
      status(code) { this.code=code; return this; }, json(body) { this.body=body; return this; } };
    await handler({ method, headers: { authorization: 'Bearer test-placeholder' } }, response);
    return response;
  };
  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
    assert.equal((await call()).code, 503);
    assert.equal((await call('POST')).code, 405);
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-only-placeholder';
    globalThis.fetch = async (url, options) => {
      assert.equal(url.pathname, '/rest/v1/vault_notes');
      assert.equal(options.headers.apikey, process.env.SUPABASE_SECRET_KEY);
      assert.equal(options.redirect, 'error');
      return { ok: true, json: async () => [{ id: 1, title: 'test', content: 'fixture', owner_id: 'hidden', key: 'hidden' }] };
    };
    const success = await call();
    assert.equal(success.code, 200);
    assert.equal(success.headers['Cache-Control'], 'no-store');
    assert.deepEqual(success.body, { notes: [{ id:1, title:'test', content:'fixture' }] });
    globalThis.fetch = async () => { throw new Error(process.env.SUPABASE_SECRET_KEY); };
    assert.deepEqual((await call()).body, { error: 'NOTES_UNAVAILABLE' });
    globalThis.fetch = async () => ({ ok:false });
    assert.equal((await call()).code, 502);
    globalThis.fetch = async () => ({ ok:true, json:async () => ({ error:'internal' }) });
    assert.equal((await call()).code, 502);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [key, value] of [['SUPABASE_URL',oldUrl],['SUPABASE_SECRET_KEY',oldKey]]) {
      if (value === undefined) delete process.env[key]; else process.env[key]=value;
    }
  }
});
