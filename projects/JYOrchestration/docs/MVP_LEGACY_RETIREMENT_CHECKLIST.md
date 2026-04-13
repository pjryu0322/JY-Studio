# MVP engine — legacy retirement checklist (internal)

This document defines **when** isolated legacy/demo surfaces inside `projects/JYOrchestration` may be removed or folded into the target path. It does **not** authorize deleting production `apps/web` code or modifying Stage1/Stage2 orchestration.

## Protected (out of scope for this package)

- **Stage1 / Stage2** — live under `apps/web` (e.g. `lib/execution`, `lib/executionLoop`). **Do not** change their behavior from `JYOrchestration` work items.
- **ProjectSpec / Prisma task pipeline** — production product surface; retirement here is independent.

## Target architecture (keep and extend)

| Area | Role |
|------|------|
| `src/mvp/execution/executionService.ts` | **Frozen core** sequential engine (ports bundle); behavior changes only with explicit migration plan. |
| `src/mvp/orchestration/mvpOrchestrationFacade.ts` | **Preferred** run/read entry (readiness + DTOs). |
| `src/mvp/domain/`, `src/mvp/screen/` | Requirement → Feature → IA → Screen → Task + flow prep. |
| `src/mvp/prompt/`, `src/mvp/reviewer/` | Prompt + review contracts (extend behind self-check). |
| `src/mvp/ports/`, `src/mvp/contracts/`, `src/mvp/runtime/` | Hex ports, DTOs, bundle injection. |
| `src/application/` | **Default** entry for future HTTP/routes: use-cases + `MvpExecutionApplicationService`. |

## Legacy / transitional (inside `JYOrchestration`)

| Area | Role |
|------|------|
| `src/mvp/legacy/exampleFlow.ts` | Demo helpers calling `startRun` without facade. |
| `src/application/usecases/requirement/mvpLegacyProjectSpecToRequirements.ts` | Bridge from blob spec text → single `MvpRequirement`. |
| Direct `startRun` / `getRunStatus` in **new** app code | Prefer facade or application use-cases. |

---

## Retirement criteria (minimum before removing legacy folder / demo entry)

Check each box when true **and** covered by `runMvpSelfCheck()` (or an agreed test harness).

- [ ] **Requirement-input generation** — `createRequirementsFromInput` + `mvpPrepareMockupFromRequirementInputUseCase` stable; no mandatory ProjectSpec in this package’s canonical path.
- [ ] **Feature / IA / Screen / Task flow** — domain pipeline complete for target scenarios; mapping validation green.
- [ ] **Prompt / reviewer parity** — screen-flow and flow-validation gates covered; legacy task path unchanged.
- [ ] **Run / retry / review / status parity** — facade + application layer match engine for summaries, detail, inspection, structured failures.
- [ ] **Self-check coverage** — extended for each new public contract; no regressions on frozen `executionService` behavior.
- [ ] **Consumers migrated** — no remaining imports of `legacy/exampleFlow` from outside demos/tests (grep monorepo).
- [ ] **Explicit sign-off** — product owner / architect approves deleting demos only after production path uses target stack.

Until all criteria are met: **do not delete** `legacy/`; **do not** change `executionService` semantics for “cleanup.”

---

## Minimal safe refactor plan (incremental)

1. **Label** — Comments + this checklist + `legacy/README.md` (done as baseline).
2. **Default new work** — Add routes/services only under `src/application/` + `src/mvp/` target paths; avoid extending `legacy/exampleFlow`.
3. **Migrate demos** — Replace in-repo demo callers to use `mvpStartRunIfReady` / application `startRun` when convenient (behavior-preserving).
4. **Remove** — Delete `src/mvp/legacy/` only after checklist complete and grep-clean.
