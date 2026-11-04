// 학생 추가: 일반 권한의 로컬 관측. 서버·인증·방화벽·이벤트 설정을 변경하지 않는다.
import os from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile, rename, unlink, realpath, lstat} from 'node:fs/promises';
import {dirname, resolve, isAbsolute, relative} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const run = promisify(execFile);
const psScript = `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
function Read-Metric($Source, $Read) {
  try { $value = & $Read; $value.status='ok'; $value.source=$Source; $value.checkedAt=[DateTime]::UtcNow.ToString('o'); return $value }
  catch { return @{status='unverifiable';source=$Source;checkedAt=[DateTime]::UtcNow.ToString('o')} }
}
function Read-Events($Log) {
  $events=@()
  try { $events=@(Get-WinEvent -FilterHashtable @{LogName=$Log;Level=2,3;StartTime=(Get-Date).AddHours(-24)} -MaxEvents 1001 -ErrorAction Stop) }
  catch { if ($_.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*') { throw } }
  return @{warning=@($events | Where-Object Level -eq 3).Count;error=@($events | Where-Object Level -eq 2).Count;capped=($events.Count -ge 1001);windowHours=24}
}
$result=@{}
$result.disk=Read-Metric 'Get-CimInstance Win32_LogicalDisk' {
  $drive=$env:SystemDrive
  if ($drive -notmatch '^[A-Za-z]:$') { throw 'system drive unavailable' }
  $disk=Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$drive'" -ErrorAction Stop
  if (!$disk -or !$disk.Size -or $null -eq $disk.FreeSpace) { throw 'disk unavailable' }
  @{totalGiB=[double]$disk.Size/1GB;freeGiB=[double]$disk.FreeSpace/1GB}
}
$result.network=Read-Metric 'Get-NetAdapter' { @{upAdapters=@(Get-NetAdapter -ErrorAction Stop | Where-Object Status -eq 'Up').Count} }
$result.firewall=Read-Metric 'Get-NetFirewallProfile' {
  $profiles=@(Get-NetFirewallProfile -ErrorAction Stop)
  $enabled=@()
  foreach($name in @('Domain','Private','Public')) {
    $profile=@($profiles | Where-Object Name -eq $name)
    if ($profile.Count -ne 1 -or [int]$profile[0].Enabled -notin @(0,1)) { throw 'profile unavailable' }
    $enabled+=([int]$profile[0].Enabled -eq 1)
  }
  @{enabled=$enabled}
}
$result.systemEvents=Read-Metric 'Get-WinEvent System' { Read-Events 'System' }
$result.applicationEvents=Read-Metric 'Get-WinEvent Application' { Read-Events 'Application' }
$result | ConvertTo-Json -Depth 6 -Compress
`;

function cpuTimes() {
  return os.cpus().reduce((sum, cpu) => {
    sum.idle += cpu.times.idle;
    sum.total += Object.values(cpu.times).reduce((a, b) => a + b, 0);
    return sum;
  }, {idle: 0, total: 0});
}
export async function collectPcSnapshot() {
  const before = cpuTimes(), start = performance.now();
  await delay(1000);
  const after = cpuTimes(), intervalMs = performance.now() - start;
  const measured = new Date().toISOString();
  const total = after.total - before.total;
  const metrics = {
    cpu: {status: total > 0 ? 'ok' : 'unverifiable', source: 'node:os.cpus delta', checkedAt: measured,
      value: total > 0 ? Math.min(100, Math.max(0, 100 * (1 - (after.idle - before.idle) / total))) : null, intervalMs},
    memory: {status: 'ok', source: 'node:os.totalmem/freemem', checkedAt: measured,
      totalGiB: os.totalmem() / 2 ** 30, freeGiB: os.freemem() / 2 ** 30},
  };
  if (process.platform === 'win32') {
    try {
      const powershell = resolve(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
      const {stdout} = await run(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(psScript, 'utf16le').toString('base64')],
        {timeout: 20000, maxBuffer: 128 * 1024, windowsHide: true});
      const data = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
      for (const key of ['disk', 'network', 'firewall', 'systemEvents', 'applicationEvents']) metrics[key] = data[key];
    } catch {
      // 오류 원문에는 기기 정보가 섞일 수 있으므로 고정 상태만 남긴다.
    }
  }
  return {schema: 'keshev.pc-observation.v1', source: 'local-readonly', sampleId: randomUUID(), checkedAt: new Date().toISOString(), metrics};
}

async function main() {
  const args = process.argv.slice(2);
  let output, watch = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--watch' && !watch) watch = true;
    else if (args[i] === '--output' && !output && args[i + 1]) output = args[++i];
    else throw Error('인자 확인: node tools/student-pc-snapshot.mjs [--watch] --output <프로젝트 밖 JSON 절대 경로>');
  }
  if (!output || !isAbsolute(output) || !output.endsWith('.json')) throw Error('프로젝트 밖의 JSON 절대 경로가 필요합니다.');
  const project = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  await mkdir(dirname(output), {recursive: true});
  output = resolve(await realpath(dirname(output)), output.split(/[\\/]/).pop());
  const rel = relative(project, output);
  if (!(rel.startsWith('..\\') || rel.startsWith('../') || isAbsolute(rel))) throw Error('관측 파일은 프로젝트 밖에 저장하세요.');
  try { await lstat(output); throw Error('기존 파일을 보존합니다. 새 출력 파일을 지정하세요.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temporary = output + '.' + randomUUID() + '.tmp';
  let sampleId;
  do {
    const snapshot = await collectPcSnapshot();
    if (sampleId) {
      // 이번 실행이 직전에 쓴 파일 이외에는 덮어쓰지 않는다.
      const stat = await lstat(output);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 128 * 1024 || JSON.parse(await readFile(output, 'utf8')).sampleId !== sampleId) {
        throw Error('출력 파일이 바뀌었습니다. 덮어쓰지 않고 중단합니다.');
      }
    }
    await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n', {encoding: 'utf8', flag: 'wx'});
    if (sampleId) await rename(temporary, output);
    else {
      // 처음에는 배타적으로 생성해 기존 자료를 보존한다.
      try { await writeFile(output, await readFile(temporary), {flag: 'wx'}); } finally { await unlink(temporary); }
    }
    sampleId = snapshot.sampleId;
    console.log(`케셰브 로컬 관측 저장 · ${snapshot.checkedAt} · 읽기 전용 · 외부 전송 없음`);
    if (watch) await delay(15000);
  } while (watch);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { console.error('관측 저장 실패: 새 출력 경로·일반 권한·실행 인자를 확인하세요. 기존 파일은 삭제하지 않습니다.'); process.exitCode = 1; });
}
