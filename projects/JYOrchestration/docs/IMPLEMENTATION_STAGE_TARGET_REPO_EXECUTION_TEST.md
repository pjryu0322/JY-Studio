# 구현단계 Target Repo 실제 소스 생성 수동 E2E 체크리스트

## 1. 사전 조건

- ExecutionSetup.gitRepoName 또는 gitRepoUrl 설정
- ExecutionSetup.baseBranch 설정
- ExecutionSetup.workspacePath 설정
- workspacePath가 해당 Git 저장소 clone 경로와 일치
- `git -C {workspacePath} remote get-url origin` 결과가 ExecutionSetup Git 저장소와 일치
- GitHub token 설정
- Cursor API 또는 Bridge 설정
- autoCommit=true
- autoPush=true/false 의도 확인
- autoPr=true/false 의도 확인
- allowedPathGlobs 확인

## 2. 실행 절차

1. Quick Design 확정
2. 구현단계 진입
3. 구현 작업 보드에서 대상 repo 진단 확인
4. [생성요청]
5. WIP 초안 생성 확인
6. [Cursor 실행 요청] — 요청 전 **Target Repo 수동 E2E 진단** 메시지 확인
7. workspace origin mismatch 여부 확인
8. changedFiles 확인
9. commitSha 확인
10. push 상태 확인
11. PR 상태 확인
12. [구현 결과 승인]
13. 검수자/보안관 점검 기준 metadata 확인

## 3. 성공 기준

- target repo가 표시된다.
- workspacePath가 target repo와 일치한다.
- branchName이 생성된다.
- changedFiles가 1건 이상이다.
- commitSha가 실제 Git commit이다.
- wip-stub이 아니다.
- push 상태가 성공/미수행/실패로 명확히 표시된다.
- PR 상태가 생성됨/미수행/미연결로 명확히 표시된다.
- 검수/보안 점검 기준에 commitSha/changedFiles가 포함된다.

## 4. 실패 기준

- Cursor 실행 요청 blocked
- workspace origin mismatch
- changedFiles 없음
- commitSha 없음
- wip-stub 표시
- target repo 미표시
- push 상태 미표시
- PR 상태가 성공처럼 오표시 (autoPr=true인데 prNumber 없을 때)
- 검수/보안 diff 엔진 미연결인데 통과로 표시

## 5. 실패 기록 양식

- projectId:
- gitRepoName:
- gitRepoUrl:
- baseBranch:
- workspacePath:
- workspace origin:
- selectedTaskId:
- branchName:
- commitSha:
- changedFiles:
- push status:
- PR status:
- bridge status:
- error message:

## 6. 미연결 영역 (이번 단계에서 완성하지 않음)

| 영역 | 플랫폼 표시 |
|------|-------------|
| Cursor API/Bridge 소스 생성 품질 | Bridge 연결 상태 / 실제 source generation 성공 여부만 표시. 품질 보장 표현 없음 |
| PR 자동 생성 | `PR: 미수행 — PR 자동 생성은 아직 미연결` (autoPr=true, prNumber 없음) |
| 검수/보안 diff 분석 | `engineConnectionStatus: pending_engine_connection` — metadata만 전달, 자동 통과 없음 |

## 7. 수동 시나리오

### 정상 설정

- gitRepoName = `pjryu0322/aiproject`, workspacePath = 해당 clone 경로, autoPush=true, autoPr=false
- 기대: origin 일치 → commitSha → push → PR 미수행(autoPr=false) → bridge_completed

### workspace mismatch

- gitRepoName과 다른 저장소 clone을 workspacePath로 지정
- 기대: Cursor 실행 blocked, origin 불일치 메시지

### PR 미연결

- autoPr=true, prNumber 없음
- 기대: `PR: 미수행 — PR 자동 생성은 아직 미연결`, bridge_completed는 commit 기준 유지

### 검수/보안 diff 엔진 미연결

- bridge_completed 후 검수자/보안관 점검 실행
- 기대: commitSha/changedFiles 표시 + diff 엔진 미연결 안내, 자동 passed 없음

## 8. Cursor API 직접 호출 모드 확인

- ExecutionSetup.cursorApiUrl 저장
- Cursor API Token 저장 (화면에는 masked, 서버 route는 plaintext 사용)
- Git 저장소 / workspacePath / GitHub Token 저장
- 보드 진단에서 `Mode: cursor_api` 확인
- `Status: ready` 또는 `configured_but_unverified` 확인
- `CURSOR_BRIDGE_ENABLED=false` 여도 **disabled로 표시되면 실패**

## 9. Cursor API 직접 실행 검증

1. [생성요청]
2. WIP 초안 생성 확인
3. [Cursor 실행 요청]
4. prompt timeline에 `cursor_api_availability_checked`, `cursor_api_direct_execution_requested` 확인
5. Cursor API 호출 로그 확인 (token/API key는 로그에 없어야 함)
6. target repo changedFiles 확인
7. commitSha 확인 (wip-stub 아님)
8. push 상태 확인

## 10. Cursor API 실패 기준

- Cursor API 설정이 있는데 `Mode: disabled`
- cursorApiTokenMasked를 실제 token처럼 전달
- Cursor API unsupported인데 bridge_completed 표시
- commitSha/changedFiles 없이 bridge_completed
- Cursor API endpoint 404/501인데 성공으로 표시

## 11. 실제 실행모드: cursor_api only

구현단계 실제 소스 생성 실행은 **Cursor API 직접 호출(`cursor_api`)** 만 사용한다.

| 항목 | 값 |
|------|-----|
| 허용 모드 | `cursor_api`, `none` |
| 사용 금지 (실행 경로) | `http_bridge`, `local_runner`, env bridge fallback |
| Availability 기준 | ExecutionSetup만 (`cursorApiUrl`, Cursor Token, Git 저장소, `workspacePath`) |
| `[Cursor 실행 요청]` | `executeCursorApiDirect` → `{cursorApiUrl}/execute` |
| API 실패 시 | local runner 등으로 fallback 하지 않음 |
| 성공 저장 | `executionMode: cursor_api`, `bridgeAdapter: cursor_api`, `bridgeExecutionStatus: bridge_completed` |

검증:

- `CURSOR_BRIDGE_ENABLED` / `CURSOR_BRIDGE_ENDPOINT` 가 있어도 mode가 `http_bridge`로 선택되지 않음
- ExecutionSetup에 Cursor API가 있으면 `Status: disabled` 가 아님
- 보드 진단에 `Mode: cursor_api` 또는 `Mode: none` 만 표시
