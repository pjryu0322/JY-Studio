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

## Phase 8 — RuntimeEvent alignment + Branch/Project naming

### RuntimeEvent schema

- `packages/db/schema.prisma` — `model RuntimeEvent` + `Project.runtimeEvents`
- Migration: `packages/db/migrations/20260519180000_runtime_events`
- `appendRuntimeEvent()` logs persist failures via `console.warn` (does not fail execution)
- **Primary:** `runtime_events` table | **Compat mirror:** `executionEventLog` when `RUNTIME_EVENT_COMPAT_EXECUTION_LOG=1` | **Deprecated:** `runtime-timeline` holder job

### Branch / project naming

- `branchSlug.ts` — `toSafeBranchSlug()`, `EXECUTION_ALLOW_MANUAL_STAY_ON_BASE`
- `computeExecutionBranchPlan({ projectName, ... })`:
  - ENV_TEST: unchanged `envcheck/t-hello-world-{8hex}`
  - feature-per-workflow: `{prefix}/{projectSlug}/w-{shortProjectId}`
  - feature-per-task / per_task: `{prefix}/{projectSlug}/t-{shortTaskId}-{titleSlug}`
  - manual (default): `{prefix}/manual/t-{shortTaskId}-{titleSlug}` — never `main` unless `EXECUTION_ALLOW_MANUAL_STAY_ON_BASE=1`
- Call sites: `runExecutionLoop`, `cursorExecutionJobInvoke`, `runtimeSelfHealingExecution`
- Tests: `branchPolicy.unit.test.ts`, `branchSlug.unit.test.ts`

### ENV_TEST vs legacy boundary

| Path | Module |
|------|--------|
| Normal + default | `normalTaskWorkerDispatch` |
| Normal + `FORCE_INLINE` | `legacyInlineNormalTaskExecution` |
| ENV_TEST sync | `runExecutionLoop` (`envTestSyncExecution.ts` context type; extraction TODO) |

## Environment variables (branch)

| Variable | Default | Meaning |
|----------|---------|---------|
| `EXECUTION_ALLOW_MANUAL_STAY_ON_BASE` | off | `manual` strategy uses `baseBranch` directly (legacy) |

## Git Repository Provisioning MVP

API: `POST /api/projects/[projectId]/git-repository/provision`

| action | Purpose |
|--------|---------|
| `prepare` | Project name → repo candidate, GitHub lookup, analysis, `nextActions` |
| `create_and_bind` | Create repo if missing (explicit), bind `ExecutionSetup` |
| `analyze_existing` | Read-only structure analysis |
| `bind_existing` | Connect existing repo (`confirmExistingRepo: true`) |

Modules:

```text
apps/web/src/lib/git-provisioning/repoNamePolicy.ts
apps/web/src/lib/git-provisioning/githubRepoLookup.ts
apps/web/src/lib/git-provisioning/githubRepoCreate.ts
apps/web/src/lib/git-provisioning/githubRepoAnalyzer.ts
apps/web/src/lib/git-provisioning/gitRepositoryProvisioningService.ts
```

Policies:

- Repo creation only via explicit `create_and_bind` (no delete/force-push/init wipe)
- `feature-per-task` + `branchPrefix: orch` on bind
- GitHub token from project `ExecutionSetup` or peer project (same owner, validated)
- Token never returned in API responses

## RuntimeEvent schema (verified)

- `packages/db/schema.prisma` — `model RuntimeEvent`
- Migration: `packages/db/migrations/20260519180000_runtime_events`

## Remaining follow-up

- Move ENV_TEST monolithic block from `runExecutionLoop.ts` into `envTestSyncExecution.ts`
- Remove holder-job compat path after `runtime_events` backfill
- Org-owned GitHub repo creation (currently personal `/user/repos` MVP)
- Production soak: 3+ normal-task runs without `FORCE_INLINE`
