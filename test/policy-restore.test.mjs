import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comparePolicy, restoredTestPolicy } from '../scripts/restore-test-policy.mjs';

const backup = {
  schema: 'aleph.safe-policy.v1',
  sourceCommit: '36e7fca210064e43b6157b5e87f4bc1aacaa939f',
  policyRevision: 1,
  deciderSha256: 'a'.repeat(64),
  allowedRoutes: [{ service: 'notes', method: 'GET', pathPattern: '/api/my/notes', zone: 'my-notes' }],
};

test('preview scopes changes and restore preserves unrelated service settings', () => {
  const current = { schema: 'aleph.test-policy.v1', policyRevision: 2,
    deciderSha256: 'b'.repeat(64), allowedRoutes: [], otherServices: { retained: true } };
  assert.deepEqual(comparePolicy(backup, current).changed,
    ['policyRevision', 'deciderSha256', 'allowedRoutes']);
  const restored = restoredTestPolicy(backup, current);
  assert.deepEqual(restored.otherServices, { retained: true });
  assert.deepEqual(restored.allowedRoutes, backup.allowedRoutes);
  assert.deepEqual(comparePolicy(backup, restored).changed, []);
  assert.equal(current.policyRevision, 2);
});

test('untrusted or missing backup cannot be applied', () => {
  const current = { schema: 'aleph.test-policy.v1', allowedRoutes: [] };
  assert.throws(() => restoredTestPolicy(null, current));
  assert.throws(() => restoredTestPolicy({ ...backup, sourceCommit: '0'.repeat(40) }, current));
});
