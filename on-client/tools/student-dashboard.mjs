// 학생 실행 진입점. 제공 서버는 그대로 실행하며 학생 관측 파일만 별도 생성한다.
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir} from 'node:fs/promises';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
let demo = false, port = process.env.ON_PORT ?? '5189';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--demo' && !demo) demo = true;
  else if (args[i] === '--port' && args[i + 1]) port = args[++i];
  else { console.error('사용법: node tools/student-dashboard.mjs [--demo] [--port 5226]'); process.exit(1); }
}
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
  console.error('1024~65535 사이의 포트를 지정하세요.'); process.exit(1);
}
if (process.platform !== 'win32') {
  console.error('이 학생 실행 도구는 Windows에서만 확인했습니다. 다른 환경은 미지원입니다.'); process.exit(1);
}
const children = new Set();
let stopping = false, collectorStarted = false;
const stop = (exitCode = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = exitCode;
};
process.once('SIGINT', () => stop()); process.once('SIGTERM', () => stop());
const child = (file, extra, env) => {
  const p = spawn(process.execPath, [resolve(app, file), ...extra], {cwd: app, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
  children.add(p);
  p.stderr.on('data', () => {}); // 기기·설정이 섞인 원문 스택을 저장·재출력하지 않는다.
  p.once('error', () => { console.error('실행 실패: Node.js·작업 폴더를 확인하세요.'); stop(1); });
  p.once('exit', code => {
    children.delete(p);
    if (!stopping) { console.error('학생 실행이 종료됐습니다. 포트 충돌·실행 인자를 확인하세요. 기존 프로세스는 종료하지 않습니다.'); stop(code || 1); }
  });
  return p;
};
const server = child('src/server.mjs', demo ? ['--demo'] : [], {...process.env, ON_PORT: port});
let startup = '';
server.stdout.on('data', async bytes => {
  startup += bytes.toString('utf8');
  if (collectorStarted || !startup.includes(`http://127.0.0.1:${port}`)) return;
  collectorStarted = true;
  try {
    const observations = join(process.env.LOCALAPPDATA ?? join(os.homedir(), 'AppData', 'Local'), 'Keshev', 'observations');
    await mkdir(observations, {recursive: true});
    const directory = await mkdtemp(join(observations, 'session-'));
    if (stopping) return;
    const collector = child('tools/student-pc-snapshot.mjs', ['--watch', '--output', join(directory, 'pc-observation.json')], process.env);
    collector.stdout.on('data', data => process.stdout.write(data));
    console.log(`케셰브 대시보드: http://127.0.0.1:${port}/`);
    console.log(`측정 폴더: ${directory}`);
    console.log('브라우저의 측정 폴더 선택에서 위 폴더를 선택하세요. 파일 선택도 사용할 수 있습니다.');
    console.log(`기존 업무 자료: ${demo ? '예제(demo), 실제 연결 아님' : '제공 서버의 실제 연결 상태에 따름'} · PC 측정과 별개`);
    console.log('종료: 이 창에서 Ctrl+C. 서버와 측정 도구만 함께 종료합니다. 설치 프로그램을 만들지 않습니다.');
  } catch { console.error('관측 폴더를 만들지 못했습니다. 사용자 로컬 폴더 접근을 확인하세요.'); stop(1); }
});
const startupTimeout = setTimeout(() => { if (!collectorStarted) { console.error('로컬 서버 시작을 확인하지 못했습니다.'); stop(1); } }, 10000);
startupTimeout.unref();
