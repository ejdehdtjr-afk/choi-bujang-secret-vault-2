# 케셰브 · 완성본 제출 검토 대조표

버전: `final-dashboard-2026.11.04-rc1`. 범위: 관제 대시보드형 / 포장 없이 Windows 로컬 실행.
이 문서는 사용자가 제공한 1~7일차 화면과 「완성본에 반영되는 작업 위치」「결과물을 보는 네 가지 관점」에 현재 원문을 대조한다. 화면의 예시 값·선배의 성과·AI 원문 검토를 실제 관측으로 사용하지 않는다.

## 1. 실행 진입점과 수정 범위

Git 최상위의 `on-client`에서 실행한다. 제공 서버·`public/app.js`·`public/style.css`·`src/`·`vendor/`·`student/engine-adapter.mjs`·인증 설정·`package.json`은 22단계 기준 원문과 같다.

```powershell
Set-Location .\on-client
npm.cmd run check
node student/extension.mjs --dashboard --port 5227
```

실제 화면·기능·수집·실행 구현은 `student/extension.mjs`에 있다. 브라우저에서 `createStudentView()`를 가져오면 기존 8개 표시 함수와 새 학생 대시보드만 만든다. 명시적으로 위 Node 명령을 실행해야 제공 서버와 학생 측정이 시작된다. Node 전용 import는 해당 함수 안에서만 실행한다.

기존 `tools/student-dashboard.mjs`, `tools/student-pc-snapshot.mjs`는 앞선 학생 명령을 깨지 않기 위한 호환 진입점이다. 그 안에 PC 수집·화면·서버 구현을 중복하지 않는다. `tools/student-dashboard-check.mjs`와 기존 `student-reproduce-check.mjs`는 검증용이며 실행 필수 파일이 아니다.

선택 사항인 `student/appearance.json`은 현재 제공 시작 틀에서 읽지 않으므로 임의로 지원을 가장하지 않았다. 화면은 허용된 학생 파일에서 기존 CSS 카드·표·버튼을 재사용하고 제공 화면을 지우지 않는다. 설치 프로그램·포장·업데이트 도구는 실행하지 않았다.

## 2. 캡처 요구사항과 구현

| 일차·요구 | 실제 파일·함수 | 구현 및 확인 범위 |
|---|---|---|
| 1 기존 앱 재실행·핵심 기능3개 | `createStudentView` / 실행 설명서 | 이전 코드·폴더·기록 보존. PC 실측 / 연결·방화벽 읽기 / Windows 로그 집계를 핵심3개로 선정 |
| 2 CPU·메모리·디스크 실측 | `collectPcSnapshot`, `normalizePcSnapshot`, `createLocalDashboard` | OS에서 읽은 값·단위·출처·측정 시각. CPU 약1초 표본, 메모리 GiB, 시스템 디스크 여유 GiB. 최근12개 실제 관측 추이 |
| 2 제공 기능 먼저 확인 | 제공 `server.mjs`의 정적 경로·diagnostics 검사 | 현재 시작 틀에는 PC 센서 계약이 없어 학생 기능을 추가. 제공 계정·기기·세션과 센서 값을 혼동하지 않음 |
| 3 네트워크 구성·연결 | 같은 학생 함수의 network 필드 | 이더넷 계열(가상 포함)·Wi-Fi·기타 수, 공용/개인/도메인 프로필, IPv4·IPv6 연결 상태. 원래 코드와 한국어 병기. 알 수 없는 값은 확인 불가 |
| 3 방화벽 설정 읽기 | `Get-NetFirewallProfile`의 제한된 필드 | 도메인·개인·공용 켜짐/꺼짐만 표시. 설정·규칙을 변경하지 않음 |
| 3 Windows 기록 | `Get-WinEvent` System/Application | 최근24시간 경고/오류 건수. 최대1,001건 제한은 일부 집계라고 표시. 침해·공격 판정이 아니라고 명시 |
| 3 SDP 연결 구분 | 기존 `renderIdentity`·`renderStatus`·제공 UI | 기본 서버의 `ENGINE_NOT_CONNECTED`를 그대로 표시. PC 조회 성공으로 SDP 미연결을 덮지 않음 |
| 4 상태 카드4개·추이·기록 | `createLocalDashboard` | 맨 위 CPU/메모리/디스크/네트워크 카드4개, 아래 관측 추이와 연결·로그 표. 기존 제공 화면 함께 보존 |
| 4 다시 조회·대기·실패 | 같은 함수의 load/paint·generation | 버튼·키보드 Enter 지원. 요청 전/읽는 중/읽음/실패 분리. 실패·오래된 표본에서 현재 값을 확인 불가 처리. 늦은 이전 응답 무시 |
| 5 안내만 보고 실행 | `FINAL_DEMO.md` / 이 문서 | 위치·환경·명령·정상 신호·파일 선택·종료·재실행·오류 안내. 같은 PC의 새 Git 복제본에서 실제 재현. 제삼자의 직접 실행이라고 쓰지 않음 |
| 6 변경·커밋·푸시 | Git 원문·README·실행 보고서 | 필요한 학생 변경만 커밋·정상 푸시. 원격과40자리 커밋 대조. 포장 명령·강제 푸시·포털 자동 제출 없음 |
| 7 시연·한계·근거 | `FINAL_DEMO.md`의 시연 순서, `FINAL_VALIDATION.md` | 핵심3개를 순서대로 시연할 절차. 실제 PC·모의 오류·원문 확인·미실행·공식 판정 구분 |

## 3. 네 가지 검토 관점

| 관점 | 원문에서 확인할 근거 |
|---|---|
| 기능 작동 | `student/extension.mjs`에 새 기능 구현. 실제 로컬 관측을 새 표본으로 읽음. 기존 제공 기능을 학생 성과로 합산하지 않음 |
| 근거 정직성 | `source`, `checkedAt`, `sampleId`, 상태 검사. 예제/실측/확인 불가/오래된 관측 분리. 실패는0%·정상으로 대체하지 않음. 로그 건수는 공격 판정 아님 |
| 사용 편의 | `label`과 네이티브 파일 선택·버튼, 표의 caption·열 제목, meter의 접근 가능한 이름, 상태 텍스트와 포커스. 키보드 Enter 재조회 실제 확인 |
| 재현 가능성 | 최종 커밋의 새 폴더 복제·런타임 확인·실행·종료·재시작·학생/기존 회귀 검사 보고서. 비밀 파일 복사나 로컬 고정 경로에 의존하지 않음 |

## 4. 직접 확인과 한계

- 실제 로컬 PC 수집, 실제 브라우저 JSON 선택·네트워크 구성 표시·키보드 재조회·오류 후 이전 값 제거를 확인했다. 폴더 선택 API는 모의 검사와 파일 선택 대체 경로를 제공하며 실제 브라우저 폴더 권한 승인을 자동 수행하지 않았다.
- 같은 PC의 새 폴더 재현은 AI 도구 실행이다. 다른 사람·다른 PC가 직접 실행했다는 학생 진술이 아니다. 독립 실행 절차는 문서에 있으며 결과를 꾸미지 않는다.
- 작업 관리자 성능 수치 비교는 자동화 창에서 지표를 읽지 못해 미확인이다. CPU 표본과 메모리 집계 방식·GiB 단위를 공개한다. 값이 같거나 다르다는 이유로 보정값을 넣지 않는다.
- 일반 권한용 읽기 명령만 사용하고 관리자 권한 상승·보안 설정 변경·원격 공격·보안 조치 집행은 하지 않는다. 현재 프로세스의 관측을 모든 표준 사용자 계정의 성공으로 일반화하지 않는다.
- 제공 SDP/XDR·AI 승인·유료 AI·외부 OSV·조치 집행과 포털 판정은 별도다. 미연결 상태로 기능을 평가할 수 있도록 명확한 상태·예제 구분을 유지한다.

## 5. 제출할 값 확인

### 새 폴더에서 같은 제출 커밋 재현

새 PowerShell에서 아래를 따른다. 입력할 커밋은 실제 제출한40자리 값이다. 기존 프로젝트·인증·설정 파일은 복사하지 않는다. 새 폴더 이름이 겹치면 중단하고 다른 이름을 고른다.

```powershell
$submissionCommit = Read-Host '제출할 40자리 Git 커밋'
if ($submissionCommit -notmatch '^[a-fA-F0-9]{40}$') { throw '커밋 형식 확인 필요' }
$reproDirectory = Join-Path $env:USERPROFILE ('Documents/Keshev-repro-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
if (Test-Path -LiteralPath $reproDirectory) { throw '기존 폴더 보존: 새 폴더 이름 필요' }
git clone --single-branch --branch codex/final-dashboard https://github.com/ejdehdtjr-afk/choi-bujang-secret-vault-2.git $reproDirectory
if ($LASTEXITCODE -ne 0) { throw '복제 실패' }
git -C $reproDirectory checkout --detach $submissionCommit
if ($LASTEXITCODE -ne 0) { throw '제출 커밋 확인 실패' }
if ((git -C $reproDirectory rev-parse HEAD) -ne $submissionCommit.ToLowerInvariant()) { throw '커밋 불일치' }
Set-Location -LiteralPath (Join-Path $reproDirectory 'on-client')
node --version
npm.cmd run check
node student/extension.mjs --dashboard --port 5228
```

브라우저 주소는 이 재현에서는 `http://127.0.0.1:5228/`이다. 새 관측 폴더·파일 선택, 다시 조회·종료·재실행은 [실행 설명서](FINAL_DEMO.md)를 따른다. 다른 포트를 쓰면 주소도 함께 바꾼다. Node 기준/실제 확인 버전 차이도 설명서에 있다.

### 원래 제출 작업 폴더에서 확인

Git 최상위에서 실제 커밋과 원격을 확인한다. 원문 문서가 자신의 커밋 해시를 포함하면 다시 커밋이 바뀌므로, 최종 해시는 저장소 밖 인계 기록과 Git 원격으로 확인한다.

```powershell
git status --short
git rev-parse HEAD
git branch --show-current
git remote get-url origin
git ls-remote origin refs/heads/codex/final-dashboard
```

마무리 자료 제출에는 본인 저장소 주소와 위40자리 최종 커밋을 입력한다. 화면 캡처는 선택 사항이다. 공식 통과나 운영 인증을 이 문서가 선언하지 않으며 실제 판정은 제출 후 포털에서 확인한다. 다른 사람의 저장소·커밋·실측 기록을 제출값으로 사용하지 않는다.
