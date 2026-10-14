import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decide } from '../xdr/known-cve/decide.mjs';
import { readAlerts } from '../xdr/known-cve/read-alerts.mjs';
import { runXdr } from '../scripts/xdr-run.mjs';

const fixture = JSON.parse(await readFile(new URL('../xdr/fixtures/known-cve.json', import.meta.url)));

test('reader keeps one safe five-field summary per alert', () => {
  const rows = readAlerts(fixture.alerts);
  assert.equal(rows.length, fixture.alerts.length);
  assert.deepEqual(Object.keys(rows[0]), ['timestamp', 'sourceIp', 'account', 'level', 'description']);
  const secret = readAlerts([{ rule: { level: 10, description: 'token=example-sensitive-value' },
    data: { srcuser: 'password=example-sensitive-value' } }]);
  assert.doesNotMatch(JSON.stringify(secret), /example-sensitive-value/u);
});

test('isolated decide separates clear, ambiguous and ordinary events', async () => {
  const source = await readFile(new URL('../xdr/known-cve/decide.mjs', import.meta.url), 'utf8');
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
  assert.equal(decide({ level: 12, description: 'ordinary successful request' }).action, 'record');
  assert.equal(decide({ level: 12, description: 'CVE-2021-44228 reference only' }).action, 'alert');
});

test('runner emits expiring deny candidates only for clear alerts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aleph-known-cve-'));
  try {
    const { mkdir, copyFile } = await import('node:fs/promises');
    for (const folder of ['scripts', 'xdr/fixtures', 'xdr/known-cve']) {
      await mkdir(join(root, folder), { recursive: true });
    }
    // Runner imports the standalone files from the supplied root.
    await copyFile(new URL('../xdr/fixtures/known-cve.json', import.meta.url), join(root, 'xdr/fixtures/known-cve.json'));
    await copyFile(new URL('../xdr/known-cve/decide.mjs', import.meta.url), join(root, 'xdr/known-cve/decide.mjs'));
    await copyFile(new URL('../xdr/known-cve/respond.mjs', import.meta.url), join(root, 'xdr/known-cve/respond.mjs'));
    const result = await runXdr({ root, moduleKey: 'known-cve' });
    assert.deepEqual(result.counts, { block: 8, alert: 8, record: 8 });
    const rules = JSON.parse(await readFile(join(root, 'xdr/known-cve/ztna-deny-rules.json'))).rules;
    assert.equal(rules.length, 8);
    assert.ok(rules.every(rule => rule.action === 'deny' && /^kc-0[1-8]$/u.test(rule.evidenceAlertId)
      && Date.parse(rule.expiresAt) > Date.now()));
    const notices = (await readFile(join(root, 'xdr/alerts.log'), 'utf8')).trim().split('\n');
    assert.equal(notices.length, 16);
    assert.equal(notices.filter(line => JSON.parse(line).action === 'alert').length, 8);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
