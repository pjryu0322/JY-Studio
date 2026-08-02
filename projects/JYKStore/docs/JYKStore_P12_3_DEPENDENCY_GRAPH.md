# JYKStore P12.3 — Dependency Graph

Structural dependency map after Worker ZIP / Workflow Marker complexity reduction.  
Scope: `projects/JYKStore/**` only. Policies (Snapshot, Facts, Publish, Retrieval, MCP, API, schema) unchanged.

| | SHA |
|---|---|
| Base (pre-P12.3) | `73b49a9e` |
| HEAD (facade split) | `8acc9f1c` |

---

## 1. Top-level layers

```text
UI / Routes / API
        │
        ▼
Application facades (stable import paths)
  • worker-zip-import-provider-service.ts
  • store-workflow-markers.ts
  • admin-review-service.ts (publishing + list)
        │
        ├──────────────────┬──────────────────┐
        ▼                  ▼                  ▼
 worker-zip/*        workflow/markers/*   workflow Snapshot stack
 (Request/Exec/      (Resolve/Loader/     Facts → Snapshot → Presenters
  Import/Provider)    Domain resolvers)
        │                  │                  ▲
        │                  └──────────────────┘
        │                     markersByPackId reuse
        ▼
 Prisma / PipelineRun / SearchIndexGeneration / S3 / Python Worker
```

---

## 2. Worker ZIP import graph

### 2.1 Module map (responsibility)

| Module | Role (P12.3 target) |
|---|---|
| `worker-zip-import-provider-service.ts` | **Facade** — re-export only |
| `worker-zip/index.ts` | Barrel |
| `request-lifecycle.ts` | **Request** — submit / accept / reject / withdraw |
| `pack-resolvers.ts` | **Request** — pack ownership / draft resolve |
| `admin-execution.ts` | **Execution** — admin generation run orchestration |
| `import-run.ts` | **Import** — documents / chunk / vector / index pipeline bind |
| `generation-transitions.ts` | **Transaction** — generation status transitions |
| `admin-hold.ts` / `admin-inbox.ts` | **Provider** — hold phase, list progress/status |
| `errors.ts` / `constants.ts` | Shared |

### 2.2 Internal edges (acyclic)

```text
index → (barrel exports)

admin-execution
  → import-run
  → pack-resolvers
  → errors, constants

import-run
  → pack-resolvers
  → generation-transitions
  → errors
  → (external) worker pipeline / generation bridge / successor-reset

request-lifecycle
  → admin-hold
  → pack-resolvers
  → errors, constants

admin-inbox
  → store-workflow-markers (batchResolve)
  → admin-work-inbox-view-model
  → constants

admin-hold → constants
pack-resolvers → errors
```

**Cycle check:** no A↔B cycles among `worker-zip/*` modules. DAG only (execution → import → transitions; lifecycle → hold).

### 2.3 External consumers (unchanged paths)

```text
API / jobs / tests
  → @/lib/python-worker/worker-zip-import-provider-service
  → @/lib/python-worker (re-exports)
```

---

## 3. Workflow Marker import graph

### 3.1 Module map

| Module | Domain / role |
|---|---|
| `store-workflow-markers.ts` | **Facade** |
| `markers/index.ts` | Barrel |
| `markers/resolve.ts` | **Batch Loader** + marker snapshot resolve |
| `markers/types.ts` / `constants.ts` | Shared types / triggers |
| `markers/provider-review.ts` | ProviderReview mutations |
| `markers/service-validation.ts` | ServiceValidation marker |
| `markers/supplement.ts` | Correction / supplement |
| `markers/publish-binding.ts` | Publish binding / generation evidence |
| `markers/admin-returned-queue.ts` | Returned-queue projection (labels via inbox VM) |

Receipt / KnowledgeScope / Generation markers remain **Facts-side** (PipelineRun ZIP phases + inventory), not separate mutation modules — resolvers for those domains live in Facts loader + Snapshot, not in Marker mutation files.

### 3.2 Internal edges

```text
index → resolve | provider-review | service-validation | supplement
      | publish-binding | admin-returned-queue | types | constants

provider-review → resolve, publish-binding, constants, types
service-validation → resolve, constants, types
publish-binding → resolve, constants, types
supplement → provider-review, types
admin-returned-queue → constants, types (+ inbox view-model)
resolve → constants, types
```

**Cycle check:** `supplement → provider-review` is one-way. No cycles. Domain mutation modules do **not** import each other except supplement → provider-review (re-request after supplement).

### 3.3 Marker → Facts → Snapshot (Facts Adapter path)

```text
batchResolveStoreWorkflowMarkers (Loader)
        │
        ▼ optional markersByPackId
batchLoadPackWorkflowFacts          ← Facts Adapter / loader
        │
        ▼
buildPackWorkflowSnapshot           ← SoT (Step / Action / Gate / Blocking)
        │
        ▼
toPackWorkflowRuntimeSummary        ← Inbox presentation slice
```

**Duplicate-query mitigation (P12.3-5):**

- `listReviewingPacks` resolves markers once, passes `markersByPackId` into `batchAttachInboxWorkflow` → `batchLoadPackWorkflowFacts`.
- Without the option, Facts loader would call `batchResolveStoreWorkflowMarkers` again (3× findMany).

---

## 4. Snapshot / Publishing / Worker cross-graph

```text
                    ┌─────────────────────┐
                    │ PackWorkflowSnapshot│ ← pure SoT
                    └──────────▲──────────┘
                               │
                    PackWorkflowFacts (typed)
                               ▲
              ┌────────────────┴────────────────┐
              │                                 │
     markers/resolve                     worker-zip phases
     (providerReview,                    (receipt / generation)
      serviceValidation,                 via PipelineRun
      supplement)                        + import-run
              │                                 │
              └────────────┬────────────────────┘
                           ▼
                    Publishing policies
                    (identity / eligibility)
                           ▲
                    admin-review-service facade
```

Worker does **not** import Snapshot. Markers do **not** import Snapshot. Snapshot consumes marker-derived Facts only.

---

## 5. Presentation residual edges (not SoT)

| Symbol | File | Depends on Snapshot? | Notes |
|---|---|---|---|
| `mapQueuePresentation` | `admin-work-inbox-view-model.ts` | No | Label / queue-group map from marker **phases** |
| `getNextReviewAction` | `admin-review-rail.ts` | No | Still calls gate helpers (`canEnter*`, `canPublish`) |
| `filterAdminWorkQueue` | `admin-work-inbox-view-model.ts` | Prefers `workflow.currentStep` | Snapshot-first when attached |
| `AdminProviderReviewPanel` | component | No | Uses `canRequestProviderReviewHandoff` + marker phases |

See Complexity Report § Remaining Technical Debt and Evidence § Presentation / Provider Review.

---

## 6. Cycle summary

| Subgraph | Cycles |
|---|---|
| `worker-zip/*` | **None** |
| `workflow/markers/*` | **None** |
| Worker ↔ Markers | Markers used by admin-inbox only (one-way) |
| Markers ↔ Snapshot | Via Facts loader only (one-way) |
| Facades ↔ modules | Facades re-export; no reverse import into facade body |

---

## 7. Facade contract

| Stable path | Implementation |
|---|---|
| `@/lib/python-worker/worker-zip-import-provider-service` | `export * from "./worker-zip"` |
| `@/lib/store-workflow-markers` | `export * from "@/lib/workflow/markers"` |

Call sites keep pre-P12.3 import paths; no API contract change.
