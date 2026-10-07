import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide } from '../xdr/brute-force/decide.mjs';
import { readAlerts } from '../xdr/brute-force/read-alerts.mjs';

const fixture = JSON.parse(readFileSync(new URL('../xdr/fixtures/brute-force.json', import.meta.url), 'utf8'));

test('brute-force reader extracts one safe summary per Wazuh alert', () => {
  const summaries = readAlerts(fixture.alerts);
  assert.equal(summaries.length, fixture.alerts.length);
  assert.deepEqual(Object.keys(summaries[0]).sort(), ['account', 'description', 'id', 'level', 'sourceIp', 'timestamp']);
});

test('brute-force decision blocks clear attacks without blocking normal alerts', async () => {
  const outcomes = await Promise.all(fixture.alerts.map(decide));
  const counts = outcomes.reduce((all, item) => ({ ...all, [item.action]: all[item.action] + 1 }),
    { block: 0, alert: 0, record: 0 });
  assert.deepEqual(counts, { block: 10, alert: 6, record: 12 });
  for (let index = 19; index < outcomes.length; index += 1) assert.notEqual(outcomes[index].action, 'block');
  assert.equal(outcomes[3].action, 'block');
  assert.equal(outcomes[9].action, 'block');
});
