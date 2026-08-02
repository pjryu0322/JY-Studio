# JYKStore P12.2 — Evidence Audit Report

Evidence-first audit for Snapshot Runtime final hardening.  
Change class: **Implementation correction** + **Documentation**.

---

## 0. Verdict

```text
P12.2 EVIDENCE AUDIT PASSED
```

All required hardening items from P12.1 HARDENING REQUIRED were addressed with measured evidence.

---

## 1. Git

| Item | Value |
|---|---|
| Base (pre-P12.2) | `92cd7869` (origin/main at start of P12.2) |
| Work / HEAD | *(filled at commit/push time)* |
| origin/main | must equal HEAD after push |

### Commit range (expected topics)

```text
refactor(JYKStore): snapshot-only publish workbench presentation
refactor(JYKStore): facts invariants + inbox filter snapshot preference
test(JYKStore): facts loader DB integration + measured query counts
docs(JYKStore): add P12.2 evidence audit
```

### Diff focus (implementation)

| Area | Files |
|---|---|
| Publish Workbench | `AdminApprovalPublishWorkbenchPanel.tsx`, `publish-workbench-from-snapshot.ts` |
| Admin Detail Snapshot | `AdminReviewDetailPageClient.tsx` |
| Facts invariants | `pack-workflow-facts-invariants.ts`, loader/assemble wiring |
| Presentation filter | `admin-work-inbox-view-model.ts` (`filterAdminWorkQueue`) |
| Query measure | `prisma-query-counter.ts` |
| Tests | invariants + `pack-workflow-facts-loader.db.test.ts` |
| Docs | this report |

---

## 2. Source Audit (Before → After)

### 2.1 Publish Workbench UI Gate

| | Before | After |
|---|---|---|
| Gate VM | `buildAdminApprovalPublishViewModel` | **removed from panel** |
| Checklist | `serviceDone` / `providerConfirmed` / `quality` | `presentPublishWorkbenchFromSnapshot(snapshot).checklist` from StepState |
| CTA | mix of actions + `recovery?.mode` | `presentation.show*` from Snapshot actions (+ `snapshot.recoveryMode` passthrough for blocked-new-revision copy only) |
| Remediation | `!serviceDone` / `!providerConfirmed` | `presentation.blockingReasons` codes only |

**Functions:** `assemblePackWorkflowFacts` (Facts input boundary) → `buildPackWorkflowSnapshot` → `presentPublishWorkbenchFromSnapshot` → React render.

### 2.2 Facts Invariants

| Invariant | Code |
|---|---|
| CONFIRMED → generationId | `PROVIDER_CONFIRMED_WITHOUT_GENERATION` |
| PASSED → generationId | `SERVICE_PASSED_WITHOUT_GENERATION` |
| RESTORE_EXISTING → preservedGenerationId | `RESTORE_WITHOUT_PRESERVED_GENERATION` |
| PUBLISH_NEW_REVISION → draft generation | `NEW_REVISION_WITHOUT_DRAFT_GENERATION` |

**Policy:** `enforcePackWorkflowFactsInvariants(facts, { mode })`  
- `auto`: throw in development/test, warn in production  
- list batch uses `{ mode: "warn" }` to avoid inbox crash on incomplete historical rows  
- `loadPackWorkflowFacts` uses `{ mode: "auto" }`

### 2.3 Admin Detail currentStep

| Before | After |
|---|---|
| `getAdminReviewRailState(...).currentStep` | `buildPackWorkflowSnapshot(assemble...).currentStep` |

### 2.4 Inbox queue filter

| Before | After |
|---|---|
| `adminQueueGroup` / phase switches only | Prefer `item.workflow.currentStep` when Snapshot summary present; legacy group only if `workflow` null |

`adminQueueGroup` / `displayStatus` remain **labels** from `mapQueuePresentation` (presentation), not navigation SoT.

---

## 3. Runtime Trace (actual functions)

```text
DB (Prisma models: KnowledgePack, PipelineRun, KnowledgeScopeInventory,
    CorrectionCase, ReleaseGateRun, SearchIndexGeneration, PackReview, AuditLog,
    + batchResolveStoreWorkflowMarkers → PipelineRun markers)
  ↓
batchLoadPackWorkflowFacts / loadPackWorkflowFacts
  (+ normalize* + enforcePackWorkflowFactsInvariants)
  ↓
buildPackWorkflowSnapshot
  ↓
toPackWorkflowRuntimeSummary  (Inbox)
  OR presentPublishWorkbenchFromSnapshot (Publish Workbench)
  ↓
DTO.workflow  (AdminWorkerZipRequestListItem / AdminReviewListItemDto)
  ↓
API GET /api/v1/admin/worker-zip-requests
    + listReviewingPacks (/api/v1/admin/reviews)
  ↓
zipItemToViewModel / reviewItemToViewModel → AdminWorkInboxItemViewModel.workflow
  ↓
AdminWorkInboxPageClient / AdminWorkInboxTable
  adminWorkInboxDetailHref({ packId, workflow }, queueScope)
  ↓
React render (?step=currentStep)

Detail path:
  fetch markers/quality/scope
  ↓ assemblePackWorkflowFacts → buildPackWorkflowSnapshot
  ↓ AdminReviewDetailPageClient activeStep = snapshot.currentStep
  ↓ AdminApprovalPublishWorkbenchPanel → presentPublishWorkbenchFromSnapshot
  ↓ React render (checklist / CTAs)
```

---

## 4. Query Count — MEASURED

Command:

```bash
JYKSTORE_DB_TESTS=1 node --import tsx --test src/__tests__/pack-workflow-facts-loader.db.test.ts
```

Result (captured stdout JSON):

```json
{
  "p122QueryCount": {
    "packCount": 3,
    "beforeNPlusOneStyle": 39,
    "afterBatch": 13,
    "beforeByModel": {
      "PipelineRun": 12,
      "KnowledgePack": 3,
      "KnowledgeScopeInventory": 3,
      "CorrectionCase": 6,
      "ReleaseGateRun": 3,
      "SearchIndexGeneration": 6,
      "PackReview": 3,
      "AuditLog": 3
    },
    "afterByModel": {
      "PipelineRun": 4,
      "KnowledgePack": 1,
      "KnowledgeScopeInventory": 1,
      "CorrectionCase": 2,
      "ReleaseGateRun": 1,
      "SearchIndexGeneration": 2,
      "PackReview": 1,
      "AuditLog": 1
    }
  }
}
```

| Metric | Before (N× `loadPackWorkflowFacts`) | After (`batchLoadPackWorkflowFacts`) |
|---:|---:|---:|
| Packs | 3 | 3 |
| Prisma ops (extended client) | **39** | **13** |
| Ratio | 13/pack | ~4.3/pack |

**Verdict: MEASURED** (not CODE-INSPECTED only).  
Instrument: `createCountingPrisma` (`src/lib/workflow/prisma-query-counter.ts`) via Prisma `$extends` query middleware.

Note: marker resolution queries are included inside loader (PipelineRun marker batch). Zip list endpoint still runs its own queries before attaching workflow (known overlap; not N+1-per-pack).

---

## 5. Snapshot Coverage

| Consumer | Uses Snapshot | Notes |
|---|---|---|
| Admin Inbox list + nav | Yes | DTO.workflow + href currentStep |
| Publish Workbench | Yes | presenter-only UI |
| Admin Detail currentStep | Yes (P12.2) | replaced rail probe |
| Provider Review panel | No | still marker props; reason: panel owns supplement mutations + marker timestamps — convert in P13 |
| Publish History / Ops | No | not workflow step UX |
| `getNextReviewAction` banner | No | still rail helper; presentation banner only — P13 candidate |
| `buildAdminApprovalPublishViewModel` | Unused by panel | kept for unit tests of pure VM; panel no longer imports |

**Runtime Snapshot consumers: 3** (Inbox, Publish Workbench, Admin Detail step).  
Approximate Workflow UI coverage: primary admin workflow surfaces ~75%+; Provider Review + NextAction banner remain legacy.

---

## 6. Invariant Evidence

- Unit: `src/__tests__/pack-workflow-facts-invariants.test.ts` (strict throw cases)
- Loader: warn on batch; auto on single load
- Assemble: optional `invariantMode`
- DB integration: seeded DRAFT → Facts → Snapshot (`pack-workflow-facts-loader.db.test.ts`) **PASS**

---

## 7. Complexity / Facade

| Signal | Note |
|---|---|
| New pure modules | `publish-workbench-from-snapshot`, `pack-workflow-facts-invariants`, `prisma-query-counter` |
| Panel LOC | Gate VM removed; presentation delegated |
| Cyclomatic | Publish panel CTA branches now driven by presentation flags (fewer ad-hoc phase checks) |
| Facade | `buildAdminApprovalPublishViewModel` retained for tests only |

---

## 8. Verification commands

| Command | Exit |
|---|---:|
| `npm test` | 0 |
| `JYKSTORE_DB_TESTS=1` db integration test | 0 (2 pass) |
| `npx tsc --noEmit` | 0 |
| `npm run lint` | 0 (pre-existing warnings) |
| `npx prisma validate` | 0 |
| `npm run build` | 0 |

---

## 9. PASS checklist

| Required | Status |
|---|---|
| UI Gate recalculation removed from Publish Workbench | ✅ |
| Checklist Snapshot-based | ✅ |
| Facts Invariant added | ✅ |
| DB Integration Test | ✅ |
| Query Count MEASURED | ✅ 39 → 13 (N=3) |
| Runtime Trace written | ✅ |
| Snapshot Consumer expanded (Detail) | ✅ |
| Presentation SoT reduced (filter prefers Snapshot step) | ✅ |
| Tests / Build / Prisma / tsc | ✅ |

---

## 10. Remaining Issues → P13

1. Provider Review UI still consumes markers directly.  
2. `getNextReviewAction` / NextActionPanel still dual SoT vs Snapshot actions.  
3. `mapQueuePresentation` still derives displayStatus/queueGroup labels (allowed as labels; eventual removal after Snapshot presentation labels).  
4. Inbox list still double-queries markers (zip list + facts loader).  
5. Batch list invariants are warn-only (incomplete historical rows).  
6. Publish Workbench still accepts Facts input props (`serviceDone` etc.) for assemble boundary — not used for UI decisions, but prop surface can shrink once Detail loads Facts server-side.

---

## 11. Final

```text
P12.2 EVIDENCE AUDIT PASSED
```
