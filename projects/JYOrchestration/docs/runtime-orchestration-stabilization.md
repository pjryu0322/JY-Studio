# Runtime Orchestration Stabilization

## Path policy

| Task kind | Path |
|-----------|------|
| `ENV_TEST` / `ENV_TEST_STAGE2` | Sync `runExecutionLoop` (unchanged) |
| Normal Task (default) | Worker path (`runNormalTaskViaRuntimeWorkers`) |
| Normal Task (emergency) | `runLegacyInlineNormalTaskExecution()` when `EXECUTION_LOOP_FORCE_INLINE_CURSOR=1` |

## Phase 7 — Runtime Worker E2E / RuntimeEvent / Legacy Inline

### E2E scenarios (automated)

| Scenario | Test file |
|----------|-----------|
| Normal task worker path | `runtimeWorkerE2E.integration.test.ts` |
| Background cursor → pipeline chain | same + `cursorToPipelineChain.unit.test.ts` |
| Review reject → self-healing | same + `runtimeSelfHealingBridge.unit.test.ts` |
| Approval resume (worker SCM) | same + `pipelineResumeAfterApproval` |
| ENV_TEST protection | `runExecutionLoopPathSelection.unit.test.ts` |
| Legacy inline boundary | `legacyInlineNormalTaskExecution.unit.test.ts` |

State consistency: `validateRuntimeStateConsistency()` in `runtimeStateConsistency.ts`.

### RuntimeEvent model (Plan A — active)

- Prisma `RuntimeEvent` → table `runtime_events`
- `createRuntimeEvent()` / `listRuntimeEventsForExecRun()` in `runtimeEventRepository.ts`
- `appendRuntimeEvent()` writes: progress log + memory store + **RuntimeEvent table**
- Compat: `RUNTIME_EVENT_COMPAT_EXECUTION_LOG=1` (default) still mirrors to `executionEventLog` via deprecated holder job path
- Holder job (`runtime-timeline`) is **deprecated** — not used when compat writes through `persistRuntimeEventToExecutionLog` only if compat on; primary timeline query uses `runtime_events` first

Timeline merge order in `listRuntimeTimelineForExecRun()`:

1. `runtime_events` table  
2. in-memory `runtimeTimelineStore`  
3. progress log file  
4. `executionEventLog` (compat, if `RUNTIME_EVENT_COMPAT_EXECUTION_LOG≠0`)

### Legacy inline extraction

- `runLegacyInlineNormalTaskExecution()` — normal tasks only; rejects ENV_TEST
- `runExecutionLoop` dispatches to this module before the monolithic ENV_TEST sync block when `FORCE_INLINE` + normal task
- Uses sync worker modules (cursor/reflection/pipeline) as emergency fallback
- ENV_TEST Stage1/Stage2 code remains in `runExecutionLoop.ts`

## Sync vs background chain (Phase 5–6)

| Path | Cursor | Reflection | Pipeline |
|------|--------|------------|----------|
| `runNormalTaskViaRuntimeWorkers` | sync job (`syncDispatch: true`) | inline in dispatch | sync job |
| `handleCursorExecutionJob` (background) | worker | `maybeChainCursorJobToPipeline` | idempotent enqueue + optional immediate process |

- `RUNTIME_CURSOR_CHAIN_PIPELINE=1` (default; set `0` to disable)
- `findExistingPipelineJobForExecRun()` — duplicate pipeline guard
- `RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY=1` (default; set `0` to enqueue-only)

## Environment variables

| Variable | Default | Meaning | Ops recommendation | Test |
|----------|---------|---------|-------------------|------|
| `EXECUTION_LOOP_FORCE_INLINE_CURSOR` | off | Emergency legacy inline (sync worker modules) | off in production | `=1` for legacy path tests |
| `RUNTIME_CURSOR_CHAIN_PIPELINE` | on (`≠0`) | Background cursor → pipeline chain | on | `=0` to disable chain |
| `RUNTIME_PROCESS_CHAINED_PIPELINE_IMMEDIATELY` | on | Process pipeline job right after chain enqueue | on unless dedicated worker fleet | `=0` enqueue-only |
| `RUNTIME_ALLOW_RECHAIN_AFTER_PIPELINE_FAILED` | off | Allow new pipeline after FAILED | off | `=1` for rechain tests |
| `RUNTIME_SELF_HEALING_AUTO_CURSOR` | off | Auto cursor on healing tasks | enable when healing automation desired | `=1` |
| `RUNTIME_EVENT_COMPAT_EXECUTION_LOG` | on | Mirror events to `executionEventLog` | on during migration | `=0` for RuntimeEvent-only |
| `RUNTIME_TIMELINE_INCLUDE_LEGACY_TASK_EVENTS` | off | Include legacy task rows in timeline | off | `=1` for legacy UI |

**Risk:** `FORCE_INLINE` bypasses default worker routing; use only for incident response.

## Modules

```text
runtimeEventRepository.ts
runtimeStateConsistency.ts
runtimeWorkerE2E.integration.test.ts
legacyInlineNormalTaskExecution.ts
cursorToPipelineChain.ts
pipelineChainIdempotency.ts
runtimeTimelineDedupe.ts
```

## Remaining follow-up

- Extract ENV_TEST-only monolithic block from `runExecutionLoop.ts` into dedicated modules
- Remove holder-job compat path after `runtime_events` backfill
- Production soak: 3+ normal-task runs without `FORCE_INLINE`
