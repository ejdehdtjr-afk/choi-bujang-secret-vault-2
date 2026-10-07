import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

for (const [name, expected] of [
  ['brute-force', { block: 10, alert: 9, record: 9 }],
  ['web-injection', { block: 8, alert: 8, record: 10 }],
]) {
  const source = readFileSync(new URL(`../xdr/${name}/decide.mjs`, import.meta.url), 'utf8');
  const fixture = JSON.parse(readFileSync(new URL(`../xdr/fixtures/${name}.json`, import.meta.url)));
  test(`${name}: single-file module runs without a repository or relative imports`, async () => {
    const { decide } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
    const counts = {block: 0, alert: 0, record: 0};
    for (const alert of fixture.alerts) counts[(await decide(alert)).action]++;
    assert.deepEqual(counts, expected);
  });
  test(`${name}: isolated context needs neither process nor network`, async () => {
    const decide = runInNewContext(source.replace('export async function decide', 'async function decide') + '\n;decide;', {}, {timeout: 1000});
    const counts = {block: 0, alert: 0, record: 0};
    for (const alert of fixture.alerts) {
      const result = await decide(alert);
      assert.ok(Number.isFinite(result.confidence));
      counts[result.action]++;
      if (alert.rule.level <= 3) assert.equal(result.action, 'record');
    }
    assert.deepEqual(counts, expected);
  });
}
