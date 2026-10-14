import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { deploymentIdentity } from '../scripts/deployment-identity.mjs';

test('stage 12 deployment identity keeps the declared restore path', () => {
  const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
  const identity = deploymentIdentity({
    VERCEL_GIT_PROVIDER: 'github',
    VERCEL_GIT_REPO_OWNER: 'ejdehdtjr-afk',
    VERCEL_GIT_REPO_SLUG: 'choi-bujang-secret-vault-2',
    VERCEL_GIT_COMMIT_SHA: 'a'.repeat(40),
    VERCEL_URL: 'choi-bujang-secret-vault-2-gamma.vercel.app',
  }, config);
  assert.equal(identity.step, 12);
  assert.equal(identity.restoreRoute, '/api/restore/:noteId');
  assert.deepEqual(identity.allowedRoutes, config.allowedRoutes);
  assert.equal(identity.originalApiUrl, config.originalApiUrl);
});
