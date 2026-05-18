# AI Team Execution Runtime — Minimal State Model

## Storage choice (Option B)

Legacy `TaskExecutionRun.status` remains (`running`, `reviewing`, `done`, `failed`, …) for existing UI and ENV_TEST flows.

AI Team phase tracking uses additive column:

```text
TaskExecutionRun.teamExecutionStatus
```

Healed at runtime via `ensureTaskExecutionRunColumnsReady()` when DB lags Prisma schema.

## Standard phases

See `apps/web/src/lib/ai-team-runtime/status.ts` — `requested` through `completed` / `failed`, including `reflection_waiting` for Git reflection gate (`pending_apply`).

## Wiring

| Layer | Role |
|-------|------|
| `runExecutionLoop.ts` | Normal Task path updates `teamExecutionStatus` at Cursor / review / merge milestones |
| `evaluationReviewerSteps` | Reviewer vs `security-reviewer` parsed in `reviewerSteps.ts` (Option A — no new ProjectMemberAction rows in v1) |
| `GET .../execution-runs` | Additive `teamRuntime` / `teamRuntimeStatus` on each row |
| `POST .../execution-loop` | Additive `data.teamRuntime` from latest run |

## Boundaries

- **Not** Harness H/Phase read-only validation.
- **Not** applied to ENV_TEST Stage1/Stage2 canonical paths (legacy `status` only).
- **Distinct** from Task DAG `EXECUTION_WORKFLOW.*`.

## Approval policy

Reuses `ExecutionSetup.requireApprovalBeforeApply` for `approval_waiting` metadata when review/security pass (does not block existing auto-merge unless review/security fails).
