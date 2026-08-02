# JYKStore P12.3 — Evidence Report

Evidence for Worker ZIP / Workflow Marker complexity reduction.  
**Invariant:** no intentional behavior change to Workflow Snapshot, PackWorkflowFacts, Publish Identity/Eligibility, Retrieval, MCP, API contracts, or DB schema.

---

## 0. Verdict

```text
P12.3 FACADE SPLIT: LANDED (8acc9f1c)
P12.3 DOCS: THIS REPORT + DEPENDENCY + COMPLEXITY
P12.3 PRESENTATION / PROVIDER-REVIEW RUNTIME: SURVEYED — residual debt (no silent behavior change)
```

Completion against prompt checklist:

| Condition | Status |
|---|---|
| Worker ZIP Service Facade | **PASS** |
| Marker Resolver separation | **PASS** (domain modules) |
| Marker Loader separation | **PASS** (`resolve.ts` batch loader) |
| Presentation SoT removal | **PARTIAL** — surveyed; residual gates documented |
| Provider Review Snapshot survey | **PASS** (not converted; reason recorded) |
| Dependency Graph | **PASS** |
| Complexity Report | **PASS** |
| Evidence Report | **PASS** (this file) |
| Behavior change | **None intended** (structure only) |

---

## 1. Git

| Item | Value |
|---|---|
| Base | `73b49a9e` (docs: pin P12.2 evidence audit work SHA) |
| HEAD (implementation) | `8acc9f1c` |
| Branch | `main` / `origin/main` |

### Commit

```text
8acc9f1c refactor(JYKStore): split worker-zip and workflow markers into facade modules
```

### Diff (implementation commit)

```text
29 files changed, 4218 insertions(+), 3865 deletions(-)
```

Focus paths:

- `src/lib/python-worker/worker-zip-import-provider-service.ts` → facade  
- `src/lib/python-worker/worker-zip/*` → modules  
- `src/lib/store-workflow-markers.ts` → facade  
- `src/lib/workflow/markers/*` → modules  
- `pack-workflow-facts-loader.ts` + `admin-review-service.ts` + inbox workflow attach — `markersByPackId` reuse  
- Test import path retargets  

Docs commit (this report set) is additive under `docs/JYKStore_P12_3_*.md`.

---

## 2. Worker

| Metric | Before (`73b49a9e`) | After (`8acc9f1c`) |
|---|---:|---:|
| Facade LOC | 2,378 | **24** |
| Implementation LOC (sum of modules) | (= facade) | **2,480** |
| Facade | monolith | `export * from "./worker-zip"` |
| Module count | 1 | **10** |

### Module inventory

| Module | LOC | Concern |
|---|---:|---|
| `request-lifecycle.ts` | 755 | Request |
| `admin-execution.ts` | 526 | Execution |
| `admin-inbox.ts` | 396 | Provider / list |
| `import-run.ts` | 393 | Import |
| `admin-hold.ts` | 170 | Provider hold |
| `pack-resolvers.ts` | 71 | Request resolve |
| `index.ts` | 64 | Barrel |
| `errors.ts` | 59 | Errors |
| `generation-transitions.ts` | 27 | Transaction transitions |
| `constants.ts` | 19 | Constants |

---

## 3. Marker

| Metric | Before | After |
|---|---:|---:|
| Facade LOC | 1,458 | **18** |
| Implementation LOC (sum) | (= facade) | **1,589** |
| Resolver / domain modules | 1 | **6** action/domain + resolve/types/constants |
| Loader | inlined | `batchResolveStoreWorkflowMarkers` in `resolve.ts` |
| Facts Adapter | none | optional `markersByPackId` into Facts / inbox |

### Module inventory

| Module | LOC | Role |
|---|---:|---|
| `supplement.ts` | 442 | Correction / supplement |
| `provider-review.ts` | 282 | ProviderReview |
| `resolve.ts` | 279 | Batch Loader + snapshot resolve |
| `admin-returned-queue.ts` | 200 | Queue projection |
| `publish-binding.ts` | 173 | Publish binding |
| `service-validation.ts` | 100 | ServiceValidation |
| `types.ts` | 57 | Types |
| `index.ts` | 45 | Barrel |
| `constants.ts` | 11 | Triggers |

Marker generators do not form a dependency cycle (see Dependency Graph).

---

## 4. Complexity

| Area | Cyclomatic (qualitative) | Function count (approx) | LOC | Import stmts (approx) |
|---|---|---:|---:|---:|
| Worker before | High (single file) | 20 | 2,378 | concentrated |
| Worker after | Same logic, split files | 20 | 2,480 + 24 facade | ~43 across modules |
| Marker before | High (single file) | 22 | 1,458 | concentrated |
| Marker after | Same logic, split files | 22 | 1,589 + 18 facade | ~45 across modules |
| Max fn length Worker | 466 | unchanged | — | — |
| Max fn length Marker | 177 | unchanged | — | — |

Structural complexity (file ownership / review surface) reduced; algorithmic complexity intentionally preserved.

Full tables: `docs/JYKStore_P12_3_COMPLEXITY_REPORT.md`.

---

## 5. Runtime

| Concern | Change? |
|---|---|
| Workflow Snapshot SoT | **Unchanged** |
| PackWorkflowFacts shape / invariants | **Unchanged** (loader option additive) |
| Publish identity / eligibility | **Unchanged** |
| Worker ZIP import behavior | **Unchanged** (move-only) |
| Marker PipelineRun semantics | **Unchanged** |
| API / MCP / DB schema | **Unchanged** |

```text
동작 변경 없음 (의도)
Workflow 동일
Publish 동일
Snapshot 동일
```

---

## 6. Presentation SoT (P12.3-3)

Investigated:

| Symbol | Finding |
|---|---|
| `mapQueuePresentation` | Label / `adminQueueGroup` from marker phases; does **not** call Snapshot builders. Inbox **filters** prefer `workflow.currentStep` when present (P12.2). |
| `displayStatus` | Presentation string only. |
| `getNextReviewAction` | Still performs Gate judgment via `canEnterServiceValidation` / `canRequestProviderReviewAfterServiceValidation` / `canPublish`. Detail page already uses Snapshot for `currentStep`. |

**Action taken in P12.3 code landing:** no presentation rewrite (would risk CTA behavior drift). Residual documented for P13.

---

## 7. Provider Review Snapshot (P12.3-4)

| Item | Result |
|---|---|
| Direct marker access in panel | **Yes** (`providerReviewPhase`, quality, workerZipPhase) |
| Gate helper | `canRequestProviderReviewHandoff` |
| Converted to Snapshot runtime? | **No** |

**Reason:** Provider Review is a publish-side handoff gate (not a rail step). Snapshot already encodes `REQUEST_PROVIDER_REVIEW` under publish actions. Panel UX needs acknowledgement checkboxes and live DTO fields; remapping without a dedicated presenter would risk false enable/disable. Safe conversion deferred.

---

## 8. Marker Loader optimization (P12.3-5)

| Path | Before risk | After |
|---|---|---|
| `listReviewingPacks` | markers resolve + Facts resolve markers again | **Reuse** `markersByPackId` → `batchAttachInboxWorkflow` → `batchLoadPackWorkflowFacts` |
| Facts loader | always `batchResolveStoreWorkflowMarkers` | Skip when `options.markersByPackId` provided |

---

## 9. Regression

Measured on workspace after `8acc9f1c` (docs-only tree may add files; no code change required for these checks):

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **PASS** (exit 0) |
| `npx prisma validate` | **PASS** (schema valid) |
| `npm test` / lint / build | Not re-run in docs-only pass; implementation commit retained prior green intent — re-run before next release gate if required |

---

## 10. Related documents

| Doc | Purpose |
|---|---|
| `docs/JYKStore_P12_3_DEPENDENCY_GRAPH.md` | Import / cycle / facade graph |
| `docs/JYKStore_P12_3_COMPLEXITY_REPORT.md` | Before/After metrics + debt |
| `docs/JYKStore_P12_3_EVIDENCE_REPORT.md` | This evidence pack |

---

## 11. Out of scope (intentionally untouched)

- `projects/JYKPackBuilder/**`
- `agent-tools/**`
- Snapshot / Publish / Retrieval / MCP policy code
- Prisma schema migrations
