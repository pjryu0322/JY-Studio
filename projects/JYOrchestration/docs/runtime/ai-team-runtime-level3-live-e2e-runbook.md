# AI Team Execution Runtime Level 3 Live E2E Runbook

## 목적

`main` 기준으로 실제 AI Team Runtime 흐름을 운영자가 로컬 환경에서 확인하고, API 응답 증거를 파일로 남긴다.

관련 문서:

- `ai-team-runtime-level3-timeline.md` — Timeline 설계
- `ai-team-runtime-level3-timeline-post-merge.md` — PR #14 post-merge 자동 검증
- `ai-team-runtime-level3-manual-e2e.md` — Manual E2E 판정 (live 미실행 시 PARTIAL)

## 사전 조건

1. `git checkout main && git pull`
2. `cd projects/JYOrchestration/apps/web && npm install` (필요 시)
3. dev server 실행 (`npm run dev`, 기본 `http://localhost:3000`)
4. DB 연결 (`.env.local`의 `DATABASE_URL`)
5. 브라우저 로그인 후 session cookie 확보
6. 테스트용 `projectId` 확보
7. **일반 Task** 생성 (ENV_TEST / Stage1 / Stage2 제외)
8. `ExecutionSetup.requireApprovalBeforeApply = true`
9. Cursor / GitHub 연동 설정
10. AI Reviewer / Security Reviewer / SCM Manager 멤버 설정

## 순서

### A. 일반 Task Runtime

1. 일반 Task 실행 (UI 또는 execution-loop)
2. `branchName` / `commitSha` / PR 감지 대기
3. `REVIEW_PENDING` → Review / Security → `approval_waiting` 확인
4. Evidence helper로 API·Timeline 확인
5. 프로젝트 화면 「AI팀 실행 타임라인」7단계 표시 확인

### B. 승인 후 SCM 재개

1. E2E A에서 `approval_waiting` 확인 후
2. UI 「AI팀 Runtime 승인」 또는 helper `JYO_APPROVE=1` (상태 변경 주의)
3. `merge_running` / SCM 단계 / Timeline approval·scm 상태 갱신 확인

### C. ENV_TEST 보존

1. ENV_TEST family Task 1건 실행
2. `PR_OPENED` terminal success 유지 확인
3. 일반 Runtime Review/Approval/SCM 경로 미진입 확인 (소스: `runExecutionLoop` `isEnvTestTask` 분기)

## Evidence Helper 사용법

스크립트는 **Runtime을 실행하지 않습니다.** 이미 있는 `projectId` + `taskId`로 `execution-runs` API만 조회합니다.

```bash
cd projects/JYOrchestration/apps/web

JYO_BASE_URL=http://localhost:3000 \
JYO_PROJECT_ID=<projectId> \
JYO_TASK_ID=<taskId> \
JYO_SESSION_COOKIE='next-auth.session-token=...; ...' \
node scripts/ai-team-runtime-live-e2e-check.mjs
```

`--help`로 사용법 확인:

```bash
node scripts/ai-team-runtime-live-e2e-check.mjs --help
```

검증 로직은 `scripts/lib/ai-team-runtime-live-e2e-lib.mjs`에 있으며, `tests/harness/ai-team-runtime/aiTeamRuntimeLiveE2eLib.unit.test.ts`로 단위 검증한다.

브라우저에서 cookie 복사: DevTools → Application → Cookies → 요청 헤더의 `Cookie` 전체 문자열.

### 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `JYO_PROJECT_ID` | yes | 프로젝트 ID |
| `JYO_TASK_ID` | yes | 검증할 Task ID |
| `JYO_SESSION_COOKIE` | yes | 로그인 session cookie |
| `JYO_BASE_URL` | no | 기본 `http://localhost:3000` |
| `JYO_APPROVE` | no | `1`이면 `workflow-approve-ai-team-runtime` 호출 (기본 `0`) |
| `JYO_OUTPUT_MD` | no | evidence Markdown 경로 (미설정 시 `docs/runtime/evidence/` 아래 타임스탬프 파일) |

### 승인 API까지 확인

```bash
JYO_APPROVE=1 \
JYO_PROJECT_ID=<projectId> \
JYO_TASK_ID=<taskId> \
JYO_SESSION_COOKIE='<cookie>' \
node scripts/ai-team-runtime-live-e2e-check.mjs
```

콘솔에 `WARNING: this will mutate task workflow status.` 가 출력된 뒤 승인 API가 호출됩니다.

## Evidence 출력

기본 경로:

```text
projects/JYOrchestration/docs/runtime/evidence/ai-team-runtime-live-e2e-YYYY-MM-DD-HHMMSS.md
```

생성된 evidence를 `ai-team-runtime-level3-manual-e2e.md` 운영자 기록에 링크하세요. **helper를 실행하지 않았다면 Manual E2E를 PASS로 바꾸지 마세요.**

## 실패 분리

| 증상 | 분류 |
|------|------|
| `ECONNREFUSED` | 환경 (dev server 미기동) |
| HTTP 401/403 | session / RBAC |
| HTTP 500 | API 서버 오류 |
| `teamRuntime.timeline` 없음 | Timeline API 결함 후보 |
| timeline length ≠ 7 | ViewModel 결함 후보 |

## 주의

- `JYO_APPROVE=1`은 실제 Task workflow를 변경합니다.
- helper는 Task 생성·Cursor 실행·DB 직접 쓰기를 하지 않습니다.
- Cursor 에이전트는 운영자 대신 live E2E를 수행했다고 기록하지 않습니다.
