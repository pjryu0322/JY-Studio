# JYKStore P12.3 — Complexity Report

Complexity reduction for Worker ZIP Import + Store Workflow Markers.  
**Change class:** structural split only (no Workflow / Publish / Snapshot / API / schema policy change).

| | SHA |
|---|---|
| Base | `73b49a9e` |
| HEAD | `8acc9f1c` |

Measurement: physical line counts (`Get-Content` / git blob line count). Function metrics: top-level `function` / exported `const = (` starters with brace-depth length estimate.

---

## 1. Before / After

### 1.1 Worker ZIP Import

| Metric | Before | After |
|---|---:|---:|
| Facade file LOC | 2,378 (`worker-zip-import-provider-service.ts`) | **24** (re-export facade) |
| Implementation files | 1 | **10** (`worker-zip/*`) |
| Implementation LOC (sum) | 2,378 | **2,480** (+headers/barrels) |
| Exported/top-level functions (approx) | 20 | 20 |
| Avg function length | ~93.8 | ~94.0 |
| Max function length | 466 | 466 (`admin-execution`) |
| Module count (impl) | 1 | **10** |

Facade LOC collapse is the primary complexity win for navigation / ownership. Total LOC slightly up due to module headers + `index.ts` barrel.

### 1.2 Workflow Markers

| Metric | Before | After |
|---|---:|---:|
| Facade file LOC | 1,458 (`store-workflow-markers.ts`) | **18** (re-export facade) |
| Implementation files | 1 | **9** (`workflow/markers/*`) |
| Implementation LOC (sum) | 1,458 | **1,589** |
| Exported/top-level functions (approx) | 22 | 22 |
| Avg function length | ~50.1 | ~50.2 |
| Max function length | 177 | 177 (`admin-returned-queue`) |
| Resolver / domain modules | 1 monolith | resolve + provider-review + service-validation + supplement + publish-binding + admin-returned-queue |
| Loader | inlined | `resolve.ts` (`batchResolveStoreWorkflowMarkers`) |
| Facts Adapter hook | N/A | `markersByPackId` option on Facts / inbox attach |

### 1.3 Combined hotspot files

| | Before | After |
|---|---:|---:|
| Megafile count (Worker + Marker entry) | 2 | 2 thin facades |
| Largest single implementation file | 2,378 | **755** (`request-lifecycle.ts`) |
| Files touching Worker+Marker split | 2 | **21** (2 facades + 19 modules) |

---

## 2. Hotspot

### Worker

| File | LOC | Notes |
|---|---:|---|
| `request-lifecycle.ts` | 755 | Still largest — Request concern cluster |
| `admin-execution.ts` | 526 | Execution orchestration |
| `admin-inbox.ts` | 396 | Provider list / progress |
| `import-run.ts` | 393 | Import pipeline bind |

**P13 candidate:** further split `request-lifecycle` (submit vs admin accept/reject vs withdraw) and shrink `admin-execution` max function (466).

### Marker

| File | LOC | Notes |
|---|---:|---|
| `supplement.ts` | 442 | Correction / supplement actions |
| `provider-review.ts` | 282 | Request / confirm / withdraw |
| `resolve.ts` | 279 | Batch loader + phase mapping |
| `admin-returned-queue.ts` | 200 | Queue projection |

**P13 candidate:** extract supplement note/withdraw/re-request into smaller units; keep resolvers mutually independent (already mostly true).

### Publishing

Unchanged in P12.3. Still behind `admin-review-service` facade + `lib/publishing/*` from P12.

### Workflow / Snapshot

Unchanged SoT. Facts loader gained optional marker reuse only.

---

## 3. Dependency

See `docs/JYKStore_P12_3_DEPENDENCY_GRAPH.md`.

| Check | Result |
|---|---|
| Import graph | Layered facade → modules → Prisma/Worker |
| Cycles (`worker-zip/*`) | **None** |
| Cycles (`markers/*`) | **None** (supplement → provider-review one-way) |
| Facade | Stable paths preserved |

Import statement counts (rough): Worker modules ~43, Marker modules ~45 (includes type-only).

---

## 4. Presentation complexity (P12.3-3)

| Function | Judgment removed? | Status |
|---|---|---|
| `mapQueuePresentation` | Partial | Still phase→label/queue-group map; **not** Snapshot step resolver. Filter path prefers `workflow.currentStep` when attached. |
| `displayStatus` / `ctaLabel` | Labels only at call sites | Produced by presentation map or list DTO passthrough |
| `getNextReviewAction` | **No** | Still invokes gate helpers; Detail also builds Snapshot for `currentStep` separately |

Residual presentation gate logic is **technical debt** (P13), not a P12.3 policy change.

---

## 5. Provider Review (P12.3-4)

| Approach | Used? |
|---|---|
| Direct marker phases in `AdminProviderReviewPanel` | **Yes** |
| Snapshot runtime for panel gate | **No** |

**Reason recorded:** Provider Review is a **publish handoff gate**, not a rail step (P12 policy). Panel needs live acknowledgement UI + `canRequestProviderReviewHandoff` policy over marker phases. Snapshot already exposes `REQUEST_PROVIDER_REVIEW` in `availableActions` / publish step; panel conversion would be presentation-only and was deferred to avoid behavior drift.

---

## 6. Remaining Technical Debt

### Remaining large files

| File | LOC | Future |
|---|---:|---|
| `worker-zip/request-lifecycle.ts` | 755 | Split request verbs |
| `worker-zip/admin-execution.ts` | 526 | Extract transaction / progress reporting |
| `markers/supplement.ts` | 442 | Split action handlers |
| `admin-work-inbox-view-model.ts` | ~550 | Snapshot-only labels for displayStatus |
| `admin-review-rail.ts` | ~480 | `getNextReviewAction` → Snapshot action presenter |

### Remaining duplication

| Area | Status |
|---|---|
| Inbox markers → Facts | **Mitigated** for reviewing list (`markersByPackId`) |
| Worker ZIP list → Facts | May still resolve markers without attaching Snapshot workflow on every path — verify / wire like reviewing list in P13 |
| Phase ladder vs Snapshot labels | Dual presentation paths |

### P13 targets

1. Snapshot-only next-action presenter (remove gate calls from rail presentation).  
2. Further split `request-lifecycle` / `supplement`.  
3. Attach Workflow summary on Worker ZIP inbox list with marker reuse.  
4. Provider Review panel: optional Snapshot `availableActions` for CTA enablement (labels only).

---

## 7. Verdict (complexity)

```text
P12.3 STRUCTURAL COMPLEXITY REDUCTION: DONE for Worker + Marker facades
P12.3 PRESENTATION SoT / Provider Review Snapshot: INVESTIGATED; residual debt documented
```

Net: navigation and ownership complexity reduced (megafiles → modules). Absolute LOC not the goal; max file size dropped from **2,378 → 755** (Worker) and **1,458 → 442** (Marker domain).
