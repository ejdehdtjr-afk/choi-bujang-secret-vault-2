// 학생 재현 검사. 실제 계정·유료 AI·외부 OSV·조치 집행을 호출하지 않는다.
import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {readFileSync, existsSync, writeFileSync, realpathSync} from 'node:fs';
import {resolve, dirname, relative, isAbsolute} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  assert.ok(['--project', '--output'].includes(args[i]) && args[i + 1] && !options[args[i]], 'invalid options');
  options[args[i]] = args[i + 1];
}
const project = realpathSync(options['--project'] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
const app = resolve(project, 'on-client');
const git = (...args) => execFileSync('git', ['-C', project, ...args], {encoding: 'utf8', windowsHide: true}).trim();
assert.equal(realpathSync(git('rev-parse', '--show-toplevel')), project, 'project must be Git root');
assert.ok(options['--output'] && isAbsolute(options['--output']), 'absolute output required');
const outputParent = realpathSync(dirname(options['--output']));
const output = resolve(outputParent, options['--output'].split(/[\\/]/).pop());
const textHash = path => createHash('sha256').update(readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex');
const rel = relative(project, output);
assert.ok(rel === '..' || rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel), 'output must be outside project');
assert.ok(!existsSync(output), 'existing evidence is preserved; choose a new output file');

const report = {
  schema: 'keshev.student-reproduction.v1',
  commit: git('rev-parse', 'HEAD'), branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  repository: git('config', '--get', 'remote.origin.url').replace(/\.git$/, ''),
  project, startedAt: new Date().toISOString(),
  gitStatusBefore: git('status', '--porcelain'),
  hashFormat: 'sha256-utf8-LF', runnerSha256: textHash(fileURLToPath(import.meta.url)),
  runtime: {node: process.version, platform: process.platform, arch: process.arch, git: git('--version')},
  version: '검증 중', productionVerified: false,
  checks: [], codeHashes: {},
  unverified: ['브라우저 수동 조작·클립보드', '새 PC·프로그램 신규 설치·Node 24.19.0', '실제 계정·SDP/XDR 연결', 'AI 승인·모델 실행', '실제 OSV 외부 조회', '조치 집행·원천 효과 관측', 'ALEPH 공식 판정'],
};
assert.equal(report.gitStatusBefore, '', 'use a clean checkout to bind evidence to HEAD');
for (const name of ['student/extension.mjs', 'public/app.js', 'src/server.mjs', 'package.json', '.env.example']) {
  report.codeHashes['on-client/' + name] = textHash(resolve(app, name));
}
const check = async (stage, id, kind, fn) => {
  try {
    const observed = await fn();
    report.checks.push({stage, id, kind, result: 'pass', checkedAt: new Date().toISOString(), observed: observed ?? null});
  } catch {
    report.checks.push({stage, id, kind, result: 'fail', checkedAt: new Date().toISOString(), observed: '검사 조건 불일치. 원문 오류·인증값은 기록하지 않음'});
  }
};

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.handlers = {}; this.text = ''; this.value = ''; this.disabled = false; }
  set textContent(text) { this.text = String(text); this.children = []; }
  get textContent() { return this.text + this.children.map(child => child.textContent).join('\n'); }
  set innerHTML(_) { throw Error('HTML parsing is not allowed'); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.text = ''; this.children = children; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  addEventListener(name, fn) { this.handlers[name] = fn; }
  async fire(name) { if (!this.disabled) return this.handlers[name]?.(); }
}
const walk = root => [root, ...root.children.flatMap(walk)];
const withAttr = (root, key) => walk(root).filter(node => Object.hasOwn(node.attrs, key));
globalThis.document = {createElement: tag => new Element(tag)};
const copied = [];
Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {clipboard: {writeText: async text => { copied.push(text); }}}});
const fetchLocal = globalThis.fetch.bind(globalThis);
globalThis.fetch = () => { throw Error('mock stages cannot make network requests'); };
const view = (await import(pathToFileURL(resolve(app, 'student/extension.mjs')).href)).createStudentView();
const ok = data => ({status: 'ok', mode: 'demo', data});
const event = id => ({id, kind: 'xdr', at: '2026-11-03T00:00:00Z', appId: 'mock-app', summary: 'mock event', evidence: [{id: id + '-e', text: '<b>mock evidence</b>'}], rules: [{id: id + '-r', text: 'mock rule'}], state: {access: 'denied', session: 'unknown', device: 'unknown'}, supportedActions: []});

await check('21', 'new-checkout-runtime-and-syntax', 'actual-command', () => {
  const ps = resolve(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
  report.runtime.powershell = execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.ToString()'], {encoding: 'utf8', windowsHide: true}).trim();
  report.runtime.npm = execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', 'npm.cmd --version'], {encoding: 'utf8', windowsHide: true}).trim();
  execFileSync(ps, ['-NoProfile', '-NonInteractive', '-Command', 'npm.cmd run check'], {cwd: app, windowsHide: true, stdio: 'pipe'});
  const envFileCopied = existsSync(resolve(app, '.env')) || existsSync(resolve(project, '.env'));
  assert.equal(envFileCopied, false, 'fresh reproduction must not copy credentials');
  return {syntax: 'pass', envFileCopied};
});
await check('13', 'identity-current-values-and-failure', 'mock-DOM', () => {
  const input = {me: ok({user: {id: 'mock-user', label: 'mock-label'}, device: {id: 'mock-device', label: 'mock-PC', status: 'noncompliant'}, session: {id: 'mock-session', status: 'revoked'}}), devices: ok([]), sessions: ok([])};
  const root = view.renderIdentity(input);
  for (const text of ['mock-user', '보안 기준 미충족(noncompliant)', '철회됨(revoked)']) assert.ok(root.textContent.includes(text));
  const error = {status: 'error', mode: 'disconnected', error: {message: 'mock-error'}};
  const failed = view.renderIdentity({me: error, devices: error, sessions: error});
  assert.ok(!failed.textContent.includes('mock-user') && failed.textContent.includes('mock-error'));
  return {currentInputReplacesOldIdentity: true};
});
for (const [decision, text] of [['allow', '접근 허용'], ['deny', '접근 거부'], ['challenge', '추가 인증 또는 확인 필요'], ['unknown', '판정 확인 불가']]) {
  await check('14', 'decision-' + decision, 'mock-DOM', () => {
    const root = view.renderDecision({status: 'ok', mode: 'demo', appId: 'mock-app', data: {appId: 'mock-app', decision, reason: 'mock-reason', checkedAt: '2026-11-03T00:00:00Z'}});
    assert.ok(root.textContent.includes(`${text}(${decision})`) && root.textContent.includes('mock-reason'));
  });
}
await check('15', 'event-filter-detail-and-reset', 'mock-DOM', async () => {
  const a = event('mock-A'), b = {...event('mock-B'), kind: 'access', at: '2026-11-02T00:00:00Z'};
  const input = [b, a];
  const root = view.renderEvents(ok(input));
  assert.deepEqual(withAttr(root, 'data-student-event-id').map(row => row.attrs['data-student-event-id']), ['mock-A', 'mock-B']);
  assert.equal(input[0].id, 'mock-B');
  const select = walk(root).find(node => node.attrs['aria-label'] === '기록 종류'); select.value = 'xdr'; await select.fire('change');
  assert.equal(withAttr(root, 'data-student-event-id').length, 1);
  await walk(root).find(node => node.tag === 'button' && node.textContent === 'mock-A 상세').fire('click');
  const detail = withAttr(root, 'data-student-event-detail')[0];
  for (const text of ['mock-A-e', 'mock-A-r', '확인 불가(unknown)']) assert.ok(detail.textContent.includes(text));
  assert.equal(withAttr(view.renderEvents(ok([b])), 'data-student-event-detail').length, 0);
});
await check('16', 'diagnostics-safe-copy-and-unsupported-action', 'mock-DOM', async () => {
  const root = view.renderStatus({devices: ok([]), sessions: ok([]), notifications: [], diagnostics: ok({requestId: 'mock-request', component: 'mock-component', version: 'mock-version', checkedAt: '2026-11-03T00:00:00Z', engine: {mode: 'demo', code: 'DEMO_ONLY', token: 'MOCK_PRIVATE'}, token: 'MOCK_PRIVATE'}), mode: 'demo'});
  assert.equal(copied.length, 0);
  await walk(root).find(node => node.tag === 'button' && node.textContent === '도움정보 복사').fire('click');
  assert.equal(copied.length, 1); assert.ok(!copied[0].includes('MOCK_PRIVATE'));
  assert.ok(root.textContent.includes('등록된 기기가 없습니다') && root.textContent.includes('현재 연결이 없습니다'));
  const record = {...event('mock-A'), supportedActions: ['mock-action']};
  const events = view.renderEvents(ok([record]));
  await walk(events).find(node => node.tag === 'button' && node.textContent === 'mock-A 상세').fire('click');
  const button = walk(events).find(node => node.tag === 'button' && node.textContent === 'mock-action 미지원');
  assert.ok(button.disabled && !button.handlers.click);
});
await check('17', 'ai-check-separate-from-explanation-and-reset', 'mock-DOM', () => {
  const root = view.renderAiConnection({status: 'ok', mode: 'demo', data: {transportChecked: true, audienceAuthorization: 'test', modelCount: 2}, checkedAt: '2026-11-03T00:00:00Z'});
  assert.ok(root.textContent.includes('시험 연결 점검(test)') && root.textContent.includes('사건 설명은 아직 실행하지 않았습니다'));
  const idle = view.renderAiConnection({status: 'idle'}); assert.ok(!idle.textContent.includes('응답 모델 수'));
});
await check('18', 'explanation-evidence-and-not-executed', 'mock-DOM', () => {
  const record = event('mock-A');
  const data = {summary: 'mock AI summary', evidenceIds: ['mock-A-e'], proposals: [], requiresHumanConfirmation: true, executed: false};
  const root = view.renderExplanation({event: record, explanation: ok(data)});
  assert.equal(root.attrs['data-student-explanation-event'], 'mock-A');
  assert.ok(root.textContent.includes('mock-A-e — <b>mock evidence</b>') && root.textContent.includes('mock-A-r — mock rule'));
  const wrong = view.renderExplanation({event: event('mock-B'), explanation: ok(data)});
  assert.ok(!wrong.attrs['data-student-explanation-event']);
  const failed = view.renderExplanation({event: null, explanation: {status: 'error', error: {code: 'ON_AI_INVALID_INPUT', message: 'mock insufficient evidence'}}});
  assert.ok(failed.textContent.includes('mock insufficient evidence'));
});
await check('19', 'ACK-is-not-effect-and-no-action-request', 'mock-DOM', () => {
  const input = {status: 'pending', event: event('mock-A'), actionId: 'mock-action', target: {id: 'device:mock', generation: 1}, receipt: {requestId: 'mock-request', receiptId: 'mock-receipt', version: 1}};
  const pending = view.renderAction(input); assert.ok(pending.textContent.includes('ACK') && !pending.textContent.includes('효과 확인(succeeded)'));
  const falseEffect = view.renderAction({...input, status: 'succeeded', observation: {effectApplied: false}}); assert.ok(falseEffect.textContent.includes('결과 불명(unknown)'));
  const actualMock = view.renderAction({...input, status: 'succeeded', observation: {effectApplied: true, observedAt: '2026-11-03T00:00:00Z'}});
  assert.ok(actualMock.textContent.includes('효과 확인(succeeded)'));
  assert.ok(!walk(actualMock).some(node => node.tag === 'button'));
  return {effectSource: 'mock only', productionEffect: 'UNV'};
});
await check('20', 'OSV-partial-and-exact-version', 'mock-DOM', () => {
  const root = view.renderVulnerabilities(ok({status: 'partial', lockfileVersion: 3, lockfileHash: 'a'.repeat(64), checkedAt: '2026-11-03T00:00:00Z', packages: [{name: 'mock-public-package', version: '1.2.3', status: 'unverifiable', source: 'https://api.osv.dev/v1/querybatch', checkedAt: '2026-11-03T00:00:00Z', vulnerabilities: [{id: 'MOCK-VULN-001', modified: '2026-11-02T00:00:00Z'}]}]}));
  assert.equal(withAttr(root, 'data-student-package-version')[0].attrs['data-student-package-version'], '1.2.3');
  assert.ok(root.textContent.includes('일부 확인·전체 조회 확인 불가') && root.textContent.includes('MOCK-VULN-001'));
  const loading = view.renderVulnerabilities({status: 'loading'}); assert.equal(withAttr(loading, 'data-student-package-name').length, 0);
});
await check('21', 'readme-runbook-and-config-example', 'source-inspection', () => {
  const doc = readFileSync(resolve(app, 'docs/STUDENT_RUNBOOK.md'), 'utf8');
  for (const text of ['npm.cmd run demo', 'npm.cmd start', 'mermaid', '미확인']) assert.ok(doc.includes(text));
  assert.ok(existsSync(resolve(app, '.env.example')));
});

// 호스트의 인증 환경을 넘기지 않고 로컬 자식 서버만 검사한다.
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
for (const mode of ['demo', 'disconnected', 'demo-restart']) {
  await check(mode === 'disconnected' ? '13-21' : '13-16/21', 'local-server-' + mode, 'actual-local-HTTP', async () => {
    const env = {};
    for (const name of ['SystemRoot', 'WINDIR', 'PATH', 'Path', 'TEMP', 'TMP']) if (process.env[name]) env[name] = process.env[name];
    env.ON_PORT = '5216'; env.ON_APPROVED_PUBLIC_PACKAGES = '[]';
    const server = resolve(app, 'src/server.mjs');
    const child = spawn(process.execPath, [server, ...(mode === 'disconnected' ? [] : ['--demo'])], {cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    const expected = mode === 'disconnected' ? '연결 확인' : '예제';
    let stdout = '';
    child.stdout.on('data', bytes => { stdout += bytes.toString('utf8'); });
    child.stderr.on('data', () => {}); // 원문 스택·불필요한 환경 정보를 증거에 쓰지 않는다.
    const exited = new Promise(resolve => { child.once('exit', resolve); child.once('error', () => resolve()); });
    try {
      for (let i = 0; i < 80 && !stdout.includes(`케셰브 ${expected}:`); i++) { if (child.exitCode !== null) break; await wait(100); }
      assert.ok(stdout.includes(`케셰브 ${expected}:`), 'expected fresh child startup');
      const base = 'http://127.0.0.1:5216';
      const home = await fetchLocal(base + '/'); assert.equal(home.status, 200);
      const student = await fetchLocal(base + '/student/extension.mjs'); assert.equal(student.status, 200);
      const identityResponse = await fetchLocal(base + '/api/me');
      const identity = await identityResponse.json();
      const diagnostics = await (await fetchLocal(base + '/api/diagnostics')).json();
      const scan = await (await fetchLocal(base + '/api/vulnerabilities')).json();
      assert.equal(scan.data.status, 'not_configured');
      if (mode === 'disconnected') { assert.equal(identityResponse.status, 503); assert.equal(identity.error.code, 'ENGINE_NOT_CONNECTED'); }
      else {
        assert.equal(identityResponse.status, 200); assert.equal(identity.meta.mode, 'demo');
        const events = await (await fetchLocal(base + '/api/events')).json();
        assert.ok(events.data.length > 0 && events.data.every(row => row.supportedActions.length === 0));
      }
      assert.equal(diagnostics.data.engine.mode, mode === 'disconnected' ? 'disconnected' : 'demo');
      return {port: 5216, homeHttp: home.status, studentHttp: student.status, identityHttp: identityResponse.status, mode: diagnostics.data.engine.mode, scanStatus: scan.data.status, shutdownVerified: true, origin: 'local demo/default only'};
    } finally {
      child.kill(); await exited;
      let stopped = false;
      try { await fetchLocal('http://127.0.0.1:5216/', {signal: AbortSignal.timeout(1000)}); } catch { stopped = true; }
      assert.ok(stopped, 'task server must stop before restart');
    }
  });
}
report.finishedAt = new Date().toISOString();
report.gitStatusAfter = git('status', '--porcelain');
report.result = report.checks.every(row => row.result === 'pass') ? '검사 범위 통과·운영 미확인' : '검사 실패 포함';
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {encoding: 'utf8', flag: 'wx'});
console.log(JSON.stringify({commit: report.commit, output, passed: report.checks.filter(row => row.result === 'pass').length, failed: report.checks.filter(row => row.result === 'fail').length, productionVerified: false}));
process.exitCode = report.checks.some(row => row.result === 'fail') ? 1 : 0;
