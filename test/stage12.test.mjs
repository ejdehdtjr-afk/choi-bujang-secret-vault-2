import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixtureRequests } from '../scripts/fixture-7.mjs';
import { decide, RULE_IDS } from '../src/decider.mjs';
import { RULE_CASES, runRuleCheck } from '../src/rule-check.mjs';
import { observeAll, observeScreens } from '../src/attack-check.mjs';
import { operationsStatus } from '../src/operations.mjs';

function fakeFetch(url, options) {
  const path = new URL(url).pathname;
  const content = path === '/data.json' ? { notes: [] }
    : path === '/api/checks' ? { ready: true }
      : path === '/manifest.webmanifest' ? { name: '자료실' }
        : { error: 'LOGIN_REQUIRED' };
  const html = path === '/' ? '<link rel="manifest" href="/manifest.webmanifest">기기 승인'
    : path === '/operations.html' ? 'fetch("/api/checks") 탈환 작전실' : null;
  const status = ['/data.json', '/api/checks', '/manifest.webmanifest', '/', '/operations.html'].includes(path)
    ? 200 : 401;
  return Promise.resolve(new Response(html ?? JSON.stringify(content), {
    status, headers: { 'x-vercel-id': 'test::request-123' },
  }));
}

test('판정기는 계약의 다섯 응답 필드와 등록된 규칙 ID만 반환한다', async () => {
  const { normal, suspicious } = fixtureRequests();
  for (const request of [normal, suspicious, { ...normal, requestId: randomUUID(), deviceRegistered: false },
    { ...normal, requestId: randomUUID(), path: '/api/notes', route: 'GET /api/notes' },
    { ...normal, requestId: randomUUID(), method: 'PUT' }]) {
    const result = await decide(request);
    assert.deepEqual(Object.keys(result).sort(), ['decision', 'reasonCode', 'requestId', 'ruleIds', 'schema']);
    assert.equal(result.requestId, request.requestId);
    assert.equal(result.schema, 'aleph.decision.v1');
    assert.ok(['allow', 'deny', 'step_up'].includes(result.decision));
    assert.ok(result.ruleIds.length > 0 && result.ruleIds.every(id => RULE_IDS.includes(id)));
  }
});

test('고정 가상 입력의 기기·재인증·구역·탐지 사례를 실제 학생 함수로 실행한다', async () => {
  for (const id of [...Object.keys(RULE_CASES), 's09-burst-read']) {
    const result = await runRuleCheck(id);
    assert.equal(result.ready, true, id);
    assert.equal(result.engineEnforced, 'not_run');
  }
  assert.equal(await runRuleCheck('__proto__'), null);
});

test('제출 점검은 읽기 요청 24건 이하이며 미실행 쓰기를 성공으로 세지 않는다', async () => {
  const calls = [];
  const fetch = (url, options) => { calls.push({ url: String(url), options }); return fakeFetch(url, options); };
  const rows = await observeAll('https://example.vercel.app', { fetch });
  assert.ok(rows.length <= 20 && calls.length <= 24);
  assert.ok(calls.every(call => call.options.method === 'GET' && call.options.body === undefined));
  assert.equal(rows.find(row => row.attackId === 's10-restore-unauth').result, 'not_run');
  assert.equal(rows.find(row => row.attackId === 's11-unsigned-write').result, 'not_run');
  assert.equal(rows.find(row => row.attackId === 's11-device').result, 'blocked');
  assert.ok(rows.every(row => row.requests.length <= 1));
  const keys = calls.map(call => call.options.alephEvidence.requestKey);
  assert.equal(new Set(keys).size, keys.length);
  const screens = await observeScreens('https://example.vercel.app', { fetch });
  assert.ok(screens.every(row => ['as_expected', 'unexpected', 'not_run'].includes(row.result)));
});

test('작전실 집계는 같은 실측 행에서 계산되고 민감한 자료를 포함하지 않는다', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = fakeFetch;
  try {
    const result = await operationsStatus({ now: 1000000 });
    assert.equal(result.total, result.rows.length);
    assert.equal(result.total, result.blocked + result.failed + result.notRun);
    assert.equal(result.commit, null);
    assert.equal(result.revocation.state, 'not_connected');
    assert.equal(result.recovery.memoBackups.state, 'not_run');
    assert.equal(result.rows.find(row => row.attackId === 's03-unauth-list').requests[0].requestId, 'request-123');
    assert.doesNotMatch(JSON.stringify(result), /"title"\s*:|"body"\s*:|sb_secret_|SUPABASE_SECRET_KEY/u);
  } finally {
    globalThis.fetch = original;
  }
});
