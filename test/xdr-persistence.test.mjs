import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAlerts } from '../xdr/persistence/read-alerts.mjs';
import { decide } from '../xdr/persistence/decide.mjs';
import { runXdr } from '../scripts/xdr-run.mjs';

const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/persistence.json', import.meta.url)));

test('reader returns one redacted five-field summary per alert', () => {
  const rows = readAlerts(fixture.alerts);
  assert.equal(rows.length, fixture.alerts.length);
  assert.deepEqual(Object.keys(rows[0]), ['timestamp', 'sourceIp', 'account', 'level', 'description']);
  const secret = readAlerts([{ rule: { level: 10, description: 'token=example-sensitive-value' },
    data: { srcuser: 'password=example-sensitive-value' } }]);
  assert.doesNotMatch(JSON.stringify(secret), /example-sensitive-value/u);
});

test('isolated decision distinguishes clear persistence, ambiguous changes and normal activity', async () => {
  const source = await readFile(new URL('../xdr/persistence/decide.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bimport\b\s*(?:[\s\S]*?\bfrom\b|\()/u);
  const isolated = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const counts = { block: 0, alert: 0, record: 0 };
  for (const alert of fixture.alerts) {
    const output = isolated.decide(alert);
    assert.equal(output.action, decide(alert).action);
    assert.ok(output.confidence >= 0 && output.confidence <= 1);
    counts[output.action]++;
  }
  assert.deepEqual(counts, { block: 8, alert: 8, record: 8 });
  assert.equal(decide({ level: 12, description: '기존 서명된 서비스가 정상 실행 중입니다.' }).action, 'record');
  assert.notEqual(decide({ level: 12, description: '임시 폴더에 파일이 있지만 서비스 등록은 없습니다.' }).action, 'block');
});

test('runner creates expiring deny candidates for clear alerts only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aleph-persistence-'));
  try {
    for (const folder of ['xdr/fixtures', 'xdr/persistence']) {
      await mkdir(join(root, folder), { recursive: true });
    }
    await copyFile(new URL('../xdr/fixtures/persistence.json', import.meta.url), join(root, 'xdr/fixtures/persistence.json'));
    await copyFile(new URL('../xdr/persistence/decide.mjs', import.meta.url), join(root, 'xdr/persistence/decide.mjs'));
    await copyFile(new URL('../xdr/persistence/respond.mjs', import.meta.url), join(root, 'xdr/persistence/respond.mjs'));
    const result = await runXdr({ root, moduleKey: 'persistence' });
    assert.deepEqual(result.counts, { block: 8, alert: 8, record: 8 });
    const rules = JSON.parse(await readFile(join(root, 'xdr/persistence/ztna-deny-rules.json'))).rules;
    assert.equal(rules.length, 8);
    assert.ok(rules.every(rule => rule.action === 'deny' && /^ps-0[1-8]$/u.test(rule.evidenceAlertId)
      && Date.parse(rule.expiresAt) > Date.now()));
    const notices = (await readFile(join(root, 'xdr/alerts.log'), 'utf8')).trim().split('\n');
    assert.equal(notices.length, 16);
    assert.equal(notices.filter(line => JSON.parse(line).action === 'alert').length, 8);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
