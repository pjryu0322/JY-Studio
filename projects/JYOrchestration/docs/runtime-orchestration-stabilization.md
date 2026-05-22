# Runtime Orchestration Stabilization

## Path policy

| Task kind | Path |
|-----------|------|
| `ENV_TEST` / `ENV_TEST_STAGE2` | Sync `runExecutionLoop` (unchanged) |
| Normal Task (default) | Worker path |
| Normal Task (emergency) | Legacy inline (`EXECUTION_LOOP_FORCE_INLINE_CURSOR=1`) |

## Sync vs background chain (Phase 5–6)

| Path | Cursor | Reflection | Pipeline |
|------|--------|------------|----------|
| `runNormalTaskViaRuntimeWorkers` | sync job (`syncDispatch: true`) | inline in dispatch | sync job |
| `handleCursorExecutionJob` (background) | worker | `maybeChainCursorJobToPipeline` | idempotent enqueue + optional immediate process |

- `RUNTIME_CURSOR_CHAIN_PIPELINE=1` (default; set `0` to disable)
- `syncDispatch: true` on cursor payload → handler **skips** chain (no duplicate pipeline)
- `findExistingPipelineJobForExecRun()` — skip enqueue when pipeline exists for same `execRunId`+`taskId` (`PENDING`/`RUNNING`/`DONE`; `FAILED` blocks unless `RUNTIME_ALLOW_RECHAIN_AFTER_PIPELINE_FAILED=1`)
- `RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY=1` (default; set `0` to enqueue-only) — calls `processExecutionJobById` after chain enqueue; failures emit `CURSOR_PIPELINE_CHAIN_PROCESS_FAILED`

Self-healing auto cursor: `syncDispatch: false`, `chainSource: "self-healing"`, `selfHealingFromExecRunId` in payload and chain event detail.

## Self-healing (Phase 4–5)

- `createSelfHealingExecutionRun()` — `branchName` = healing `branchPlan.branchName` (not source branch)
- `RUNTIME_SELF_HEALING_AUTO_CURSOR=1` — cursor enqueue + background pipeline chain

## Approval resume

`resumePipelineAfterApprovalViaWorker()` — `resumeScmAfterApproval: true`, reviewer/security skipped in handler.

## Runtime timeline (Phase 6)

- In-memory `runtimeTimelineStore` + holder job → `executionEventLog` (`runtimeTimeline: true`, `execRunId`)
- Query: strict `isRuntimeTimelineEventForExecRun()`; legacy rows only if `RUNTIME_TIMELINE_INCLUDE_LEGACY_TASK_EVENTS=1`
- `dedupeRuntimeTimelineRows()` — memory + DB duplicate collapse in `listRuntimeTimelineForExecRun`
- `runtime-timeline` jobs: **not claimable**, excluded from pending queue counts

### RuntimeEvent persistence (Phase 6 decision)

**Plan B (current):** keep `runtime-timeline` holder `ExecutionJob` + `executionEventLog`. No Prisma migration in Phase 6.

**Plan A (follow-up):** dedicated `RuntimeEvent` model for search, retention, and multi-instance clarity.

## Legacy inline

Markers in `runExecutionLoop.ts`: `LEGACY_INLINE_NORMAL_TASK_ONLY_START` / `END`.  
Removal conditions: `LEGACY_INLINE_REMOVAL_CONDITIONS` in `legacyInlineNormalTaskExecution.ts`.

## ENV_TEST

Stage1/Stage2 remain on sync loop only.

## Modules

```text
cursorToPipelineChain.ts
pipelineChainIdempotency.ts
runtimeTimelineDedupe.ts
runtimeSelfHealingExecution.ts
pipelineResumeAfterApproval.ts
runtimeEventPersistence.ts
executionJobTypes.ts (INTERNAL_NON_EXECUTABLE_JOB_TYPES)
legacyInlineNormalTaskExecution.ts (LegacyInlineNormalTaskExecutionContext)
```

## Remaining follow-up

- Extract legacy inline block into `runLegacyInlineNormalTaskExecution()` (markers remain in `runExecutionLoop.ts`)
- Dedicated `RuntimeEvent` Prisma model (Plan A)
