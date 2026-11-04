// 이전 학생 명령의 호환 진입점. 실제 로직은 student/extension.mjs에 유지한다.
export {collectPcSnapshot} from '../student/extension.mjs';
import {runPcSnapshotCli} from '../student/extension.mjs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runPcSnapshotCli().catch(() => { console.error('관측 저장 실패: 실행 인자·새 출력 경로를 확인하세요.'); process.exitCode = 1; });
}
