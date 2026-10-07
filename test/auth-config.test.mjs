import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import authConfig from '../api/auth-config.js';

function response() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
}

test('auth configuration uses server environment and is not embedded in the browser source', () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'test-publishable-placeholder';
    const ok = response();
    authConfig({ method: 'GET' }, ok);
    assert.equal(ok.code, 200);
    assert.deepEqual(ok.body, { url: 'https://example.supabase.co', publishableKey: 'test-publishable-placeholder' });
    assert.equal(ok.headers['Cache-Control'], 'no-store');
    const missing = response();
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    authConfig({ method: 'GET' }, missing);
    assert.equal(missing.code, 503);
    const page = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
    assert.doesNotMatch(page, /sb_publishable_/u);
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY; else process.env.SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
});
