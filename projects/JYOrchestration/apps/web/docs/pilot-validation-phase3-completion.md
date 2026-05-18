# Pilot Validation Phase 3 — Orchestration Completion Milestone

## Completion scope

The following read-only orchestration validation chain is considered **first complete** at Phase 3:

```text
H20.5 ~ H45.5
→ Pilot Validation Phase 0 (read-only chain summary)
→ Pilot Validation Phase 1 (user-visible review UI contract)
→ Pilot Validation Phase 1.5 (UI wiring: /pilot-validation?projectId=)
→ Pilot Validation Phase 2 (Safe Echo adapter contract + sandbox dry-run boundary)
→ Pilot Validation Phase 3 (validation request draft + operator approval snapshot + audit/rollback candidates)
```

**Note:** Prompt materials may refer to “Phase 1.75”; in this repository that scope is covered by **Phase 1.5** (diagnostic API wiring and action policy).

## What is complete

- Runtime planning reports for Phase 0~3 are generated in order without re-running H20.5~H45.5 builders.
- `GET /api/diagnostics/overlay-runtime?projectId=&audienceMode=user` includes Phase 0~3 fields additively.
- Users can open `/pilot-validation?projectId=` and see validation readiness, request draft, approval snapshot, audit trace, and rollback plan **metadata**.
- Overlay shows the same Phase 3 statuses for operators.
- Prohibited operations and contract boundaries explicitly forbid adapter/sandbox/runner invocation, Git push, merge, deploy, and DB migration.

## What is not included (by design)

- No actual pilot activation, execution, adapter invocation, sandbox invocation, or runner invocation.
- No actual approval enforcement, rollback execution, or release enforcement.
- No Git push, PR merge, deploy, or Prisma/DB changes from this flow.

## After Phase 3

Phase 4+ (e.g. Safe Echo invocation **simulator** contract) are **optional extensions** for richer metadata and UI—not required for the Phase 3 completion line. Connecting a real Safe Echo adapter is a separate product decision.

## Verification

Automated checks:

- `tests/harness/runtimePilotValidation/runtimePilotValidationPhase3CompletionVerification.unit.test.ts`
- `tests/components/PilotValidationReviewRouteClient.unit.test.ts`

Manual URL:

```text
/pilot-validation?projectId=<projectId>
```
