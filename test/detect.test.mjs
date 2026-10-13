import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detect } from '../src/detect.mjs';

const start = Date.UTC(2026, 9, 1);
const event = (index, subject = 'learner_fixture', method = 'GET') => ({
  at: new Date(start + index * 2000).toISOString(),
  method,
  identity: { sub: subject },
});

test('only verified-format GET events of one subject count toward revocation', () => {
  const events = [
    ...Array.from({ length: 60 }, (_, index) => event(index)),
    ...Array.from({ length: 61 }, (_, index) => event(index, 'learner_fixture', 'POST')),
    ...Array.from({ length: 61 }, (_, index) => event(index, 'other_fixture')),
    { ...event(0), identity: undefined },
  ];
  assert.deepEqual(detect(events), { action: 'observe' });
});

test('unsorted events still detect the same subject within a ten-minute window', () => {
  const events = Array.from({ length: 121 }, (_, index) => event(index)).reverse();
  assert.deepEqual(detect(events), {
    action: 'propose_revocation', reasonCode: 'burst_read', subject: 'learner_fixture',
  });
});
