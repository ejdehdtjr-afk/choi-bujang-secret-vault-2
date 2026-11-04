# 학생 자동 검사·화면 관측 기록

기록 유형: 코딩 도구의 실제 로컬 실행 + 모의 입력 + 원문 비교. 공식 판정·제삼자 재현이 아니다.

검사 시작(UTC): `2026-11-04T12:15:14.850Z`  
검사 종료(UTC): `2026-11-04T12:15:19.469Z`  
기준 HEAD: `55c987fefa9cc1a36e83b95b83c4b74c37453bd1` / 작업 트리: `modified`

이 기록은 커밋 전 작업본 검사다. 기준 HEAD만으로 새 UI의 실행 결과를 주장하지 않는다. 아래 파일 해시를 제출본의 동일 파일과 대조하며, 커밋 후 별도 보고서로 다시 검사한다. 과거 22단계 기록과 합쳐 전체 운영 성공으로 표시하지 않는다.

| 검사 | 종류 | 결과 |
|---|---|---|
| `protected-code-preserved` | source-comparison | pass |
| `invalid-missing-numeric-and-secret-input` | mock-input | pass |
| `dashboard-load-refresh-failure-clears-current-cards` | mock-DOM | pass |
| `stale-file-and-large-file-never-current` | mock-DOM | pass |
| `newer-file-wins-over-delayed-old-read` | mock-DOM | pass |
| `folder-refresh-reads-new-file-without-network` | mock-DOM | pass |
| `local-PC-readonly-measurement` | actual-local-PC | pass |
| `no-write-security-command-or-network-in-collector` | source-inspection | pass |

이번 범위: 8건 통과, 0건 실패. 모의 폴더 핸들 검사는 실제 브라우저 폴더 권한 조작의 증거가 아니다.

| 학생 원문 | SHA-256 (UTF-8, CRLF를 LF로 정규화) |
|---|---|
| `student/extension.mjs` | `43be2229ed80f148c04b4d1e5f445b884dd4d4a1d4f2560491d6957abe882ca0` |
| `tools/student-pc-snapshot.mjs` | `86463ded685e1518799705a382b3338e9c54ddf40da23674ab29946e60e4ee67` |

## 실제 화면·프로세스 관측

- 2026-11-04 21:10~21:15 KST: 실제 관측 JSON 파일 선택 후 네 카드와 방화벽·Windows 로그 표의 값·출처·시각 표시 확인.
- Enter 키로 다시 조회한 뒤 새 파일을 선택해 추이 표가 1개에서 2개로 늘어남을 확인.
- 별도 잘못된 테스트 JSON 선택 시 조회 실패와 현재 카드 네 개의 확인 불가, 과거 이력 별도 유지 확인. 모의 오류를 실제 운영 장애라고 쓰지 않음.
- Ctrl+C 종료 후 5226/5227 HTTP 응답 중지 및 이전 관측 파일 수정 시각이 19초간 유지됨을 확인. 새 실행에서 새 관측 폴더 생성 및 /api/me의 503 ENGINE_NOT_CONNECTED 확인.
- 실행 중인 5227에 두 번째 학생 도구를 시작하면 종료 코드1로 중단. 원래 서버는 유지됨. 강제 프로세스 종료·포트 탈취 없음.
- 최종 화면의 PC 조회 성공과 제공 화면의 SDP 연결 없음 표시가 공존함을 확인. 실제 계정·AI·조치 집행을 실행하지 않음.

## 미확인

- 다른 사람의 새 PC 재현, 작업 관리자와 동시 비교, 실제 브라우저 폴더 선택/권한 UI, 정확한 브라우저 버전.
- 실제 SDP/XDR, 유료 AI, 외부 OSV, 조치 실집행·공식 판정.
- 이번 검사 결과는 v1.0/운영 인증이 아니며 검증 중 버전이다.
