import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAlerts } from '../xdr/privilege/read-alerts.mjs';
import { decide } from '../xdr/privilege/decide.mjs';
import { runXdr } from '../scripts/xdr-run.mjs';

const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/privilege.json', import.meta.url)));

test('reader gives one redacted five-field summary per alert', () => {
  const rows = readAlerts(fixture.alerts);
  assert.equal(rows.length, fixture.alerts.length);
  assert.deepEqual(Object.keys(rows[0]), ['timestamp', 'sourceIp', 'account', 'level', 'description']);
  const secret = readAlerts([{ rule: { level: 10, description: 'token=example-sensitive-value' },
    data: { srcuser: 'password=example-sensitive-value' } }]);
  assert.doesNotMatch(JSON.stringify(secret), /example-sensitive-value/u);
});

test('standalone decide separates clear takeover from review and normal activity', async () => {
  const source = await readFile(new URL('../xdr/privilege/decide.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\b\s*(?:[\s\S]*?\bfrom\b|\()/u);
  const isolated = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const counts = { block: 0, alert: 0, record: 0 };
  for (const alert of fixture.alerts) {
    const output = isolated.decide(alert);
    assert.equal(output.action, decide(alert).action);
    assert.ok(output.confidence >= 0 && output.confidence <= 1);
    counts[output.action]++;
  }
  assert.deepEqual(counts, { block: 9, alert: 8, record: 9 });
  assert.notEqual(decide({ level: 12, description: '과제 그룹에 추가됐습니다. 관리자 그룹은 아닙니다.',
    group: 'project-week3' }).action, 'block');
  assert.equal(decide({ level: 3, description: '평소 관리 계정 로그인' }).action, 'record');
});

test('runner scopes expiring deny candidates to observed account and address', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aleph-privilege-'));
  try {
    for (const folder of ['xdr/fixtures', 'xdr/privilege']) await mkdir(join(root, folder), { recursive: true });
    await copyFile(new URL('../xdr/fixtures/privilege.json', import.meta.url), join(root, 'xdr/fixtures/privilege.json'));
    await copyFile(new URL('../xdr/privilege/decide.mjs', import.meta.url), join(root, 'xdr/privilege/decide.mjs'));
    await copyFile(new URL('../xdr/privilege/respond.mjs', import.meta.url), join(root, 'xdr/privilege/respond.mjs'));
    const result = await runXdr({ root, moduleKey: 'privilege' });
    assert.deepEqual(result.counts, { block: 9, alert: 8, record: 9 });
    const rules = JSON.parse(await readFile(join(root, 'xdr/privilege/ztna-deny-rules.json'))).rules;
    assert.equal(rules.length, 9);
    assert.ok(rules.every(rule => rule.action === 'deny' && /^pv-0[1-9]$/u.test(rule.evidenceAlertId)
      && rule.account && rule.sourceIp && Date.parse(rule.expiresAt) > Date.now()));
    assert.ok(rules.some(rule => rule.account === 'user01' && rule.sourceIp === '203.0.113.11'));
    assert.ok(!rules.some(rule => rule.account === 'user01' && rule.sourceIp === '192.0.2.76'));
    const notices = (await readFile(join(root, 'xdr/alerts.log'), 'utf8')).trim().split('\n');
    assert.equal(notices.length, 17);
    assert.equal(notices.filter(line => JSON.parse(line).action === 'alert').length, 8);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
