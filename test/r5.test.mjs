import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';
import { runAttackChecks } from '../src/attack-check.mjs';

const config = {
  step: 1,
  judgeIssuer: 'https://aleph-judge-production.up.railway.app/defense/judge',
  sampleMarker: 'SAMPLE_NOTE_1',
  publicAppUrl: 'https://student-defense.vercel.app',
};
const env = {
  VERCEL_GIT_PROVIDER: 'github',
  VERCEL_GIT_REPO_OWNER: 'Student-A',
  VERCEL_GIT_REPO_SLUG: 'aleph-defense',
  VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
  VERCEL_URL: 'student-defense-123.vercel.app',
};

test('build identity uses Vercel Git and deployment metadata', () => {
  assert.deepEqual(deploymentIdentity(env, config), {
    schema: 'aleph.defense.deployment.v1',
    step: 1,
    repoUrl: 'https://github.com/student-a/aleph-defense',
    commit: 'a'.repeat(40),
    publicAppUrl: 'https://student-defense-123.vercel.app',
    judgeIssuer: config.judgeIssuer,
    sampleMarker: config.sampleMarker,
  });
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_PROVIDER: undefined }, config));
  assert.throws(() => deploymentIdentity({ ...env, VERCEL_GIT_COMMIT_SHA: 'short' }, config));
});

test('step 5 deployment identity publishes only declared API routes', () => {
  const identity = deploymentIdentity(env, {
    ...config,
    step: 5,
    allowedRoutes: ['GET /api/notes', 'GET /api/auth-config'],
    originalApiUrl: 'https://example.supabase.co/rest/v1/vault_notes',
  });
  assert.deepEqual(identity.allowedRoutes, ['GET /api/notes', 'GET /api/auth-config']);
  assert.equal(identity.originalApiUrl, 'https://example.supabase.co/rest/v1/vault_notes');
});

test('stage 12 reads public data.json without credentials and keeps unrun writes separate', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      const path = new URL(url).pathname;
      if (path === '/data.json') return new Response('{"notes":[]}', { status: 200 });
      if (path === '/api/checks') return new Response('{"ready":true}', { status: 200 });
      return new Response('{"error":"LOGIN_REQUIRED"}', { status: 401 });
    };
    const results = await runAttackChecks({ ...config, step: 12 });
    assert.ok(calls.some(call => call.url === 'https://student-defense.vercel.app/data.json'));
    assert.ok(calls.length <= 24 && calls.every(call => call.init.method === 'GET'));
    assert.equal(results.find(item => item.attackId === 's01-static-notes').result, 'blocked');
    assert.equal(results.find(item => item.attackId === 's10-restore-unauth').result, 'not_run');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
