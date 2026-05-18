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

Reuses `ExecutionSetup.requireApprovalBeforeApply`. When true, review/security pass sets `approval_waiting` and **stops** the loop (`AWAITING_HUMAN`) before SCM/merge.

Resume: `POST /api/task/control` with `action: workflow-approve-ai-team-runtime` (or **AI팀 Runtime 승인** in latest-run panel), then re-run execution-loop for the same Task (`singleTaskId`) when `merge_pending` + `merge_running`.

SCM reuses existing PR from `prStatus` (`open:N:url`) or `findOpenPullRequestByHeadBranch` before creating a new PR.

## PR detection (normal Task)

PR detected after Cursor is recorded on `TaskExecutionRun.prStatus` only; flow continues to review/security (no `PR_OPENED` terminal). ENV_TEST family keeps `PR_OPENED` terminal success.

## Final validation (merge candidate)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | PASS |
| `tests/harness/ai-team-runtime/` | PASS (13) |
| `planningExecutionRunStatusPresentation.unit.test.ts` | PASS (3) |
| `projects.api.test.ts` | 미실행 (dev server 미기동 — ECONNREFUSED :3000) |
| GitHub PR mergeable | MERGEABLE ([#13](https://github.com/pjryu0322/JY-Studio/pull/13)) |

Manual E2E (Cursor Cloud, DB, real merge) remains operational validation.
