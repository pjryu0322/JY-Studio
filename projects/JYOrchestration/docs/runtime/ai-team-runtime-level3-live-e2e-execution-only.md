# AI Team Execution Runtime Level 3 — Live E2E 실제 실행 전용

> **대상:** 운영자(로컬 환경). Cursor/CI는 본 문서의 live 단계를 대신 수행·PASS로 기록하지 않는다.

## 현재 판정

소스·helper·runbook 작업은 `main`에 반영 완료.

| 항목 | 상태 |
|------|------|
| PR #13 — Runtime 1차 연결 | 완료 |
| PR #14 — Timeline / Run Log 가시화 | 완료 |
| Live E2E helper + lib + unit tests | 완료 |
| Runbook / Evidence review | 완료 |
| `scan-live-e2e-evidence.mjs` | 완료 |
| 운영자 evidence (`docs/runtime/evidence/*.md`) | **없으면 보류** |
| Level 3 다음 단계 (TaskHistory 통합 등) | **evidence PASS 전 보류** |

관련 문서:

- `ai-team-runtime-level3-live-e2e-runbook.md` — API·환경 변수·실패 분류
- `ai-team-runtime-level3-manual-e2e.md` — 최종 판정 (요약만 커밋)
- `ai-team-runtime-level3-evidence-review.md` — evidence 유무 검토 로그

---

## 절대 금지

- Runtime 실행 로직 변경
- DB schema 변경
- Stage1 / Stage2 / ENV_TEST 로직 변경
- read-only 검증 계층·신규 H 계층 추가
- evidence 없이 Manual E2E를 PASS로 갱신
- Cursor가 live E2E를 수행했다고 기록
- session cookie, token, password, API key 원문을 커밋·문서에 기록

---

## 1. 로컬 실행 환경 준비

```bash
git checkout main
git pull origin main
cd projects/JYOrchestration/apps/web
npm install
npx prisma generate
npm run dev
```

브라우저: `http://localhost:3000`

확인:

- 로그인 가능
- DB 연결 가능
- 프로젝트 화면 접근 가능
- Cursor / GitHub 연동 설정
- AI Reviewer / Security Reviewer / SCM Manager 설정

---

## 2. 일반 Task Runtime 실행

일반 Task를 선택하거나 생성한다.

**사용 금지:** ENV_TEST Task, Stage1 / Stage2 환경검증 Task

목표 흐름:

```text
AI개발자 실행
→ branch / commit / PR 감지
→ Review
→ Security
→ approval_waiting
```

필수:

```text
ExecutionSetup.requireApprovalBeforeApply = true
```

---

## 3. Session cookie 확보

브라우저 로그인 후 DevTools → Application → Cookies → 요청 헤더 `Cookie` 전체 문자열.

- 민감정보 — 채팅·git·문서 원문에 넣지 않음

---

## 4. Evidence Helper — 승인 전 (E2E A)

```bash
cd projects/JYOrchestration/apps/web

JYO_BASE_URL=http://localhost:3000 \
JYO_PROJECT_ID=<projectId> \
JYO_TASK_ID=<taskId> \
JYO_SESSION_COOKIE='<cookie 전체 문자열>' \
node scripts/ai-team-runtime-live-e2e-check.mjs
```

성공 기준 (콘솔):

```text
execution-runs success: PASS
data[0] exists: PASS
teamRuntime exists: PASS
timeline exists: PASS
timeline length = 7: PASS
stage order: PASS
Evidence written: ...
```

출력 파일 (gitignore, 커밋 금지):

```text
projects/JYOrchestration/docs/runtime/evidence/ai-team-runtime-live-e2e-YYYY-MM-DD-HHMMSS.md
```

---

## 5. Evidence Helper — 승인 후 SCM 재개 (E2E B)

`approval_waiting` 확인 후:

```text
JYO_APPROVE=1 은 실제 Task workflow 를 변경한다.
```

```bash
JYO_BASE_URL=http://localhost:3000 \
JYO_PROJECT_ID=<projectId> \
JYO_TASK_ID=<taskId> \
JYO_SESSION_COOKIE='<cookie 전체 문자열>' \
JYO_APPROVE=1 \
node scripts/ai-team-runtime-live-e2e-check.mjs
```

성공 기준:

```text
WARNING: this will mutate task workflow status.
Approve API: PASS
approval / scm stage 가 실제 상태와 일치
teamRuntime.status 변경 확인
Evidence written: ...
```

---

## 6. ENV_TEST / Stage1 / Stage2 보존 (E2E C)

별도 ENV_TEST Task 실행 후 확인:

```text
ENV_TEST family 실행 가능
PR 감지 후 PR_OPENED terminal success 유지
일반 Runtime Review/Security/Approval/SCM 경로 미진입
Stage1 / Stage2 회귀 없음
```

(live 확인은 UI·기존 environment-test 경로; helper는 일반 Task용 API 검증)

---

## 7. Evidence 민감정보 점검

```bash
cd projects/JYOrchestration/apps/web
node scripts/scan-live-e2e-evidence.mjs
```

수동으로도 확인 — 아래가 evidence에 없어야 함:

```text
session cookie
authorization header
GitHub token
Cursor key
OpenAI key
password
private token
```

민감정보 포함 시: evidence 원문 커밋 금지 → 제거 후 재생성 → manual-e2e에는 요약만.

---

## 8. Manual E2E 문서 갱신

대상: `ai-team-runtime-level3-manual-e2e.md`

evidence의 `Live E2E 결과: **PASS|FAIL|PARTIAL**` 및 E2E A/B/C live 결과를 **요약만** 반영. evidence 파일명만 기록 (원문 경로는 gitignore).

### Evidence PASS

```md
## Live Evidence 반영

- Evidence generated: yes
- Evidence file: docs/runtime/evidence/<filename> (원문 gitignore, 요약만 반영)
- Live E2E result: PASS
- execution-runs API: PASS
- Timeline length/order: PASS
- Approval/SCM transition: PASS
- ENV_TEST preservation: PASS/PARTIAL

## 결론

- Level 3 Timeline 운영 검증: PASS
- Level 3 다음 단계 진입 가능 여부: 가능
```

### Evidence PARTIAL / FAIL

`ai-team-runtime-level3-manual-e2e.md` 내 「결론」절에 PARTIAL/FAIL·보류 사유를 기록 (템플릿은 해당 문서 참고).

---

## 9. 다음 단계 판정

### 진행 가능 (모두 충족)

```text
자동 검증 PASS
Live execution-runs API PASS
teamRuntime.timeline length/order PASS
일반 Task Runtime A PASS
approval/scm B PASS 또는 명확한 보류 사유
ENV_TEST C PASS/PARTIAL
민감정보 없음
```

→ **TaskHistory / appendTaskProgressLog Timeline 통합** 착수

### 보류 (하나라도 해당)

```text
evidence 없음
dev server / DB / session 미준비
execution-runs API 실패
timeline 없음 또는 length/order 실패
approval/scm 불일치
ENV_TEST 회귀
민감정보 포함 evidence
```

---

## 10. 운영자 결과 보고 (채팅/이슈용)

evidence 생성 후 아래 형식으로 보고 (cookie·token 원문 금지):

```md
## Live E2E 실행 결과
- E2E A 일반 Task Runtime:
- E2E B 승인 후 SCM 재개:
- E2E C ENV_TEST 보존:

## Evidence
- evidence 생성 여부:
- evidence 파일명:
- 민감정보 포함 여부:
- execution-runs API:
- timeline length/order:
- approval/scm 상태:

## 문서 갱신
- ai-team-runtime-level3-manual-e2e.md 갱신 여부:
- 최종 판단:
- 다음 단계 진입 가능 여부:

## 다음 작업 제안
- TaskHistory / appendTaskProgressLog Timeline 통합
```

---

## 최종 주의

병목은 **코드가 아니라 운영자 live evidence 미생성**이다. evidence PASS 전까지 TaskHistory 통합, Role Run 분리, Retry/Cancel/Resume으로 진행하지 않는다.
