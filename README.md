# BYTE BACK 방어전 시작 틀 R5

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
