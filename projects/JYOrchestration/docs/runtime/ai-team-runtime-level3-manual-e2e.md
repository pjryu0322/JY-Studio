# AI Team Execution Runtime Level 3 Manual E2E Report

## 기준

- Branch: `main`
- Date: 2026-05-18
- Scope: `projects/JYOrchestration/**`
- PR baseline: #13 (Runtime execution connection), #14 (Level 3 Timeline)
- Related: `ai-team-runtime-level3-timeline-post-merge.md`, `ai-team-runtime-level3-evidence-review.md`, `ai-team-runtime-level3-live-e2e-execution-only.md`

## 자동 검증 결과

| 명령 | 결과 | 비고 |
|---|---|---|
| `npx tsc --noEmit` | PASS | main @ `9b91b8a2` |
| `aiTeamRuntimeTimeline.unit.test.ts` | PASS | 14 tests |
| `aiTeamApiTeamRuntime.unit.test.ts` | PASS | 3 tests |
| `aiTeamRuntimeLiveE2eLib.unit.test.ts` | PASS | 7 tests |
| `tests/harness/ai-team-runtime/` | PASS | 30+ tests |
| `node scripts/scan-live-e2e-evidence.mjs` | PASS | evidence 0건 (운영자 미생성) |
| `planningExecutionRunStatusPresentation.unit.test.ts` | PASS | 3 tests |
| `node scripts/ai-team-runtime-live-e2e-check.mjs` (env 없음) | PASS | 기대 오류 메시지 출력 |
| `projects.api.test.ts` | 환경 이슈 | `ECONNREFUSED 127.0.0.1:3000` (dev server 미기동) |

## Manual E2E 준비 상태

| 항목 | 결과 | 비고 |
|---|---|---|
| dev server | FAIL | `http://127.0.0.1:3000` 연결 거부 (검증 시점 미기동) |
| DB | 미확인 | dev server·Prisma 경로 미실행으로 live 확인 불가 |
| 로그인/session | 미확인 | API 호출 불가 |
| projectId | 미확인 | 과거 로컬 로그에 `cmoyfdjw6002lunscejytq5qh` 사용 이력 있음 |
| 일반 Task | 미실행 | |
| `requireApprovalBeforeApply` | 미실행 | |
| Cursor 설정 | 미확인 | 외부 연동 자격 증명·에이전트 미검증 |
| GitHub 설정 | 미확인 | token/repo 설정 live 미검증 |
| AI Reviewer/Security/SCM 멤버 | 미확인 | |

**Ready:** `no` (자동 검증만 완료, live Manual E2E 환경 미충족)

**미충족 항목:** dev server, session, Cursor/GitHub/AI 멤버 live 확인, Task 실행

**비고:** Cursor 에이전트 환경에서는 Next.js dev server·DB·Cursor Cloud·GitHub를 기동·인증할 수 없어 E2E A/B는 **미실행**으로 기록한다. 운영자가 로컬에서 `npm run dev` + DB + 로그인 후 아래 체크리스트로 수행할 것.

---

## E2E A — 일반 Task Runtime

| 항목 | 결과 | 비고 |
|---|---|---|
| TaskExecutionRun 생성 | 미실행 | dev server 미기동 |
| Cursor branch/commit/PR 감지 | 미실행 | |
| PR_OPENED 즉시 종료 없음 | 소스 PASS | 일반 Task는 PR 감지 후 `REVIEW_PENDING` (`runExecutionLoop.ts` ~1607–1615) |
| REVIEW_PENDING 진입 | 소스 PASS | ENV_TEST만 `PR_OPENED` terminal success (~1562–1604) |
| Review/Security 기록 | 미실행 | |
| approval_waiting 정지 | 소스 PASS | `!isEnvTestTask` + `requireApprovalBeforeApply` 시 `haltTaskForTeamRuntimeApproval` (~1766–1770) |
| `teamRuntime.timeline` API | 소스 PASS | `execution-runs` → `toTaskExecutionRunListItem` + `buildTeamRuntimeAdditiveFields` |
| Timeline 7단계 UI | 미실행 | `AiTeamExecutionLatestRunPanel` + `AiTeamRuntimeTimelineList` 구현됨 |

**결과:** **미실행** (환경). 소스·단위 테스트 기준으로 Timeline/API 경로는 구현 완료.

**API 확인 예시 (운영자용):**

```bash
curl -s "http://localhost:3000/api/projects/<projectId>/execution-runs?taskId=<taskId>&take=1" \
  -H "Cookie: <session-cookie>"
```

확인 필드: `data[0].teamRuntime.timeline` (length 7), `data[0].teamRuntime.status`, 각 `stage`/`status`.

---

## E2E B — 승인 후 SCM 재개

| 항목 | 결과 | 비고 |
|---|---|---|
| 승인 API 성공 | 미실행 | `POST /api/task/control` `workflow-approve-ai-team-runtime` |
| MERGE_PENDING 전환 | 미실행 | |
| merge_running 전환 | 미실행 | |
| Cursor 재호출 없음 | 소스 PASS | PR #13 `canResumeTeamRuntimeMerge` / resume 경로 (Timeline PR은 조회만) |
| 기존 PR 재사용 | 미실행 | |
| Timeline approval/scm 갱신 | 소스 PASS | `task.executionWorkflowStatus` + `teamExecutionStatus`가 timeline builder에 전달 (`apiTeamRuntime`) |

**결과:** **미실행** (환경). 승인 API·UI 버튼(`ai-team-runtime-approve-btn`)은 기존 PR #13과 동일 유지.

**API 예시 (운영자용):**

```bash
curl -X POST "http://localhost:3000/api/task/control" \
  -H "Content-Type: application/json" \
  -H "Cookie: <session-cookie>" \
  -d '{"taskId":"<taskId>","action":"workflow-approve-ai-team-runtime"}'
```

---

## E2E C — ENV_TEST / Stage1 / Stage2

| 항목 | 결과 | 비고 |
|---|---|---|
| ENV_TEST PR_OPENED terminal success | 소스 PASS | `isEnvTestTask` 분기에서 `status: done`, `PR_OPENED` 후 루프 종료 (~1562–1604) |
| 일반 Runtime 경로 미진입 | 소스 PASS | `applyTeamRuntimeAfterReviewHarness` 등은 `if (!isEnvTestTask)` (~1746) |
| Stage1 회귀 없음 | 소스 PASS | PR #14 diff에 `runExecutionLoop`/`envTest*` 실행 경로 변경 없음 |
| Stage2 회귀 없음 | 소스 PASS | `environment-test` API·`stage2/*` 미변경; Timeline은 execution-runs additive |
| environment-test API/화면 | 소스 PASS | `environment-test/route.ts` Timeline 필드 추가 없음 |

**결과:** **PARTIAL** — live 실행 미실행, **소스·post-merge diff 기준 회귀 없음**.

---

## Live Evidence 반영 (Evidence Review 2026-05-18)

| 항목 | 값 |
|------|-----|
| Evidence generated | **no** |
| Evidence file | 없음 (`docs/runtime/evidence/`에 `.gitignore`만 존재; 원문은 gitignore 대상) |
| Review log | `ai-team-runtime-level3-evidence-review.md` |
| Live E2E result | **미제공** (Cursor 미수행; PASS로 갱신하지 않음) |
| execution-runs API (live) | 미확인 |
| Timeline length/order (live) | 미확인 |
| Approval/SCM transition (live) | 미확인 |

운영자가 `ai-team-runtime-level3-live-e2e-execution-only.md` · `ai-team-runtime-level3-live-e2e-runbook.md`에 따라 helper를 실행한 뒤 evidence Markdown을 생성하면, 본 절과 E2E A/B 표를 **요약만** 갱신한다 (session cookie 등 민감정보는 커밋·문서에 포함하지 않음). PASS/FAIL/PARTIAL 템플릿은 execution-only §8.

### Evidence PASS 시 갱신 템플릿 (운영자)

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

### Evidence PARTIAL / FAIL 시 (운영자)

- **PARTIAL:** 결론에 보류 사유·조건부 가능 여부 기록
- **FAIL:** 결론에 실패 사유·다음 단계 **보류** 명시

## 결론

- **Level 3 Timeline 운영 검증:** **PARTIAL**
  - 자동 검증·소스 정적 검증: PASS
  - Evidence helper·lib 단위 검증: PASS
  - Manual E2E A/B live (운영자 evidence): **미실행**
  - ENV_TEST 보존: 소스 PASS / live 미실행
- **Level 3 다음 단계 진입 가능 여부:** **보류**
- **보류 사유:** 운영자 live evidence 미제공. dev server·session·Task 실행 후 helper로 evidence 생성 필요.

## Live Evidence Helper

운영자는 `apps/web/scripts/ai-team-runtime-live-e2e-check.mjs`(검증 로직: `scripts/lib/ai-team-runtime-live-e2e-lib.mjs`)로 `GET /api/projects/{projectId}/execution-runs` 응답의 `teamRuntime.timeline`을 검증하고 Markdown evidence를 저장할 수 있다.

- 실행 SSOT: `ai-team-runtime-level3-live-e2e-execution-only.md`
- API·env: `ai-team-runtime-level3-live-e2e-runbook.md`
- evidence 기본 경로: `docs/runtime/evidence/ai-team-runtime-live-e2e-<timestamp>.md`
- 로컬 점검: `node scripts/scan-live-e2e-evidence.mjs`
- **주의:** helper를 실행·PASS 확인하기 전까지 본 문서의 live E2E 결과는 **미실행 / PARTIAL** 로 유지한다.

## 운영자 결과 보고 템플릿 (채팅/이슈)

evidence 생성 후 execution-only §10 형식으로 보고 (cookie·token 원문 금지).

## 운영자 Manual E2E 체크리스트 (요약)

1. `cd projects/JYOrchestration/apps/web && npx prisma generate && npm run dev`
2. DB·`.env.local`·로그인
3. 일반 Task + `requireApprovalBeforeApply=true` + AI 멤버 설정
4. 실행 → `execution-runs` API·프로젝트 화면 Timeline 7단계 확인
5. `approval_waiting`에서 승인 버튼 → merge 재개, Timeline approval/scm 상태 갱신
6. ENV_TEST Task 1건: `PR_OPENED` 후 즉시 종료, Review/Approval 일반 경로 미진입 확인

## 다음 작업

1. **(필수)** `ai-team-runtime-level3-live-e2e-execution-only.md` + Evidence Helper로 live Manual E2E → evidence 생성 → `scan-live-e2e-evidence.mjs` → 본 문서 「Live Evidence 반영」갱신
2. evidence PASS 후: TaskHistory / `appendTaskProgressLog` Timeline 통합 (A안)
3. evidence 미제공 시: Live E2E 환경·Runbook 보강 (B안)
4. Role Run 분리 설계
5. Retry / Cancel / Resume 정책
