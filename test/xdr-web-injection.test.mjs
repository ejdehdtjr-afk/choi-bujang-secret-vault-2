import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide } from '../xdr/web-injection/decide.mjs';
import { readAlerts } from '../xdr/web-injection/read-alerts.mjs';

const fixture = JSON.parse(readFileSync(new URL('../xdr/fixtures/web-injection.json', import.meta.url), 'utf8'));

test('web injection reader extracts one safe summary per Wazuh alert', () => {
  const summaries = readAlerts(fixture.alerts);
  assert.equal(summaries.length, fixture.alerts.length);
  assert.deepEqual(Object.keys(summaries[0]).sort(), ['account', 'description', 'id', 'level', 'sourceIp', 'timestamp']);
});

test('web injection blocks repeated clear attacks and leaves normal requests unblocked', async () => {
  const outcomes = await Promise.all(fixture.alerts.map(decide));
  const counts = outcomes.reduce((all, item) => ({ ...all, [item.action]: all[item.action] + 1 }),
    { block: 0, alert: 0, record: 0 });
  assert.deepEqual(counts, { block: 8, alert: 9, record: 9 });
  for (let index = 17; index < outcomes.length; index += 1) assert.notEqual(outcomes[index].action, 'block');
});

test('unusually long request addresses are alerted without being blocked', async () => {
  const suspicious = await decide({level: 5, count: 1,
    description: '요청 주소가 평소보다 깁니다. 공격 표기는 없습니다.'});
  assert.equal(suspicious.action, 'alert');
  const normal = await decide({level: 3, count: 1, description: '자료 목록을 조회했습니다.'});
  assert.equal(normal.action, 'record');
});
