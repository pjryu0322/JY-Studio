# Runtime Orchestration Stabilization

AI Team Runtime을 ExecutionJob 기반 Worker 구조로 점진 이전한다.

## Path policy (Phase 4)

| Task kind | Path |
|-----------|------|
| `ENV_TEST` / `ENV_TEST_STAGE2` | **Sync** `runExecutionLoop` (unchanged) |
| Normal Task (default) | **Worker** `runNormalTaskViaRuntimeWorkers` |
| Normal Task (emergency) | Legacy inline when `EXECUTION_LOOP_FORCE_INLINE_CURSOR=1` |

```text
Normal Task (default)
  → cursor job → reflection → pipeline job
  → approval_waiting → resumePipelineAfterApprovalViaWorker (pipeline resumeScmAfterApproval)

Review reject
  → triggerSelfHealingLite → AUTO_HEALING tasks
  → optional RUNTIME_SELF_HEALING_AUTO_CURSOR=1:
       createSelfHealingExecutionRun(healingTaskId)
       → cursor job (execRunId matches healing task)
```

## Self-healing execution run (Phase 4)

`createSelfHealingExecutionRun()` creates a **new** `TaskExecutionRun` per healing task so `loadCursorExecutionInvokeContext()` matches `execRunId` + `taskId`.

Events: `SELF_HEALING_EXEC_RUN_CREATED`, `SELF_HEALING_CURSOR_ENQUEUED`, `SELF_HEALING_CURSOR_ENQUEUE_FAILED`.

## Approval resume (Phase 4)

`resumePipelineAfterApprovalViaWorker()` — `runPipelineJobSynchronously({ resumeScmAfterApproval: true })`.  
Used from `runExecutionLoop` for normal tasks (not ENV_TEST, not legacy inline).

## Runtime timeline persistence (Phase 4)

**Decision: B+ (holder job, no new Prisma model)**

- `appendRuntimeEvent()` always records in-memory `runtimeTimelineStore`.
- Without `executionJobId`, events also persist via `executionEventLog` using a per-execRun **`runtime-timeline` holder `ExecutionJob`** (`runtimeEventPersistence.ts`).
- **Limitation:** in-memory store still lost on process restart; DB rows survive via holder job.
- **Future:** dedicated `RuntimeEvent` Prisma model for multi-instance / analytics.

`listRuntimeTimelineForExecRun()` priority: memory → progress log file → `executionEventLog` (filtered by `detailJson.execRunId`).

## Legacy inline isolation

`legacyInlineNormalTaskExecution.ts` — boundary marker + `EXECUTION_LOOP_FORCE_INLINE_CURSOR`.  
Inline cursor/review/scm/merge remains in `runExecutionLoop.ts` between `LEGACY_INLINE_NORMAL_TASK_ONLY` comments until e2e validation.

## Pipeline result codes

`pipelineResultCodes.ts` — `PIPELINE_RESULT_CODE`, `pipelineMessageForCode()`.

## ENV_TEST safety

Stage1/Stage2 stay on sync loop. Workers return `ENV_TEST_REQUIRES_SYNC_LOOP` if mis-enqueued.

## Modules (Phase 4 additions)

```text
runtimeSelfHealingExecution.ts
runtimeEventPersistence.ts
pipelineResumeAfterApproval.ts
legacyInlineNormalTaskExecution.ts
```

## Remaining follow-up

- Extract legacy inline block into `legacyInlineNormalTaskExecution.ts`
- Dedicated `RuntimeEvent` DB model
- Full self-healing auto-run after healing cursor completes
- E2E validation before removing inline fallback
