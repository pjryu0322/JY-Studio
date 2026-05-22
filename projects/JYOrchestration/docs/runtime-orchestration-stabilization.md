# Runtime Orchestration Stabilization

AI Team Runtime을 ExecutionJob 기반 Worker 구조로 점진 이전한다.

## Worker types

| Type | Handler | Responsibility |
|------|---------|----------------|
| `git-apply` | `runGitApplyJob` | Git change request apply |
| `cursor` | `handleCursorExecutionJob` | Cursor invoke, ExecutionRun persist |
| `pipeline` | `handlePipelineExecutionJob` | Reviewer → Security → SCM → Merge |

## ExecutionRun-centric model

- Primary runtime key: `TaskExecutionRun` (`execRunId`)
- Worker payloads include `execRunId`, `taskId`, `projectId`, `actorUserId`

## Path policy (Phase 3)

| Task kind | Path |
|-----------|------|
| `ENV_TEST` / `ENV_TEST_STAGE2` | **Sync** `runExecutionLoop` (Stage1/Stage2) — unchanged |
| Normal Task (default) | **Worker** `runNormalTaskViaRuntimeWorkers` |
| Normal Task (emergency) | Legacy inline when `EXECUTION_LOOP_FORCE_INLINE_CURSOR=1` |

Deprecated: `EXECUTION_LOOP_CURSOR_VIA_JOB=1` (Phase 2 opt-in). Worker path is now default.

```text
runExecutionLoop
  → TaskExecutionRun
  → runNormalTaskViaRuntimeWorkers
      → cursor job (sync)
      → confirmCursorGitReflection
      → pipeline job (sync)
```

Worker `steps` (merged into loop as `worker_step`):

- `worker_dispatch` → `cursor_job` → `reflection` → `pipeline_job` → `pipeline_result`

## ENV_TEST safety

- `ENV_TEST` / `ENV_TEST_STAGE2` remain on **sync** `runExecutionLoop` paths.
- Workers return `ENV_TEST_REQUIRES_SYNC_LOOP` when mis-enqueued.

## Pipeline result codes

Defined in `pipelineResultCodes.ts`: `APPROVAL_WAITING`, `MERGED`, `MERGE_PENDING`, `REVIEW_REJECTED`, `REVIEWER_NOT_CONFIGURED`, `SECURITY_FAILED`, `SCM_HOLD`, `SCM_NOT_CONFIGURED`, `PR_CREATE_FAILED`, `MERGE_FAILED`, etc.

User-facing messages: `pipelineMessageForCode()`.

## Self-healing (Phase 3)

On pipeline review reject:

1. `triggerSelfHealingLite()` → `AUTO_HEALING` tasks (when project spec exists)
2. `AUTO_HEALING_TRIGGERED` runtime event
3. Optional: `RUNTIME_SELF_HEALING_AUTO_CURSOR=1` enqueues `cursor` jobs for created tasks (default **off**)

## Runtime events

`appendRuntimeEvent()` + in-memory `runtimeTimelineStore` (execRunId-scoped).

Timeline: `listRuntimeTimelineForExecRun()` merges memory store, optional progress log file (`JY_TASK_PROGRESS_LOG_FILE`), and `executionEventLog` (task-scoped; may omit events without `executionJobId`).

Snapshot: `buildRuntimeDashboardSnapshot()` includes `timelineCount`, `lastEventAt`.

## Retry policy

`executionRetryPolicy.ts` — used from `runExecutionLoop`.

## Modules

```text
apps/web/src/lib/runtime/
  normalTaskWorkerDispatch.ts
  cursorExecutionReflection.ts
  pipelineExecutionJobSync.ts
  pipelineResultCodes.ts
  runtimeSelfHealingBridge.ts
  runtimeTimelineStore.ts
  runtimeObservability.ts
  … (cursor/pipeline handlers, phases, events)
```

## Remaining follow-up

- Remove legacy inline normal-task blocks after production validation
- `resumeScmAfterApproval` via pipeline worker only
- Dedicated runtime event DB model (optional)
- Full self-healing auto-run policy
