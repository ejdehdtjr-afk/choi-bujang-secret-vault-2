# BYTE BACK 방어전 시작 틀 R5

## 12단계: 탈환 작전실

첫 화면의 **탈환 작전실** 링크(`/operations.html`)는 서버의 `GET /api/checks`
응답을 표시합니다. 점검 항목 수와 결과 수는 같은 응답의 `rows`에서 집계하며,
각 줄에 기대 결과, 실제 HTTP 결과, 요청 ID와 확인 시각을 표시합니다.
한 줄은 읽기 요청 한 건입니다. 화면의 색이나 문구 자체를 방어 증거로 쓰지
않습니다. 표의 가상 판정·탐지 사례는 `/api/checks?case=...`가 고정 입력으로
학생 함수를 실행한 결과이며 운영 엔진의 실제 집행 결과는 아닙니다.
메모 제목·본문, 토큰, 기기 키는 작전실 응답과 표에 담지 않습니다.

| 출처 | 담당 범위 | 현재 확인 범위 |
|---|---|---|
| 학생이 만든 것 | 판정기 `src/decider.mjs`, 탐지 규칙 `src/detect.mjs`, 설치형 접속 화면 `public/`, 자료실 `api/`, 점검 코드 `src/attack-check.mjs` | 로컬 가상 입력, 배포의 읽기 요청 응답 |
| 제공 엔진 | **ALEPH SDP 엔진** | 기기 승인·요청 서명 검증·회수 집행 계약이 이 저장소와 연결되지 않아 미실행 |

작전실은 판정기 규칙 ID, 고정 가상 탐지 사건의 결과, 회수 연결 상태와 시험
정책 사본 버전을 별도로 표시합니다. 정책 버전은 서버에서 사본과 현재 시험
정책의 **메타데이터만** 대조한 값입니다. 원본 커밋의 안전성 재검증과 운영 정책
복구가 끝났다는 뜻이 아닙니다. 메모 사본 복구도 이 화면에서는 실행하지 않습니다.
41종 공격 전체는 심판이 보내며 이 저장소에서는 실행하지 않았습니다.

재현 순서(검사할 커밋을 먼저 배포):

1. 새 저장소 사본에서 `npm install`을 실행합니다. Node.js 22 이상이 필요합니다.
2. `npm test`, `npm run decider:test`, `npm run detect:test`, `npm run build -- --local`로 학생 코드와 정적 자료를 확인합니다.
3. Vercel의 환경변수 이름 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY`를 확인합니다. 값은 Vercel 비밀 입력란에서만 관리합니다. 배포 후 `/aleph.json`의 저장소·커밋·단계가 검사할 커밋과 일치하는지 확인합니다.
4. `/operations.html`을 열어 새 관측을 실행하거나 `npm run checks:table`로 동일한 서버 기록을 표로 출력합니다. 로그인 없는 금지 요청이 401/403으로 거부되는지 보고, 첫 화면·manifest 같은 정상 읽기 요청이 200인지 대조합니다. 로그인·승인된 기기의 자기 자료 요청은 실제 승인 계약이 연결될 때까지 **미실행**입니다.
5. 커밋 후 `bundle-notes.json`에 실제 결과와 제한을 적고 `npm run bundle`을 실행합니다. `artifacts/submission.json`은 제출용 산출물이며 Git에 넣지 않습니다. 쓰기 요청(복원 POST, 수정 PUT)은 묶음에서 보내지 않고 `not_run`으로 둡니다.

로컬 실행을 멈출 때는 실행 중인 개발 서버를 `Ctrl+C`로 중지합니다. 이
프로젝트에는 상시 실행하는 별도 접속 프로그램이 없습니다. 되돌리거나 복구할
때는 먼저 `git status`·`git diff`로 보존할 변경을 확인하고, 검사한 정상 커밋을
별도 checkout에서 재배포합니다. 시험 정책은 `node scripts/restore-test-policy.mjs`로
변경 범위를 확인한 뒤 표시된 해시로만 복원합니다. 메모 한 건은 10단계의
`POST /api/restore/:noteId`에서 로그인·기기 승인·사본 소유자·해시 검증을 거쳐
복원하며, 감사 기록과 다른 메모를 유지합니다. 현재 기기 승인 엔진 연결이 없어
실제 복원 HTTP 요청과 복원 뒤 총공세 재시험은 미실행입니다.

## 11단계: 설치형 접속 화면과 기기 승인 연결 대기

`public/manifest.webmanifest`와 아이콘을 추가해 기존 자료실 화면을 홈 화면에
설치할 수 있게 준비했습니다. `public/sw.js`는 오프라인 안내 화면과 아이콘만
캐시하며 로그인·메모 API 응답은 캐시하지 않습니다. 오프라인에서는 자료를
표시하거나 수정할 수 없습니다. 브라우저의 Supabase Auth 세션은 메모리에만
유지하고 기존 지속 저장 항목은 제거합니다. 새로고침 뒤에는 다시 로그인해야 합니다.

로그인 후 화면은 Vercel의 `GET /api/device/status`에 서버의 기기 승인 상태를
묻습니다. 승인 확인 응답이 없으면 메모 목록·편집기를 표시하지 않습니다.
`POST /api/device/request`는 승인 요청 버튼의 서버 경로입니다. **현재 두 경로는
제공 엔진의 기기 승인 계약과 연결되지 않았습니다.** 상태 조회는 미승인을
반환하고 요청은 `DEVICE_APPROVAL_NOT_CONNECTED`로 거부합니다. 설치 표시,
브라우저 헤더, 로그인 토큰, 버튼 클릭을 기기 승인으로 취급하지 않습니다.
메모·공지·복구 API도 로그인 검증 후 서버의 기기 승인 확인이 없으면 403
`DEVICE_NOT_APPROVED`로 DB 접근 전에 거부합니다. 현재 서버가 받을 수 있는
검증된 승인 응답이 없으므로 **로그인한 기존 사용자도 자료를 열 수 없습니다**.
이는 실패를 허용으로 바꾸지 않기 위한 임시 상태이며 완료된 승인 흐름이 아닙니다.
승인된 기기의 정상 사용과 보호 요청의 서명·경로·본문 변조 방어는 아직 확인하거나
완료했다고 말할 수 없습니다. 엔진의 승인 상태·요청·서명 검증 계약을 확인한 뒤
서버 연동과 정상/거부 HTTP 시험이 필요합니다. 실제 배포의 단계와 커밋은
`/aleph.json`에서 다시 확인합니다.

로컬 확인은 `node --test test/device-approval.test.mjs`와
`npm run build -- --local`입니다. 승인 전 화면과 오프라인 안내는 브라우저에서
확인할 수 있지만, 승인 완료 경로와 엔진의 기기 서명 검증은 미실행입니다.

## 10단계: 비공개 사본에서 한 건 복원

정책은 `backups/safe-policy.json`에 기록한 9단계 커밋과 Git 객체를 다시 읽어
검증합니다. `node scripts/restore-test-policy.mjs`는 운영 정책을 바꾸지 않고
`policy/test-policy.json`과 사본의 정책 버전·판정기 해시·허용 경로 차이만 보여 줍니다.
사본이 없거나 해시·커밋이 맞지 않으면 중단합니다. 시험 정책 변경이 필요할 때만
미리 본 해시를 `--apply --confirm <표시된 해시>`에 넣어 적용합니다. 시험 정책의
다른 서비스 항목은 유지하고 `policy/restore-audit.jsonl`에 복구 사건을 추가합니다.
이 정책 사본은 로컬 검사 기준이며 8~9단계의 심판 통과가 확인된 운영 사본이라는
뜻은 아닙니다. 운영 판정기 코드나 엔진 정책을 이 명령으로 되돌리지 않습니다.

자료는 먼저 `docs/stage-10-private-backup.sql`을 Supabase SQL Editor에서
**시험 침해 전에** 실행해야 합니다. 이때 기존 메모를 `vault_private.note_backups`에
한 번만 고정하고 이후 생성되는 메모는 INSERT 시 자동으로 사본을 남깁니다.
사본 스키마는 공개 Data API에서 읽을 수 없고, anon·authenticated에 권한을
주지 않습니다. 사본의 내용은 Git·화면·응답에 넣지 않습니다. 이미 변조된 뒤
실행한 SQL로는 안전한 이전 버전을 재구성할 수 없습니다.
2026-10-13 SQL Editor 적용 직후 사본 3건·현재 메모 4건, 소유자가 있는
메모의 사본 누락 0건·사본 해시 불일치 0건·INSERT 트리거 1개를 확인했습니다.
복구 RPC 직접 권한은 anon·authenticated `false`, service_role `true`였습니다.
`docs/stage-10-restore-dry-run.sql`의 가상 한 건에 대해 수정 후 복원·삭제 후
복원을 트랜잭션 안에서 확인하고 롤백했습니다. 롤백 후 사본 3건·감사 0건으로
돌아왔습니다. 이는 B의 실제 자료가 복원됐다는 뜻은 아닙니다.

복구 서비스는 `POST /api/restore/:noteId` (`notes`의 한 건 복구)입니다.
`aleph.config.json`의 `restoreRoute`에 이 경로를 적었습니다. 서버가 로그인 토큰을
검증한 사용자 ID와 비공개 사본의 소유자를 대조합니다. 요청 본문의 소유자·내용은
받지 않으며, 서버 전용 Supabase RPC가 해당 ID 한 건만 원자적으로 삽입 또는
갱신합니다. 결과의 ID·소유자·제목과 내용의 SHA-256을 확인한 뒤 비공개 감사표에
한 줄을 추가합니다. 응답에는 본문 없이 ID·소유자 ID·해시만 나옵니다. 사본이
없거나 검증에 실패하면 다른 메모를 건드리지 않고 거부합니다. 기존 감사 기록은
삭제하지 않습니다. 배포 전 SQL을 적용하지 않았다면 복구는 성공하지 않습니다.

복구 후 재시험 순서: (1) `npm run build -- --local`로 정적 메모 0건을 확인,
(2) `node --test test/notes.test.mjs test/resource-scope.test.mjs test/restore-note.test.mjs`
로 자기 CRUD·타인 메모와 공지 거부·복구 범위를 확인,
(3) `npm run decider:test`와 `npm run fixture:7`로 등록 기기·재인증·경로 거부를 확인,
(4) `npm run detect:test`로 정상 조회와 폭주 조회를 대조,
(5) 배포에서 비로그인 목록·복구 POST 거부를 확인,
(6) 시험 계정 B의 *가상 메모 한 건*을 복구한 경우에만 ID·소유자·해시와 복구 전후
내용을 사본과 대조합니다. B 실제 복구와 A/B 로그인 HTTP 재시험, 심판의 1~9단계
공격 재전송은 현재 미실행이며 결과를 성공으로 표시하지 않습니다.

## 9단계: 가상 도플갱어 조회 탐지와 회수 제안

`src/detect.mjs`는 반 엔진이 검증해 전달한 사건의 시각, GET 메서드와 가명
`identity.sub`만 읽습니다. 같은 가명 사용자의 조회가 어느 10분 구간에서든
120건을 넘으면 별도 결과 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject }`를
돌려줍니다. 정확히 120건, 서로 다른 사용자의 조회 합계, 10분 밖으로 흩어진
조회는 `observe`입니다. 기존 `decide(request)`의 허용·거부 응답은 바꾸지 않습니다.

확인: `npm run detect:test`로 6가지 가상 사건을 연습합니다. 기존 기기·추가 인증·
구역 규칙은 `npm run decider:test`와 `npm run fixture:7`로 다시 확인합니다.
제공된 `docs/DETECT_EVENTS.md` 계약에는 네트워크와 기기 ID가 없으므로 네트워크
복합 신호나 기기 한 개를 확인할 수 없습니다. `subject`는 가명 사용자이며 기기 ID가
아닙니다. 탐지기는 회수 제안만 반환하고 실제 권한·세션 회수나 경과 시간 측정은
수행하지 않습니다. 운영 반 엔진의 검증 사건 전달·기기 회수 연결과 심판 판정은
미검증입니다. 메모 본문·토큰·실명은 탐지 결과에 포함하지 않습니다.

## 8단계: 자료 구역 분리

자기 목록은 명시적인 `GET /api/my/notes`를 사용하며 `vault_notes`의 검증된 사용자
소유자 필터를 유지합니다. 모호한 `GET /api/notes`는 판정기 허용 경로에서 제외하고
서버도 403으로 거부합니다. 메모 생성 POST만 기존 경로에서 유지합니다.
개별 메모의 정상 읽기는 엔진 기본 경로 `GET /notes/:id`와 실제 API의
`GET /api/notes/:id`, `GET /api/my/notes/:id`에서 허용합니다. 각 API는 ID와
검증된 사용자의 소유자 조건을 함께 대조합니다. 수정·삭제 API도 같은 소유자 조건을 유지합니다.
자원 ID `announcements`는 `/api/announcements`와 별도 `vault_announcements`를 사용합니다.
API 응답의 X-Resource-ID로 구역을 식별하며 메뉴와 기존 메모는 바꾸지 않았습니다.
공지 쓰기는 검증된 student 사용자와 서버 전용 `vault_instructors` 등록부를 대조합니다.
학생이 보낸 role과 owner_id는 권한 근거가 아닙니다. 등록부 확인 실패도 403입니다.
메모 목록은 자기 행만 조회하고 타인 항목은 404, 쿼리로 구역·기능을 고르면 400입니다.
목록과 한 건 조회는 DB에 소유자 조건을 건 뒤에도 반환 행의 owner_id를 서버에서
다시 대조하므로, 응답에 다른 소유자 행이 섞여도 화면으로 전달하지 않습니다.

판정기의 구역 규칙은 엔진의 subjectId·deviceId와 service·method·path·route를
검사합니다. `allowedRoutes`는 서비스·메서드·정확한 경로·구역을 각각 기록합니다.
자기 목록과 메모 한 건 읽기, 공지 목록만 허용하며, 전체 메모 목록과 기능 경로,
쿼리 선택, 알 수 없는 경로는 deny/route_not_allowed입니다. 소유권·강사 권한
증거가 없는 쓰기는 deny/write_not_allowed입니다.
기기 규칙과 추가 확인 규칙을 유지합니다.
현재 엔진 계약은 가명 subjectId와 DB 소유자의 대응 및 강사 역할을 제공하지 않습니다.
따라서 판정기만으로 A/B 소유권을 확인했다고 주장하지 않습니다. 최종 API가 소유자를
검사하며 엔진의 공지 쓰기는 기본 거부합니다. 메모 한 건을 판정기가 허용해도
API는 저장된 owner_id와 검증된 사용자를 다시 대조합니다.

DB 준비: docs/stage-8-resources.sql을 Supabase SQL Editor에서 실행합니다.
기존 메모는 수정하지 않습니다. 강사 등록은 운영자가 DB에서 부여해야 하며 기본은 빈 등록부입니다.
이 저장점에서 SQL의 실제 DB 적용과 실제 강사 계정 쓰기 시험은 미실행입니다.
검사: `node --test test/resource-scope.test.mjs test/notes.test.mjs` 및
`npm run decider:test`. 모의 DB 시험에서 A의 CRUD, 타인 항목 거부, role 위조 거부,
등록 강사 허용과 등록부 장애 시 거부를 확인합니다. 이는 심판 통과 증거가 아닙니다.

## 7단계: 평소와 다른 접속 다시 확인하기

판정기는 엔진이 검증해 전달한 `signals`와 `recentEvents`만 읽습니다. 출처가
`judge_fixture`인 가상 사건에서 낯선 네트워크, 오전 6시 전 또는 밤 10시 이후의
접속, 최근 위험 사건 20건 이상이 모두 겹칠 때만 `step_up_required` 규칙으로
추가 확인을 요청합니다. 지역 하나만으로 차단하지 않으며 브라우저 헤더, 누락된 값,
출처가 불명확한 값을 임의의 정상 지역·시각·네트워크로 채우지 않습니다.

계약에는 엔진이 확인한 `stepUp.verified`와 `stepUp.authAgeSeconds`가 있습니다.
복합 이상 사건은 확인 전 `step_up`으로 자료를 내주지 않고, 같은 사건이 엔진에서
확인된 0~900초의 새 로그인과 함께 다시 들어오면 `allow`합니다. 토큰 원문은 읽거나
기록하지 않습니다. 실제 자료 차단과 재로그인 실측은 제공 엔진이 연결된 환경에서만
확인할 수 있고, 로컬 명령은 가상 사건 규칙만 검사합니다.

확인 명령은 `npm run decider:test`와 `npm run fixture:7`입니다. 정상 사건은
`allow`, 복합 이상 사건은 `step_up`, 새 로그인이 확인된 같은 사건은 `allow`여야 합니다.

## 6단계: 등록한 기기만 자료실에 들어오기

판정 요청의 `subjectId`는 판정 엔진이 만든 가명 사용자 식별자이고,
`deviceRegistered`는 같은 요청 최상위에 들어오는 기기 등록 여부입니다.
`src/decider.mjs`의 `device_registered` 규칙은 `deviceRegistered === true`인
요청만 `allow`하며, 값이 없거나 `false`이면 `deny`와
`device_not_registered`로 거부합니다. 인증서·CA·서명 키는 만들거나 저장하지 않습니다.

확인 명령은 `npm run decider:test`입니다. 출력에서 `등록 기기의 정상 요청`과
`미등록 기기의 가상 요청`이 모두 `통과`여야 합니다. 이 명령은 로컬 가상 요청을
검사하며 실제 심판 공격을 대신하지 않습니다. 별도의 접속 프로그램 설치는 필요 없습니다.

## XDR-02 긴 요청 주소 경보 보완

평소보다 긴 요청 주소 경보도 애매한 웹 입력으로 알림을 남깁니다.
뚜렷한 주입 표식이 없다는 이유만으로 정상 기록으로 내리지 않습니다.
`npm run xdr:run -- web-injection` 재실행 결과는 block 8, alert 9, record 9이며
정상 경보는 모두 record입니다. XDR-01의 판단 코드는 변경하지 않았습니다.

## XDR 격리 실행 호환성

두 `decide.mjs`는 상대경로 모듈 및 JSON import 없이 독립 실행됩니다.
Jev 설정이 없거나 process/network가 제공되지 않는 환경에서도 애매한 경보는 alert로 반환합니다.
`node --test test/xdr-isolated.test.mjs`는 파일 하나만 가져오는 실행과 Node 전역 객체가 없는
격리 실행을 검사합니다. 분류 기준은 유지합니다. 이 검사 환경이 실제 심판 구현과 같다는
확인은 없으므로 심판 통과 여부는 재제출 결과로 확인해야 합니다.

## XDR 입력 호환성 보완

두 decide 모듈은 원본 Wazuh 경보와 요약 경보, 숫자·문자열 수준을 정규화합니다.
MITRE 태그 유무만으로 공격 근거를 버리지 않고 반복 횟수와 공격 신호를 함께 확인합니다.
많은 인증 실패 뒤 성공해도 공격 근거를 지우지 않으며, 단발성 의심은 차단하지 않습니다.
재실행: `npm run xdr:run -- brute-force` 및 `npm run xdr:run -- web-injection`.
학습 결과는 각각 block/alert/record 10/9/9, 8/8/10입니다.
입력 변형 검사는 `node --test test/xdr-input-variants.test.mjs`로 실행합니다.
이는 로컬 학습 검사이며 비공개 심판 입력의 통과 증명은 아닙니다. 앞선 만료 시각 변경이
CLEAR_NOT_BLOCKED의 원인이라는 주장은 확인되지 않았습니다. 현재 ZTNA 규칙 파일은
후보 출력이며 기본 판정기에 의한 실제 차단이나 정상 접근 허용을 검증한 결과가 아닙니다.

## 보너스 XDR-02: 웹 주입 탐지

`xdr/web-injection`은 MITRE ATT&CK T1190을 근거로 반복된 SQL·스크립트·경로 이탈·명령 구분자
주입을 분류합니다. 명확한 반복 시도만 보조 ZTNA 거부 규칙으로 만들고, 애매한 입력은 Jev가
응답하지 않으면 알림으로 남깁니다. 정상 웹 요청은 기록만 하며 기존 ZTNA 기본 규칙은 바꾸지 않습니다.

## 보너스 XDR-03: 알려진 취약점 악용 탐지

`xdr/known-cve/read-alerts.mjs`는 학습용 Wazuh 경보에서 시각·출발 주소·계정·수준·설명만
읽고 비밀값처럼 보이는 문자열을 가립니다. `patterns.json`의 근거는
[CVE-2021-44228](https://nvd.nist.gov/vuln/detail/CVE-2021-44228)과
[MITRE ATT&CK T1190](https://attack.mitre.org/techniques/T1190/)입니다.
`decide.mjs`는 다른 파일·네트워크 없이 경보마다 판단만 돌려줍니다. 완전한 원격 조회 형태는
차단 후보, 불완전한 취약점 점검 흔적은 알림, 평범한 요청은 기록으로 분류합니다.
`respond.mjs`가 차단 후보에 한해서 만료 시각·근거 경보 번호가 있는 보조 거부 규칙을 만들고,
차단·알림 후보를 `xdr/alerts.log`에 한 줄씩 쌓습니다. 기존 `src/decider.mjs` 규칙은 그대로입니다.

재실행: `npm run xdr:run -- known-cve`.
이 명령은 `xdr/known-cve/result.json`을 갱신합니다. 현재 학습 경보 24건의 로컬 결과는
block 8, alert 8, record 8이며 정상 이벤트 차단은 0건입니다.
`node --test test/xdr-known-cve.test.mjs`로 단독 판단·안전한 읽기·거부 규칙 연결을 확인합니다.
이 결과는 학습용 후보 출력이며 운영 ZTNA 적용이나 심판의 비공개 경보 판정은 아닙니다.

## 보너스 XDR-04: 지속성 프로그램 탐지

`xdr/persistence/read-alerts.mjs`는 학습용 Wazuh 경보에서 시각·출발 주소·계정·수준·설명만
읽고 비밀값처럼 보이는 문자열을 가립니다. 패턴 근거는
[MITRE ATT&CK T1543](https://attack.mitre.org/techniques/T1543/)의 서비스 생성·변경,
[T1053](https://attack.mitre.org/techniques/T1053/)의 예약 작업,
[T1547.001](https://attack.mitre.org/techniques/T1547/001/)의 시작 폴더 자동 실행입니다.
`decide.mjs`는 외부 파일·네트워크 없이 판단만 하고, `respond.mjs`는 뚜렷한 차단 후보에
한해서 출발 주소·만료 시각·근거 경보 번호가 붙은 보조 거부 규칙을 만듭니다.
애매한 경보는 `xdr/alerts.log`에 알림으로 남기고 정상 이벤트는 기록만 합니다.
기존 `src/decider.mjs`의 규칙은 바꾸지 않았습니다.

재실행: `npm run xdr:run -- persistence`.
이 명령은 `xdr/persistence/result.json`을 갱신합니다. 현재 학습 경보 24건의 로컬 결과는
block 8, alert 8, record 8이며 정상 이벤트 차단은 0건입니다.
`node --test test/xdr-persistence.test.mjs`는 판단 파일의 단독 실행, 안전한 읽기,
만료되는 차단 후보와 알림 기록을 확인합니다. 이 파일은 운영 기기의 실제 격리 상태나
심판의 비공개 경보 결과를 뜻하지 않습니다.

## 보너스 XDR-05: 권한 가로채기 탐지

`xdr/privilege/read-alerts.mjs`는 학습용 Wazuh 경보에서 시각·출발 주소·계정·수준·설명만
읽고 비밀값처럼 보이는 문자열을 가립니다. `patterns.json`은
[MITRE ATT&CK T1078](https://attack.mitre.org/techniques/T1078/)의 정상 계정 악용과
[T1068](https://attack.mitre.org/techniques/T1068/)의 취약점 기반 권한 상승을 참고합니다.
경보에 취약점 악용 수단이 없으면 T1068 발생을 확정하지 않습니다.
`decide.mjs`는 관리자 그룹 추가, 낯선 관리자 명령, 갑자기 높아진 세션을 독립적으로 판단합니다.
`respond.mjs`는 명확한 경보에만 해당 계정·출발 주소 범위의 만료되는 보조 거부 규칙을 만들고,
애매한 경보는 `xdr/alerts.log`에 한 줄씩 남깁니다. 기존 판정기 규칙은 유지합니다.

재실행: `npm run xdr:run -- privilege`.
이 명령은 `xdr/privilege/result.json`을 갱신합니다. 현재 학습 경보 26건의 로컬 결과는
block 9, alert 8, record 9이며 정상 이벤트 차단은 0건입니다.
`node --test test/xdr-privilege.test.mjs`로 단독 판단·안전한 읽기·대상 범위를 확인합니다.
보조 규칙 파일은 실제 세션 회수나 심판의 비공개 경보 판정 결과가 아닙니다.

## 보너스 XDR-06: 자료 반출 탐지

`xdr/exfiltration/read-alerts.mjs`는 학습용 Wazuh 경보의 시각·출발 주소·계정·수준·설명만
읽고 비밀값처럼 보이는 문자열을 가립니다. 패턴 근거는
[MITRE ATT&CK T1041](https://attack.mitre.org/techniques/T1041/)의 명령 통로를 통한 반출과
[T1048](https://attack.mitre.org/techniques/T1048/)의 다른 프로토콜을 통한 반출입니다.
`decide.mjs`는 외부 파일·네트워크 없이 실제 전송량, 목적지, 반복·낯선 통로의 복합 신호를
판단합니다. `respond.mjs`는 명확한 경보의 목적지에만 만료 시각·근거 경보 번호를 붙인
보조 거부 규칙을 만들고, 애매한 경보는 `xdr/alerts.log`에 알림으로 남깁니다.
정상 작은 전송은 기록만 하며 기존 `src/decider.mjs` 규칙은 유지합니다.

재실행: `npm run xdr:run -- exfiltration`.
이 명령은 `xdr/exfiltration/result.json`을 갱신합니다. 현재 학습 경보 30건의 로컬 결과는
block 10, alert 10, record 10이며 정상 이벤트 차단은 0건입니다.
`node --test test/xdr-exfiltration.test.mjs`로 단독 판단·안전한 읽기·목적지 범위를 확인합니다.
보조 규칙 파일은 실제 네트워크 차단이나 심판의 비공개 경보 결과가 아닙니다.

## 보너스 XDR-01: 무차별 로그인 탐지

`xdr/brute-force/read-alerts.mjs`는 Wazuh 모양 학습 경보에서 시각·출발 주소·계정·규칙 수준·설명만 추립니다.
`patterns.json`은 MITRE ATT&CK T1110의 반복 실패와 다계정 대입 신호만 기록합니다.
명확한 T1110 신호만 `block`으로 만들고, 애매한 실패는 Jev 응답이 없으면 `alert`로 남기며 정상 이벤트는 `record`로 둡니다.

`npm run xdr:run -- brute-force`는 `xdr/brute-force/result.json`을 만들고, block 후보만
만료 시각과 근거 경보 번호가 붙은 `ztna-deny-rules.json`에 씁니다. 기존 ZTNA 기본 규칙은 바꾸지 않습니다.
알림 후보는 `xdr/alerts.log`에 한 줄씩 남습니다. 이 파일들은 수업용 가상 경보 결과이며 실제 차단 또는 운영 경보가 아닙니다.

## 5단계: 자료 요청을 서버 한곳으로 모으기

브라우저의 메모 읽기·추가·수정·삭제는 `/api/notes`만 호출하고, 서버 함수만
`public.vault_notes`에 접근합니다. 브라우저 정적 파일에는 Supabase 공개 키를
넣지 않고 `/api/auth-config`에서 로그인 SDK 설정을 받은 뒤 기존 Auth 흐름을 시작합니다.
이 설정 경로는 로그인용 공개 설정만 돌려주며 메모 자료를 읽거나 고치지 않습니다.

`aleph.config.json`의 `originalApiUrl`은 쿼리 없는 원본 자료 HTTPS 경로입니다.
`docs/stage-5-direct-db-revocation.sql`을 Supabase SQL Editor에서 검토·실행하면
PUBLIC·anon·authenticated의 직접 테이블 권한이 회수됩니다. 서버 함수는
`SUPABASE_SECRET_KEY`만 사용하므로 로그인·소유자 검사는 유지됩니다. 과거 공개
커밋과 이전 배포의 노출이 사라졌다고 주장하지 않습니다.

정상: A는 로그인 후 자기 메모를 CRUD할 수 있습니다. 거부: 비로그인 API와 원본
자료 API 직접 요청은 401 또는 403이어야 하며, B는 A의 메모를 볼 수 없습니다.
검사 명령: `node --test test/notes.test.mjs test/notes-auth.test.mjs test/auth-config.test.mjs test/r5.test.mjs`.

## 4단계 제작 2: 서버 소유자 검사 (배포 전)

서버는 토큰에서 검증한 사용자 ID를 기준으로 목록·한 건 조회·수정·삭제를 모두
`owner_id`로 제한합니다. URL과 요청 본문의 owner_id는 사용하지 않습니다. POST와
수정 모두 서버가 확인한 ID만 저장하며, 다른 사용자의 UUID를 아는 경우에도 한 건
조회·수정·삭제는 404로 거부합니다. 다음 제작에서 이와 같은 소유자 규칙을 DB RLS에도
적용합니다. `vercel.json`에는 `X-Content-Type-Options: nosniff`를 추가했습니다.

## 3단계 제작 2: 로그인과 조회 토큰 검증

Supabase 공식 SDK로 이메일·비밀번호 로그인과 현재 브라우저 로그아웃을 처리합니다.
브라우저에는 공개 publishable key만 포함하며 서버 키는 환경변수에만 둡니다.
`api/notes.js`는 변경하지 않은 `src/verify-login.mjs`의 검증 결과로 조회를 허용합니다.
무토큰·잘못된 서명·만료·다른 발급자 또는 대상 토큰은 자료 없이 401로 거부합니다.
로그아웃 시 화면 자료와 진행 중 조회 결과를 제거합니다.
`aleph.config.json`에 학생 발급자·audience·JWKS와 현재 GET 경로를 기록했습니다.
추가·수정·삭제는 아직 구현하지 않았으며 소유자 검사도 다음 제작 범위입니다.

검사 명령: `node --test test/notes.test.mjs test/notes-auth.test.mjs test/r5.test.mjs`.
로컬에서 실제 검증 도우미와 임시 서명키로 정상·거부 토큰 경로를 검사했습니다.
실제 A 계정 로그인 성공은 사용자가 배포 화면에서 확인해야 합니다.
정상: A 로그인 후 메모 표시, 로그아웃 후 메모 제거.
거부: 시크릿 창의 `/api/notes`는 401이고 메모 본문이 없어야 합니다.
아래 2단계 기록은 이전 저장점 설명입니다. 3단계 최종 제출 묶음은 제작 3 완료 후 생성합니다.

### 3단계 제작 3: 로그인 메모 CRUD

`GET /api/notes`, `POST /api/notes`, `GET|PUT|DELETE /api/notes/:id`는 모두
서버가 확인한 로그인 토큰을 요구합니다. POST는 요청의 userId·role을 사용하지 않고
검증된 사용자 ID를 `owner_id`에 저장합니다. 브라우저는 서버 전용 키를 받지 않습니다.
목록은 로그인한 사용자의 메모만 보여 줍니다. 항목 GET·PUT·DELETE는 아직 owner_id를
비교하지 않으므로 로그인한 B가 A의 UUID를 알면 접근·수정·삭제할 수 있습니다. 이 의도된
약점은 4단계에서 막아야 하며, 현재는 가상 자료만 사용합니다.

## 2단계 저장점

화면은 `/api/notes`를 통해 Supabase의 `public.vault_notes`를 읽습니다.
Vercel Production 환경변수 `SUPABASE_URL`, `SUPABASE_SECRET_KEY`를 사용하며
키는 브라우저·응답·로그로 전달하지 않습니다. Secret key는 서버 요청의
`apikey` 헤더에만 사용합니다. `owner_id uuid`는 외래키 없이 준비했습니다.
DB는 RLS를 켜고 anon/authenticated의 읽기를 차단하며 service_role에 SELECT를 부여합니다.

`data.json`과 `public/data.json`은 빈 notes 배열만 담습니다. 빌드도 빈 JSON만
출력하며 루트 data.json에 메모가 있으면 실패합니다.
로컬 검사: `node --test test/notes.test.mjs` 및 `npm run build -- --local`.
배포 뒤 `/`에서 카드 네 건, `/data.json`에서 빈 배열, `/api/notes`에서 DB 자료를 확인합니다.
POST `/api/notes`는 405, 환경변수 누락은 503, DB 오류는 일반화된 502가 정상입니다.

아직 `/api/notes`는 인증 없는 공개 API입니다. 누구나 가상 메모를 읽을 수 있으며
사용자별 접근 통제는 3단계 작업입니다. 실제 개인정보는 넣지 않습니다.
이전 공개 Git 커밋과 이전 Vercel 배포는 그대로 남아 있습니다.
이번 변경은 과거 노출이나 과거 비밀값 유출을 해소하지 않습니다.
아래 1단계 설명은 초기 상태의 기록이며 현재 빌드는 위 2단계 동작을 따릅니다.

### 공개 파일 검사와 검증 범위

`git grep -n -E '실습용 가상 .* 기록' HEAD -- data.json public api`로 최신 커밋의
메모 본문 잔존 여부를 검사합니다. 결과가 없어야 합니다. 로컬 빌드 후 같은 범위를
`rg -l '실습용 가상 .* 기록' public api data.json`으로 검사합니다.
실제 키 문자열을 검색 명령이나 로그에 넣지 않습니다. 알려진 키 형식 검사도 병행하되
패턴 검사만으로 모든 비밀값의 부재를 증명하지는 않습니다.
배포 후 `/`, `/data.json`, `/aleph.json`을 비로그인으로 읽고 정적 응답에
메모 본문과 키 형식이 없는지 확인합니다. 현재 프런트엔드는 별도 JS 번들 없이
index.html의 스크립트를 사용합니다. 공개 API 응답은 정적 파일 검사와 구분합니다.
`node --test test/notes.test.mjs`와 로컬 빌드는 통과했고 작업 파일에서 기존 본문은
발견되지 않았습니다. 실제 배포 결과는 `npm run bundle`의 직접 요청 결과에 기록합니다.
Supabase 공개 키를 이용한 직접 DB 요청은 아직 실행하지 않았습니다.
이전 커밋·이전 배포에 대한 삭제 또는 검사 완료를 주장하지 않습니다.

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 저장소의 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽습니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
