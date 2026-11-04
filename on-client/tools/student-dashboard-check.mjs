// 학생 검사: 모의 DOM/오류 검사와 실제 PC 조회를 구분해 기록한다.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve, dirname, relative, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizePcSnapshot, createLocalDashboard} from '../student/extension.mjs';
import {collectPcSnapshot} from './student-pc-snapshot.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = resolve(app, '..');
const git = (...args) => execFileSync('git', ['-C', project, ...args], {encoding: 'utf8'}).trim();
const report = {schema: 'keshev.final-dashboard-check.v1', startedAt: new Date().toISOString(),
  commit: git('rev-parse', 'HEAD'), workingTree: git('status', '--porcelain') ? 'modified' : 'clean',
  node: process.version, checks: [], productionVerified: false,
  unverified: ['다른 사람의 새 PC', '작업 관리자와 동시 비교', '실제 SDP/XDR·AI 연결·조치 집행', '공식 과제 판정']};
report.files = {};
for (const name of ['student/extension.mjs', 'tools/student-pc-snapshot.mjs']) {
  report.files[name] = createHash('sha256').update(readFileSync(resolve(app, name), 'utf8').replace(/\r\n/g, '\n')).digest('hex');
}
const check = async (id, kind, fn) => {
  try { const observed = await fn(); report.checks.push({id, kind, result: 'pass', checkedAt: new Date().toISOString(), observed}); }
  catch (error) { report.checks.push({id, kind, result: 'fail', checkedAt: new Date().toISOString(), reason: error instanceof assert.AssertionError ? '검사 조건 불일치' : '실행 또는 형식 확인 불가'}); }
};
const sample = () => {
  const checkedAt = new Date().toISOString();
  return {schema: 'keshev.pc-observation.v1', source: 'local-readonly', sampleId: '00000000-0000-4000-8000-000000000001', checkedAt,
    metrics: {cpu: {status: 'ok', source: 'node:os.cpus delta', checkedAt, value: 25, intervalMs: 1000},
      memory: {status: 'ok', source: 'node:os.totalmem/freemem', checkedAt, totalGiB: 16, freeGiB: 8},
      firewall: {status: 'ok', source: 'Get-NetFirewallProfile', checkedAt, enabled: [true, false, true]}}};
};
await check('protected-code-preserved', 'source-comparison', () => {
  const baseline = '55c987fefa9cc1a36e83b95b83c4b74c37453bd1';
  const changed = git('diff', baseline, '--name-only', '--', 'on-client/public', 'on-client/src', 'on-client/vendor', 'on-client/package.json', 'on-client/student/engine-adapter.mjs');
  assert.equal(changed, ''); return {baseline, changedProtectedFiles: 0};
});
await check('invalid-missing-numeric-and-secret-input', 'mock-input', () => {
  const input = sample(); input.metrics.cpu.value = NaN; input.metrics.memory.freeGiB = 99;
  input.metrics.firewall.enabled = 'not-array'; input.token = 'MOCK_PRIVATE';
  const output = normalizePcSnapshot(input);
  for (const key of ['cpu', 'memory', 'disk', 'firewall']) assert.equal(output.metrics[key].status, 'unverifiable');
  assert.ok(!JSON.stringify(output).includes('MOCK_PRIVATE'));
  assert.throws(() => normalizePcSnapshot({...sample(), checkedAt: new Date(Date.now() + 300000).toISOString()}));
  assert.throws(() => normalizePcSnapshot({schema: 'example'}));
  return {invalidMetricsNeverBecomeZeroOrNormal: true, unlistedFieldsRemoved: true};
});

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.handlers = {}; this.attrs = {}; this.text = ''; this.disabled = false; }
  set textContent(text) { this.text = String(text); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join('\n'); }
  set innerHTML(_) { throw Error('HTML not allowed'); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; this.text = ''; }
  setAttribute(key, value) { this.attrs[key] = value; }
  addEventListener(event, fn) { this.handlers[event] = fn; }
  focus() { this.focused = true; }
  click() { this.clicked = true; }
  async fire(event) { return this.handlers[event]?.(); }
}
globalThis.document = {createElement: tag => new Element(tag)};
const walk = root => [root, ...root.children.flatMap(walk)];
const timers = [], realTimer = globalThis.setTimeout;
globalThis.setTimeout = (...args) => { const timer = realTimer(...args); timers.push(timer); return timer; };
await check('dashboard-load-refresh-failure-clears-current-cards', 'mock-DOM', async () => {
  const root = createLocalDashboard();
  const file = walk(root).find(n => n.tag === 'input');
  const refresh = walk(root).find(n => n.tag === 'button' && n.textContent === '다시 조회');
  const data = sample(); data.metrics.systemEvents = {status: 'unverifiable'};
  assert.ok(root.textContent.includes('요청 전'));
  file.files = [{size: 1000, text: async () => JSON.stringify(data)}]; await file.fire('change');
  assert.ok(root.textContent.includes('25 %') && root.textContent.includes('8 / 16 GiB'));
  assert.ok(root.textContent.includes('개인: 꺼짐') && root.textContent.includes('침해·공격 탐지 판정이 아닙니다'));
  assert.equal(walk(root).filter(n => n.attrs['data-student-pc-card']).length, 4);
  await refresh.fire('click'); assert.ok(file.clicked && root.textContent.includes('새로 측정한 것으로 표시하지 않습니다'));
  file.files = [{size: 10, text: async () => '{invalid'}]; await file.fire('change');
  const cards = walk(root).filter(n => n.attrs['data-student-pc-card']);
  assert.ok(cards.every(n => n.textContent.includes('확인 불가')));
  assert.ok(root.textContent.includes('조회 실패') && root.textContent.includes('과거 관측 기록'));
  return {fourCards: true, historySeparateFromFailedCurrentQuery: true, noInnerHTML: true};
});
await check('stale-file-and-large-file-never-current', 'mock-DOM', async () => {
  const root = createLocalDashboard(), file = walk(root).find(n => n.tag === 'input');
  const data = sample(); data.checkedAt = new Date(Date.now() - 300000).toISOString();
  for (const m of Object.values(data.metrics)) m.checkedAt = data.checkedAt;
  file.files = [{size: 1000, text: async () => JSON.stringify(data)}]; await file.fire('change');
  assert.ok(root.textContent.includes('오래된 관측'));
  assert.ok(walk(root).filter(n => n.attrs['data-student-pc-card']).every(n => n.textContent.includes('확인 불가')));
  file.files = [{size: 200000, text: async () => { throw Error('must not read'); }}]; await file.fire('change');
  assert.ok(root.textContent.includes('조회 실패'));
});
await check('newer-file-wins-over-delayed-old-read', 'mock-DOM', async () => {
  const root = createLocalDashboard(), file = walk(root).find(n => n.tag === 'input');
  let release;
  file.files = [{size: 1, text: () => new Promise(resolve => { release = resolve; })}]; const first = file.fire('change');
  await Promise.resolve(); await Promise.resolve();
  const next = sample(); next.metrics.cpu.value = 75;
  file.files = [{size: 1000, text: async () => JSON.stringify(next)}]; await file.fire('change');
  release(JSON.stringify(sample())); await first;
  assert.ok(root.textContent.includes('75 %') && !root.textContent.includes('25 %'));
});
await check('folder-refresh-reads-new-file-without-network', 'mock-DOM', async () => {
  let value = sample(), reads = 0;
  const originalPicker = globalThis.showDirectoryPicker;
  globalThis.showDirectoryPicker = async () => ({getFileHandle: async name => {
    assert.equal(name, 'pc-observation.json'); reads++;
    return {getFile: async () => ({size: 1000, text: async () => JSON.stringify(value)})};
  }});
  try {
    const root = createLocalDashboard();
    await walk(root).find(n => n.tag === 'button' && n.textContent === '측정 폴더 선택').fire('click');
    value = sample(); value.metrics.cpu.value = 65;
    await walk(root).find(n => n.tag === 'button' && n.textContent === '다시 조회').fire('click');
    assert.equal(reads, 2); assert.ok(root.textContent.includes('65 %'));
    return {newFileReadEachClick: true, source: 'mock-folder-handle'};
  } finally { globalThis.showDirectoryPicker = originalPicker; }
});
for (const timer of timers) clearTimeout(timer);
globalThis.setTimeout = realTimer;
await check('local-PC-readonly-measurement', 'actual-local-PC', async () => {
  const raw = await collectPcSnapshot(), data = normalizePcSnapshot(raw);
  assert.equal(data.metrics.cpu.status, 'ok'); assert.equal(data.metrics.memory.status, 'ok');
  for (const forbidden of ['hostname', 'username', 'ipAddress', 'message', 'token']) assert.ok(!Object.hasOwn(raw, forbidden));
  return data;
});
await check('no-write-security-command-or-network-in-collector', 'source-inspection', () => {
  const source = readFileSync(resolve(app, 'tools/student-pc-snapshot.mjs'), 'utf8');
  assert.ok(!/Set-Net|Remove-|Restart-|Enable-|Disable-|Invoke-WebRequest|fetch\(/i.test(source));
  return {securityConfigurationWrites: false, networkTransmission: false};
});
report.finishedAt = new Date().toISOString();
const args = process.argv.slice(2);
if (args.length) {
  assert.equal(args[0], '--output'); assert.equal(args.length, 2); assert.ok(isAbsolute(args[1]));
  const rel = relative(project, resolve(args[1])); assert.ok(rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel));
  writeFileSync(args[1], JSON.stringify(report, null, 2) + '\n', {encoding: 'utf8', flag: 'wx'});
}
console.log(JSON.stringify({passed: report.checks.filter(c => c.result === 'pass').length,
  failed: report.checks.filter(c => c.result === 'fail').length, checks: report.checks.map(({id, result}) => ({id, result})), productionVerified: false}));
process.exitCode = report.checks.some(c => c.result !== 'pass') ? 1 : 0;
