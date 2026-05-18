# Pilot Validation — Safe Echo Invocation Simulator Contract (Phase 4)

## Purpose

Phase 4 defines **read-only** Safe Echo Adapter Invocation Simulator contract metadata. Validation request draft, approval snapshot, audit trace, and rollback plan candidates are transformed into simulator input/output/boundary reports without any actual adapter, sandbox, or runner invocation.

## Reports

- `runtimeSafeEchoInvocationSimulatorSummary` — simulator status, mode, rationale, blockers/warnings
- `runtimeSafeEchoInvocationSimulatorInput` — accepted/rejected input rows and required approval/audit/rollback metadata
- `runtimeSafeEchoInvocationSimulatorOutput` — expected simulation outputs and prohibited outputs (metadata only)
- `runtimeSafeEchoInvocationSimulatorBoundary` — allowed scopes and forbidden simulator operations

## Status resolution

- `simulator_contract_ready` when draft, approval, audit, rollback, and Safe Echo contract are ready (approval `review_required` maps to `watch`, not ready)
- `watch` when any upstream layer is in watch/review or warnings exist
- `blocked` when any upstream layer is blocked or draft blockers exist
- `not_ready` otherwise

## Actual invocation prohibition

All simulator objects set `actualAdapterInvocationEnabled`, `actualSandboxInvocationEnabled`, `actualDryRunRunnerInvocationEnabled`, `actualPilotExecutionEnabled`, and `actualExecutionEnabled` to `false`. Boundary flags `simulationDoesNotInvokeAdapter`, `simulationDoesNotInvokeSandbox`, and `simulationDoesNotInvokeRunner` are `true`.

Simulation output rows are **expected metadata contract** only — not real execution results.

## UI

User panel and overlay show simulator contract status, mode, and a no-invocation notice. Wording avoids implying execution (“시뮬레이터 실행됨”, “Adapter 호출됨”, etc.).

## Next phase

Phase 5 may add simulator preview UI or request review modal (still read-only until explicitly scoped).
