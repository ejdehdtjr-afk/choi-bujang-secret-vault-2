import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide as brute } from '../xdr/brute-force/decide.mjs';
import { decide as web } from '../xdr/web-injection/decide.mjs';

for (const [name, decide, clearCount] of [['brute-force', brute, 10], ['web-injection', web, 8]]) {
  const alerts = JSON.parse(readFileSync(new URL(`../xdr/fixtures/${name}.json`, import.meta.url))).alerts;
  test(`${name}: input representation does not lose clear attacks`, async () => {
    for (const alert of alerts.slice(0, clearCount)) {
      const stringLevel = structuredClone(alert);
      stringLevel.rule.level = String(alert.rule.level);
      stringLevel.rule.mitre = { id: alert.rule.mitre };
      assert.equal((await decide(stringLevel)).action, 'block');
      const flat = { timestamp: alert.timestamp, sourceIp: alert.data.srcip,
        level: String(alert.rule.level), description: alert.rule.description,
        count: alert.data.count, accounts: alert.data.accounts };
      assert.equal((await decide(flat)).action, 'block');
    }
  });
}
test('success following many failures does not erase the attack evidence', async () => {
  assert.equal((await brute({ level: '12', count: 60,
    description: '로그인 실패 60건 뒤에 성공했습니다.' })).action, 'block');
  assert.equal((await brute({ level: '3', count: 1,
    description: '로그인 실패 1건 뒤에 성공했습니다.' })).action, 'record');
});
test('repeated ordinary traffic and one suspicious request are not blocked', async () => {
  assert.notEqual((await web({level: 12, count: 100, description: '자료 목록 조회'})).action, 'block');
  assert.notEqual((await web({level: 12, count: 1, description: 'SQL 주입 의심'})).action, 'block');
});
