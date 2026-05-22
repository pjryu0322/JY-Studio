# Runtime Orchestration Stabilization

## Path policy

| Task kind | Path |
|-----------|------|
| `ENV_TEST` / `ENV_TEST_STAGE2` | Sync `runExecutionLoop` (unchanged) |
| Normal Task (default) | Worker path |
| Normal Task (emergency) | Legacy inline (`EXECUTION_LOOP_FORCE_INLINE_CURSOR=1`) |

## Sync vs background chain (Phase 5)

| Path | Cursor | Reflection | Pipeline |
|------|--------|------------|----------|
| `runNormalTaskViaRuntimeWorkers` | sync job (`syncDispatch: true`) | inline in dispatch | sync job |
| `handleCursorExecutionJob` (background) | worker | `maybeChainCursorJobToPipeline` | **enqueue only** |

- `RUNTIME_CURSOR_CHAIN_PIPELINE=1` (default; set `0` to disable)
- `syncDispatch: true` on cursor payload → handler **skips** chain (no duplicate pipeline)

Self-healing auto cursor: `syncDispatch: false`, `chainSource: "self-healing"` → cursor worker chains to pipeline after reflection.

## Self-healing (Phase 4–5)

- `createSelfHealingExecutionRun()` — `branchName` = healing `branchPlan.branchName` (not source branch)
- `RUNTIME_SELF_HEALING_AUTO_CURSOR=1` — cursor enqueue + background pipeline chain

## Approval resume

`resumePipelineAfterApprovalViaWorker()` — `resumeScmAfterApproval: true`, reviewer/security skipped in handler.

## Runtime timeline

- In-memory `runtimeTimelineStore` + holder job → `executionEventLog` (`runtimeTimeline: true`, `execRunId`)
- Query: strict `isRuntimeTimelineEventForExecRun()`; legacy rows only if `RUNTIME_TIMELINE_INCLUDE_LEGACY_TASK_EVENTS=1`
- `runtime-timeline` jobs: **not claimable**, excluded from pending queue counts

## Legacy inline

Markers in `runExecutionLoop.ts`: `LEGACY_INLINE_NORMAL_TASK_ONLY_START` / `END`.  
Removal conditions: `LEGACY_INLINE_REMOVAL_CONDITIONS` in `legacyInlineNormalTaskExecution.ts`.

## ENV_TEST

Stage1/Stage2 remain on sync loop only.

## Modules

```text
cursorToPipelineChain.ts
runtimeSelfHealingExecution.ts
pipelineResumeAfterApproval.ts
runtimeEventPersistence.ts
executionJobTypes.ts (INTERNAL_NON_EXECUTABLE_JOB_TYPES)
legacyInlineNormalTaskExecution.ts
```

## Remaining follow-up

- Extract legacy inline into dedicated module
- Dedicated `RuntimeEvent` Prisma model
- Optional: process pipeline job immediately after chain enqueue
