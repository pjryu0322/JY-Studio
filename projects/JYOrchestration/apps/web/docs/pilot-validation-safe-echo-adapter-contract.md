# Pilot Validation — Safe Echo Adapter Contract (Phase 2)

## Purpose

Phase 2 defines **read-only** Safe Echo Adapter input/output contracts and Sandbox dry-run boundary metadata. No actual adapter, sandbox, runner, or pilot execution occurs.

## Input contract

- `runtimeSafeEchoAdapterInputContract` lists required inputs (projectId, validation status, final gate metadata, approval/rollback/audit snapshots).
- `prohibitedInputPayloads` blocks source patches, git/deployment/DB commands, shell/runner commands, adapter/sandbox payloads, routing/queue instructions.

## Output contract

- `runtimeSafeEchoAdapterOutputContract` expects metadata-only outputs (validation accepted/rejected, echoed hash, audit/rollback candidates).
- `prohibitedOutputs` blocks file changes, git push, PR merge, deployment, DB migration, runner/adapter/sandbox/execution results.

## Sandbox dry-run boundary

- `runtimeSandboxDryRunBoundary` scopes allowed metadata-only scopes and forbids actual invocation, routing, enforcement, mutations, git push, merge, deployment, DB migration.

## Operator approval & audit

- `operatorApprovalRequiredBeforeInvocation: true`
- `auditTraceRequired: true`
- `rollbackPlanRequired: true`

## Actual execution prohibition

All contract objects set `actualAdapterInvocationEnabled`, `actualSandboxInvocationEnabled`, `actualDryRunRunnerInvocationEnabled`, `actualPilotExecutionEnabled`, and `actualExecutionEnabled` to `false`.

## Next phase

Phase 4 — Safe Echo Adapter Invocation Simulator Contract. See `pilot-validation-safe-echo-simulator-contract.md`.
