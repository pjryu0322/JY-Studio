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

## ENV_TEST safety

- `ENV_TEST` / `ENV_TEST_STAGE2` remain on **sync** `runExecutionLoop` paths (Stage2 GitHub source-of-truth).
- Cursor/pipeline workers return `STAGE2_REQUIRES_SYNC_LOOP` / `ENV_TEST_REQUIRES_SYNC_LOOP` when mis-enqueued.

## Optional cursor job dispatch

Set `EXECUTION_LOOP_CURSOR_VIA_JOB=1` to enqueue `cursor` jobs and process via `runCursorJobSynchronously` (non–ENV_TEST tasks).

## Runtime events

Use `appendRuntimeEvent()` (`lib/runtime/runtimeEventService.ts`) for standardized timeline entries:

- `CURSOR_STARTED` / `CURSOR_COMPLETED` / `CURSOR_FAILED`
- `REVIEW_STARTED` / `REVIEW_APPROVED` / `REVIEW_FAILED`
- `SCM_STARTED` / `MERGE_COMPLETED` / `MERGE_FAILED`
- `PIPELINE_STARTED` / `PIPELINE_COMPLETED`

## Retry policy

`lib/runtime/executionRetryPolicy.ts` — `shouldRetryExecution`, `shouldBlockRepeatedFailure` (used from `runExecutionLoop`).

## Observability

`buildRuntimeDashboardSnapshot(execRunId)` — current phase, worker, retry count, review/SCM/merge fields.

## Modules

```text
apps/web/src/lib/runtime/
  cursorExecutionJobHandler.ts
  cursorExecutionJobTypes.ts
  pipelineExecutionJobHandler.ts
  pipelineExecutionPhases.ts
  pipelineExecutionJobTypes.ts
  runtimeEventService.ts
  runtimeEventTypes.ts
  executionRetryPolicy.ts
  runtimeObservability.ts
```
