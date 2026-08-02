# JYKStore P12.3 — Dependency Graph (Final Hardening)

| | SHA |
|---|---|
| Base (pre-final) | `fca939c0` |
| Work / HEAD | `ba868317` |

---

## 1. Manual analysis (structural)

```text
Facades
  worker-zip-import-provider-service.ts → worker-zip/*
  store-workflow-markers.ts → workflow/markers/*

Worker ZIP
  request-lifecycle/*  (submit, withdraw, accept, reject, rejection-response, state-query, policy)
  admin-execution/*    (prepare → execute → finalize/fail; thin run-admin-generation orchestrator)
  import-run / admin-inbox / admin-hold / pack-resolvers

Markers
  resolve.ts (batch loader)
  provider-review / service-validation / publish-binding / admin-returned-queue
  supplement/* (admin-decision, clarification, note, withdraw, review-reentry, policy)

Facts → Snapshot (SoT)
  markersByPackId reuse → batchLoadPackWorkflowFacts → buildPackWorkflowSnapshot
```

### Forbidden edges (manual)

| Edge | Status |
|---|---|
| module → facade reverse | **None** |
| marker → snapshot | **None** |
| worker → snapshot | **None** |
| domain → React | **None** |
| UI → Prisma | **None** (routes/services only) |

---

## 2. Automated cycle check

Tool: `madge` (`npx madge --extensions ts,tsx --circular <path>`)

| Scope | Files processed | Result | Exit |
|---|---:|---|---:|
| `src/lib/python-worker/worker-zip` | 24+ (post-split) | **No circular dependency** | 0 |
| `src/lib/workflow/markers` | 17+ | **No circular dependency** | 0 |
| `src/lib/workflow` | 24 | **No circular dependency** | 0 |
| `src/lib/publishing` | 10 | **No circular dependency** | 0 |
| `src/lib/admin-work-inbox` | 4 | **No circular dependency** | 0 |
| Combined worker-zip + markers (post-hardening) | 41 | **No circular dependency** | 0 |

```text
Circular dependency = 0
```

---

## 3. New module graphs (post-hardening)

### request-lifecycle/

```text
index → submit-request | withdraw-request | admin-accept | admin-reject
      | rejection-response | request-state-query | types | request-status-policy

submit / withdraw / accept / reject / rejection-response
  → pack-resolvers, admin-hold, errors, constants (as needed)
request-state-query → request-status-policy, admin-hold
```

### admin-execution/

```text
index → run-admin-generation (+ types)

run-admin-generation (orchestrator)
  → prepare-admin-generation
  → execute-worker-run
  → finalize-generation | fail-generation

execute-worker-run → import-run
prepare → pack-resolvers, storage helpers
```

### markers/supplement/

```text
index → admin-decision | clarification | note | withdraw | review-reentry | policy | request | types
review-reentry → provider-review (one-way)
```

---

## 4. Presentation residual edges

| Symbol | Class | Notes |
|---|---|---|
| `presentNextAdminAction` | LABEL_ONLY | Snapshot/runtime → CTA labels |
| `getNextReviewAction` | LABEL_ONLY | **Requires** snapshot/runtime; no gate re-judgment |
| `mapQueuePresentation` | LABEL_ONLY / COMPATIBILITY | Phase → inbox chrome strings |
| `filterAdminWorkQueue` | FILTER_ONLY | Prefers `workflow.currentStep` |
| `getAdminReviewRailState` | COMPATIBILITY | Still uses gate helpers for rail item status (not next-action SoT) |
| `AdminProviderReviewPanel` | Snapshot CTA + local ack | `canRequestFromSnapshot` from `availableActions` |

---

## 5. Query reuse path

```text
worker-zip-requests GET
  resolveWorkflowMarkers (shared Map)
  → listAdminWorkerZipRequests
  → batchAttachInboxWorkflow({ markersByPackId })
  → batchLoadPackWorkflowFacts (skips marker re-query)

listReviewingPacks
  batchResolve once → markersByPackId → batchAttachInboxWorkflow
```
