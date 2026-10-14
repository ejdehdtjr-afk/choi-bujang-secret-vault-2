import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAlerts } from '../xdr/exfiltration/read-alerts.mjs';
import { decide } from '../xdr/exfiltration/decide.mjs';
import { runXdr } from '../scripts/xdr-run.mjs';

const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/exfiltration.json', import.meta.url)));

test('reader returns one redacted five-field summary for each transfer alert', () => {
  const rows = readAlerts(fixture.alerts);
  assert.equal(rows.length, fixture.alerts.length);
  assert.deepEqual(Object.keys(rows[0]), ['timestamp', 'sourceIp', 'account', 'level', 'description']);
  const secret = readAlerts([{ rule: { level: 10, description: 'token=example-sensitive-value' },
    data: { srcuser: 'password=example-sensitive-value' } }]);
  assert.doesNotMatch(JSON.stringify(secret), /example-sensitive-value/u);
});

test('isolated decision separates large suspicious transfers, uncertain events and normal traffic', async () => {
  const source = await readFile(new URL('../xdr/exfiltration/decide.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\b\s*(?:[\s\S]*?\bfrom\b|\()/u);
  const isolated = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const counts = { block: 0, alert: 0, record: 0 };
  for (const alert of fixture.alerts) {
    const output = isolated.decide(alert);
    assert.equal(output.action, decide(alert).action);
    assert.ok(output.confidence >= 0 && output.confidence <= 1);
    counts[output.action]++;
  }
  assert.deepEqual(counts, { block: 10, alert: 10, record: 10 });
  assert.notEqual(decide({ level: 12, description: '처음 보는 목적지로 전송이 실패했습니다.',
    bytes: 0, destinationIp: '203.0.113.100' }).action, 'block');
  assert.notEqual(decide({ level: 12, description: '평소 백업 목적지로 대용량 전송 완료',
    bytes: 90_000_000, destinationIp: '192.0.2.10' }).action, 'block');
});

test('runner makes expiring rules for suspicious destinations only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aleph-exfiltration-'));
  try {
    for (const folder of ['xdr/fixtures', 'xdr/exfiltration']) await mkdir(join(root, folder), { recursive: true });
    await copyFile(new URL('../xdr/fixtures/exfiltration.json', import.meta.url), join(root, 'xdr/fixtures/exfiltration.json'));
    await copyFile(new URL('../xdr/exfiltration/decide.mjs', import.meta.url), join(root, 'xdr/exfiltration/decide.mjs'));
    await copyFile(new URL('../xdr/exfiltration/respond.mjs', import.meta.url), join(root, 'xdr/exfiltration/respond.mjs'));
    const result = await runXdr({ root, moduleKey: 'exfiltration' });
    assert.deepEqual(result.counts, { block: 10, alert: 10, record: 10 });
    const rules = JSON.parse(await readFile(join(root, 'xdr/exfiltration/ztna-deny-rules.json'))).rules;
    assert.equal(rules.length, 10);
    assert.ok(rules.every(rule => rule.action === 'deny' && /^ex-(0[1-9]|10)$/u.test(rule.evidenceAlertId)
      && rule.destinationIp && Date.parse(rule.expiresAt) > Date.now()));
    assert.ok(!rules.some(rule => rule.destinationIp === '192.0.2.10' || rule.destinationIp === '198.51.100.10'));
    const notices = (await readFile(join(root, 'xdr/alerts.log'), 'utf8')).trim().split('\n');
    assert.equal(notices.length, 20);
    assert.equal(notices.filter(line => JSON.parse(line).action === 'alert').length, 10);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
