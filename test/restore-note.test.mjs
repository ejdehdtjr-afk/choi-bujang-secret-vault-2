import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRestoreHandler } from '../src/restore-note.mjs';

const noteId = '00000000-0000-4000-8000-000000000010';
const ownerId = '00000000-0000-4000-8000-000000000002';
const contentSha256 = 'a'.repeat(64);

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

function request(overrides = {}) {
  return { method: 'POST', headers: { authorization: 'Bearer fixture' },
    query: { noteId }, ...overrides };
}

test('restore is denied before database access without a verified login', async () => {
  const handler = createRestoreHandler(() => async () => null,
    async () => { throw new Error('database must not be called'); });
  const missing = response();
  await handler(request({ headers: {} }), missing);
  assert.equal(missing.code, 401);
  const invalid = response();
  await handler(request(), invalid);
  assert.equal(invalid.code, 401);
});

test('one verified owner restores one note without accepting owner or content input', async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  const calls = [];
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-only-placeholder';
    const handler = createRestoreHandler(() => async () => ({ userId: ownerId }),
      async (url, init) => {
        calls.push({ url: String(url), init });
        return { ok: true, json: async () => [{ restored_note_id: noteId,
          restored_owner_id: ownerId, restored_content_sha256: contentSha256 }] };
      });
    const result = response();
    await handler(request(), result);
    assert.equal(result.code, 200);
    assert.deepEqual(result.body, { id: noteId, ownerId, contentSha256 });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/rest\/v1\/rpc\/restore_vault_note$/u);
    assert.deepEqual(JSON.parse(calls[0].init.body), { p_note_id: noteId, p_owner_id: ownerId });
    const spoof = response();
    await handler(request({ body: { owner_id: 'different', content: 'changed' } }), spoof);
    assert.equal(spoof.code, 400);
    assert.equal(calls.length, 1);
  } finally {
    for (const [key, value] of [['SUPABASE_URL', oldUrl], ['SUPABASE_SECRET_KEY', oldKey]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('missing or mismatched backup result never reports successful restoration', async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-only-placeholder';
    const verify = () => async () => ({ userId: ownerId });
    const missing = response();
    await createRestoreHandler(verify, async () => ({ ok: true, json: async () => [] }))(request(), missing);
    assert.equal(missing.code, 404);
    const mismatch = response();
    await createRestoreHandler(verify, async () => ({ ok: true, json: async () => [{
      restored_note_id: noteId, restored_owner_id: '00000000-0000-4000-8000-000000000001',
      restored_content_sha256: contentSha256,
    }] }))(request(), mismatch);
    assert.equal(mismatch.code, 502);
  } finally {
    for (const [key, value] of [['SUPABASE_URL', oldUrl], ['SUPABASE_SECRET_KEY', oldKey]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
