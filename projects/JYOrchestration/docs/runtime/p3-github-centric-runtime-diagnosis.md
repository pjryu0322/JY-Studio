# P3 Runtime 진단 보고서 (GitHub-Centric)

> 범위: `projects/JYOrchestration` · DB Implementation Runtime (P2-1 ~ P2-5) 기준

## 1. 현재 구조

### 1.1 End-to-end 흐름 (AS-IS)

```text
CodeTask 선택 → start_job (DB)
  → queued run
  → dispatchNextQueuedImplementationRuntimeRun
      → Task Cursor Job 생성 + Cursor Launch
      → runtime: dispatching → cursor_running
  → Runtime Poll Worker (claimDueImplementationRuntimePollRuns)
      → runTaskCursorWorkerTick
      → Cursor API poll + (cursor_completed 시) GitHub verify
      → syncDbRuntimeAfterTaskCursorServerPoll
          → implementationRuntimeTaskCursorSync
              → Task Cursor status → DB runtimeState 매핑
              → github_verified → completeImplementationRuntimeGithubVerifyAndAdvance
  → advanceImplementationRuntimeJob (다음 queued run)
```

**Source of Truth (실질):** Task Cursor JSON `status` → `mapTaskCursorStatusToRuntimeState` → DB `runtimeState`.

**Source of Truth (의도):** GitHub branch/commit/PR — `verifyTaskCursorGithubResult`가 성공해야 advance.

### 1.2 DB Runtime 상태

| `runtimeState`     | 의미 (현재 구현)                          |
|--------------------|-------------------------------------------|
| `queued`           | Job 대기 중 CodeTask                      |
| `dispatching`      | Cursor dispatch / cursor_requested        |
| `cursor_running`   | Cursor agent 실행 중                      |
| `github_verifying` | Cursor 완료 후 GitHub 검증                |
| `completed`        | GitHub verify 성공 + run 종료             |
| `failed` / `stale` | 실패 / 상태 추적 중단                     |

Prisma/상태머신: `implementationRuntimeStateMachine.ts`, `implementationRuntimeTaskCursorSync.ts` (중복 그래프).

### 1.3 Poll / Lock / Schedule

| 구성요소 | 역할 |
|----------|------|
| `implementationRuntimePollRepository` | `nextPollAt`, `pollCount`, `pollLockedBy`, `taskCursorJobId` — due run claim |
| `implementationRuntimePollService` | Thin wrapper → `runTaskCursorWorkerTick` |
| Task Cursor Job repo | Job 단위 pollCount/nextPollAt (Run과 이중 동기: `syncRunPollScheduleFromJob`) |
| `implementationRuntimeCursorService` | heartbeat, cursor_running/github_verifying 전환 |
| Client poll loop | Legacy JSON 경로 (`taskCursorClientPollLoop`) |

Poll 대상 상태: `dispatching`, `cursor_running`, `github_verifying` (`RUNTIME_POLL_SCHEDULE_STATES`).

### 1.4 UI

- **Primary (P2-5):** GET `/implementation-runtime` → `ImplementationRuntimeBundleView` 폴링.
- **Diagnostics:** `ImplementationRuntimeDiagnosticsPanel` — DB primary 시 Job/Run/Cursor Agent/GitHub 요약.
- **Labels:** `formatRuntimeStateKo` — 내부 enum 영문 그대로 노출 (`cursor_running` 등).
- **Legacy:** `implementationRuntimeStateV1` JSON, Task Cursor 중심 overview (`implementationExecutionOverview`).

---

## 2. 파일별 의존성 정리

### `implementationRuntimeExecutionService.ts`

| 분류 | 내용 |
|------|------|
| Cursor 의존 | `dispatchNextQueuedImplementationRuntimeRun` → launch, `markImplementationRuntimeCursorRunning/Failed` |
| GitHub 의존 | `completeImplementationRuntimeGithubVerifyAndAdvance`, `failImplementationRuntimeGithubVerify` |
| 유지 | `start`, `advance`, `fail`, dispatch, GitHub advance/fail |
| 축소 후보 | dispatch 실패 시 Cursor 전용 이벤트 — 진단으로 격하 가능 |

### `implementationRuntimeCursorService.ts`

| 분류 | 내용 |
|------|------|
| Cursor 의존 | `cursor_running`, `github_verifying` 전환, heartbeat, `cursor_completed` 이벤트 |
| GitHub 의존 | `markImplementationRuntimeCompleted` (commitSha, pullRequestUrl) |
| 삭제 불가 (단기) | Launch 직후 `cursor_running` 기록, watchdog/grace |
| 장기 | 상태 전환 SoT에서 분리 → **진단 필드** (`cursorAgentId`, `lastHeartbeatAt`, events)만 유지 |

### `implementationRuntimePollRepository.ts`

| 분류 | 내용 |
|------|------|
| Cursor 의존 | Claim 조건 `taskCursorJobId IS NOT NULL` |
| GitHub 의존 | 없음 (verify는 worker 내부) |
| 유지 | Lock/release, schedule (당분간 Task Cursor tick 호스트) |
| 축소 | Run/Job 이중 poll 메타 → Run 단일 SoT로 통합 |
| 장기 삭제 후보 | Cursor 없이 GitHub-only due run (별 worker) |

### `implementationRuntimeTaskCursorSync.ts`

| 분류 | 내용 |
|------|------|
| Cursor 의존 | **핵심** — `mapTaskCursorStatusToRuntimeState`, stepwise `applyRuntimeStep` |
| GitHub 의존 | `github_verified` / `github_verify_failed` → advance / fail |
| 유지 | Transition guard, advance/fail 호출 |
| 축소 | Cursor status → runtime 매핑 제거, **GitHub verify 결과만** runtime 전환 |
| 장기 | `implementationRuntimeGithubSync`로 rename/분리 |

### `PrototypePreviewPanel.tsx`

| 분류 | 내용 |
|------|------|
| Cursor 의존 | Task Cursor execute, legacy sync, cursor bridge (광범위) |
| GitHub 의존 | 간접 (poll/verify는 server worker) |
| 유지 | `start_job`, GET poll, diagnostics |
| 축소 | Legacy JSON recovery 경로 (점진 deprecate) |

### 기타 연관

- `taskCursorWorkerService.ts` — Poll + GitHub verify + DB sync 한 틱에 결합.
- `taskCursorGithubVerify.ts` — GitHub REST SoT (branch/commit/path guard).
- `implementationRuntimeWatchdog.ts` — `orphan_cursor_running` 등 Cursor 링크 검사.
- `implementationRuntimeJsonBridge.ts` — Legacy JSON ↔ DB 상태 브리지.

---

## 3. 문제점

1. **상태 전이가 Cursor API에 종속**  
   `cursor_completed` 없이는 `github_verifying`에 들어가기 어렵고, GitHub에 이미 commit이 있어도 Runtime은 `cursor_running`에 머물 수 있음.

2. **이중 Poll 스케줄**  
   Task Cursor Job과 Implementation Run 모두 `pollCount` / `nextPollAt` — drift·복구 비용.

3. **사용자 표현이 엔진 내부어**  
   UI가 `cursor_running` 등을 그대로 보여 CodeTask/GitHub 진행과 어긋남.

4. **완료 정의가 분산**  
   - Task Cursor: `github_verified` → `review_pending`  
   - DB Runtime: `github_verifying` → `completed` + `advance`  
   동일 개념이 두 레이어에 중복.

5. **Poll Worker = Cursor Worker**  
   GitHub-centric 목표(`waiting_github`에서 branch/commit 폴링)와 구조적으로 불일치.

---

## 4. 개선안 (요약)

### 4.1 원칙

- **Runtime 진행/완료:** GitHub 증거 (branch, commit, PR, merge) 우선.
- **Cursor:** dispatch + 선택적 진단 (agent id, heartbeat, API status).
- **단계적 이행:** DB enum 변경 전 **표시 레이어 + verify 서비스 경계**부터 (P3 1단계 코드).

### 4.2 목표 상태 (TO-BE 후보)

| TO-BE | AS-IS 매핑 (과도기) |
|-------|---------------------|
| `requested` | `queued`, `dispatching`, `cursor_running` |
| `waiting_github` | `github_verifying` (+ 장기: dispatch 직후 GitHub poll) |
| `completed` | `completed` |
| `failed` | `failed` |
| `stale` | `stale` |

DB 마이그레이션 전까지는 **저장은 AS-IS**, **UI/리포트는 TO-BE phase** (`implementationRuntimeGithubCentricModel.ts`).

### 4.3 Cursor 세부 상태 (`cursor_requested` / `cursor_running` / `cursor_completed`)

| 항목 | 판단 |
|------|------|
| Runtime 필수? | **아니오** — 제품 완료 조건 아님 |
| 운영 필수? | Launch 실패 감지, watchdog — **진단**으로 유지 |
| 권장 | Task Cursor Job + Run events; DB `runtimeState`는 `requested`/`waiting_github`로 수렴 |

### 4.4 Poll

| 조치 | 항목 |
|------|------|
| 유지 | Run-level lock/schedule (당분간) |
| 축소 | Job poll 메타 → Run mirror만 |
| 삭제 (장기) | Cursor status poll을 GitHub poll tick으로 대체 가능한 run은 분기 |

### 4.5 GitHub 확인

- 기존 `verifyTaskCursorGithubResult` 유지 (REST SoT).
- Runtime 전용 façade: `implementationGithubVerificationService.ts` — verify → `completeImplementationRuntimeGithubVerifyAndAdvance` / `failImplementationRuntimeGithubVerify`.
- 장기: Cursor 완료 없이 `waiting_github` 진입 시 동일 서비스 호출.

---

## 5. 삭제 가능 / 유지 필요 (단계)

| 코드 | 1단계 | 2단계+ |
|------|-------|--------|
| `mapTaskCursorStatusToRuntimeState` | 유지 (sync 필수) | GitHub outcome만 전환 |
| `implementationRuntimePollService` | 유지 | GitHub worker 추가 후 분리 |
| `implementationRuntimeJsonBridge` | Legacy용 유지 | JSON runtime deprecate 후 삭제 |
| Cursor heartbeat on Run | 유지 (watchdog) | 진단 전용 |
| `completeImplementationRuntimeGithubVerifyAndAdvance` | **유지 (SoT advance)** | 동일 |

---

## 6. 리스크

- Cursor API 지연/오류와 GitHub push 타이밍 불일치 → **waiting_github에서 GitHub 우선 poll** 필요.
- Enum 축소 시 기존 migration/API 클라이언트 호환 → **dual-read** 기간 필수.
- `PrototypePreviewPanel` legacy 경로 제거는 별도 릴리스 단위.

---

*다음 문서: [p3-github-centric-runtime-design.md](./p3-github-centric-runtime-design.md)*
