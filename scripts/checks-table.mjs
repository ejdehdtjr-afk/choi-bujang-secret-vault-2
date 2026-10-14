import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../aleph.config.json', import.meta.url), 'utf8'));
const url = new URL('/api/checks', config.publicAppUrl);
const response = await fetch(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`작전실 관측 요청 실패: HTTP ${response.status}`);
const data = await response.json();
if (!Array.isArray(data.rows) || !Number.isInteger(data.total)) throw new Error('작전실 응답 형식이 다릅니다.');

const clean = value => String(value ?? '미실행').replaceAll('|', '\\|').replace(/[\r\n]+/gu, ' ');
process.stdout.write(`관측 시각 ${clean(data.checkedAt)} · 배포 커밋 ${clean(data.commit)}\n`);
process.stdout.write('| 단계 | 요청 | 기대 | 실제 | 결과 | 요청 ID | 확인 시각 |\n|---|---|---|---|---|---|---|\n');
for (const row of [...data.rows, ...(data.screens ?? [])]) {
  const request = row.requests?.[0];
  const requestName = request ? `${request.method} ${request.path}` : '미실행';
  process.stdout.write(`| ${clean(row.stage)} | ${clean(requestName)} | ${clean(row.expected)} | ${clean(row.observed)} | ${clean(row.result)} | ${clean(request?.requestId)} | ${clean(request?.checkedAt)} |\n`);
}
process.stdout.write(`관측 집계: 전체 ${data.total}, 막음 ${data.blocked}, 뚫림 ${data.failed}, 미실행 ${data.notRun}\n`);
process.stdout.write('41종 전체 공격 시험은 제공 심판이 수행하며 이 표에 없는 공격의 결과는 미실행입니다.\n');
