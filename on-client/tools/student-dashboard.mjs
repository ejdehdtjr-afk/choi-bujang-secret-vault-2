// 이전 학생 명령의 호환 진입점. 제공 파일을 수정하지 않고 학생 런타임을 호출한다.
import {runStudentDashboard} from '../student/extension.mjs';
runStudentDashboard().catch(() => { console.error('학생 실행 실패: 포트·실행 인자를 확인하세요.'); process.exitCode = 1; });
