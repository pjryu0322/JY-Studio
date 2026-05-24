# Platform Orchestration Foundation

Phase 1 foundation for JYOrchestration platform-wide orchestration. This layer adds **shared contracts and pure helpers** only; existing SingleChat, fast plan, service-flow, and execution paths are unchanged.

## 1. Purpose

JYOrchestration must not grow separate “planning orchestration”, “fast plan orchestration”, and “execution orchestration” silos. Phase 1 defines a single **Platform Orchestration Run Contract** plus **Project AI Team** and **Role ↔ Knowledge Pack** models so later phases can wrap existing pipelines with adapters.

## 2. Platform vs Generated Project Boundary

| Concept | Meaning |
|--------|---------|
| **Platform** | JYOrchestration itself: AI team, orchestration, slots, Cursor/GitHub control |
| **Generated project** | Service/prototype artifacts the platform produces |
| **Platform orchestration** | How the platform directs AI members and tools |
| **Generated project workflow** | End-user/system flows inside the delivered service |

Platform AI members and roles must not be confused with actors inside a generated service.

## 3. Platform Run Contract

Location: `apps/web/src/lib/platform-orchestration/types.ts`

Core types:

- `PlatformFlowId` — e.g. `single_chat_turn`, `fast_plan_draft`, `execution_runtime`
- `PlatformOrchestrationTrigger` — ingress (source, scope, payload)
- `PlatformMemberRun` / `PlatformMemberDraft` — per-role execution units and drafts
- `PlatformStatePatch` — domain patches (`requirements_state`, `fast_plan`, …)
- `PlatformTimelineEvent` / `PlatformNextAction` — observability and UI wires
- `PlatformRunResult` — normalized envelope returned by future adapters

Factories: `apps/web/src/lib/platform-orchestration/runResultFactory.ts`

## 4. Project AI Team / Role / Capability

- **Roles & capabilities:** `roles.ts` — `PLATFORM_ROLE_DEFINITIONS`, core vs extended roles
- **Team config:** `projectAiTeam.ts` — `ProjectAiTeamConfig`, `evaluateFlowRoleReadiness`
- **Flow requirements:** e.g. `prototype_generation` and `execution_runtime` require `developer`

## 5. Role-based Knowledge Pack Binding

Location: `knowledgeBinding.ts`

Resolution order (deduplicated):

```text
role bindings → project bindings → member overrides → flow packs
```

Knowledge packs bind to **roles**, not individual AI members. Members may override packs for specialization.

## 6. Flow Role Readiness

Use `evaluateFlowRoleReadiness({ flowId, team })`:

- `prototype_generation` → `ready: false` without `developer`
- `execution_runtime` → `ready: false` without `developer`
- `fast_plan_draft` → requires `planner`; recommends analyst, architect, designer

## 7. Phase 1 Scope

Included:

- Types, constants, pure helpers, unit tests, this document
- No changes to existing routers, UI, DB, or execution loop

## 8. Phase 2 — fast_plan_draft (implemented)

- `runFastPlanDraftFlow` — `apps/web/src/lib/platform-orchestration/flows/fastPlanDraftFlow.ts`
- SingleChat CTA: **AI팀 빠른 기획 초안 받기** → member drafts message + `fastPlanDraftV1` in stateJson
- **이 초안으로 빠른 기획안 생성** → existing `generateFastPlanFromCurrentContext` (artifact)

When `projectAiTeam` is null, `defaultProjectAiTeamConfig()` enables the core platform roles.

## 9. Not Implemented Yet

- DB persistence for `PlatformRunResult` (beyond stateJson)
- Full feedback loop: user edits → memberDraft/slot refinement
- Execution runtime alignment with requirements state
- Platform timeline UI

Next phase (suggested): Planning-Service-Feature flow alignment.
