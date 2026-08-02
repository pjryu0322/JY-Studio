# JYKStore P12.1 — GitHub Evidence Audit Report

Evidence-first audit for ChatGPT/GitHub cross-verification.  
Change type for this document: **Documentation-only change** (audit).

---

## 0. Verdict (summary)

```text
P12.1 EVIDENCE AUDIT HARDENING REQUIRED
```

Core adoption is real and on `origin/main`, but Publish Workbench still recomposes presentation gates outside Snapshot actions, loader invariants are not enforced, and N+1 is CODE-INSPECTED (not MEASURED). Details below.

---

## 1. Git / remote

### Commands

```bash
git status
git log -10 --oneline
git rev-parse HEAD
git rev-parse origin/main
git push -u origin HEAD   # executed during audit
```

### Result

| Item | SHA |
|---|---|
| Base | `cba955e6ff7a735aad55ba556c2bdedf463389fc` |
| Implementation Work | `62fa7961020e2140ec20611123c243f0a3581c22` |
| Evidence report commit / HEAD | `e2272246327db06947b13d3eb2dc6e403cb563c3` |
| origin/main | `e2272246327db06947b13d3eb2dc6e403cb563c3` |

```text
HEAD = origin/main = e2272246  ✅
```

Push: P12.1 implementation `cba955e6..62fa7961`, then evidence docs on top.  
Untracked excluded: `projects/JYKPackBuilder/`, `projects/JYKStore/agent-tools/`

### Commit range `cba955e6..HEAD` (5 commits)

```text
62fa7961 docs(JYKStore): pin P12.1 workflow snapshot adoption work SHA
e650970d test(JYKStore): lock workflow snapshot runtime invariants
d436ef6c refactor(JYKStore): drive publish workbench from workflow snapshot
d4137a8e refactor(JYKStore): adopt workflow snapshot in admin inbox
d4b47e05 refactor(JYKStore): add canonical workflow facts loader
```

### Diff stats

```text
29 files changed, 1740 insertions(+), 188 deletions(-)
```

| Classification | Files |
|---|---|
| Facts / Snapshot | `pack-workflow-facts.ts`, `pack-workflow-snapshot.ts`, `pack-workflow-facts-loader.ts`, `pack-workflow-facts-normalize.ts`, `pack-workflow-facts-assemble.ts` |
| Admin Inbox | `admin-work-inbox-workflow.ts`, `admin-work-inbox-navigation.ts`, `admin-work-inbox-mappers.ts`, `admin-work-inbox-view-model.ts`, `worker-zip-requests/route.ts`, `admin-review-service.ts`, `admin-review-api.ts`, `admin-review-dto.ts` |
| Publish Workbench | `AdminApprovalPublishWorkbenchPanel.tsx`, `AdminReviewDetailPageClient.tsx` |
| Publishing policy | *(no changes in range — identity/eligibility files untouched)* |
| Compatibility | `compatibility-registry.ts` |
| Tests | snapshot/loader/normalize/inbox/workbench tests + facade retargets + `unit-test-files.json` |
| Documentation | `JYKStore_P12_1_workflow_snapshot_runtime_adoption.md`, this report |
| Unrelated | none in commit range |

---

## 2. Snapshot runtime usage search

### Command

```bash
rg -n "buildPackWorkflowSnapshot|PackWorkflowSnapshot|PackWorkflowFacts|batchLoadPackWorkflowFacts|loadPackWorkflowFacts" src
```

### Classification

| Kind | Paths |
|---|---|
| Definition | `src/lib/workflow/pack-workflow-facts.ts`, `pack-workflow-snapshot.ts`, `pack-workflow-facts-loader.ts`, `pack-workflow-facts-assemble.ts`, `pack-workflow-facts-normalize.ts` |
| Unit Test | `pack-workflow-snapshot.test.ts`, `pack-workflow-facts-normalize.test.ts` |
| Integration / structure Test | `pack-workflow-facts-loader.test.ts`, `admin-work-inbox-navigation-snapshot.test.ts`, `admin-publish-workbench-snapshot.test.ts` |
| Documentation / registry | `compatibility-registry.ts`, docs |
| **Runtime Consumer** | `admin-work-inbox-workflow.ts` → inbox APIs; `AdminApprovalPublishWorkbenchPanel.tsx` |

Runtime consumer count used for gate: **2** (both use Snapshot fields in DTO/UI, not import-only).

---

## 3. Runtime consumer #1 — Admin Inbox

| Field | Evidence |
|---|---|
| Attach path | `src/lib/admin-work-inbox/admin-work-inbox-workflow.ts` |
| Import | `batchLoadPackWorkflowFacts`, `buildPackWorkflowSnapshot`, `toPackWorkflowRuntimeSummary` |
| Call | `batchAttachInboxWorkflow(packIds)` → facts → snapshot → summary |
| API wiring | `src/app/api/v1/admin/worker-zip-requests/route.ts` lines 38–47; `listReviewingPacks` in `admin-review-service.ts` |
| DTO | `workflow` on list items (`admin-review-api.ts`, `admin-review-dto.ts`) |
| ViewModel | `AdminWorkInboxItemViewModel.workflow` |
| Mapper | `admin-work-inbox-mappers.ts` passes `workflow` through |
| Snapshot fields used | `currentStep`, `stepState`, `availableActions`, `blockingReasons` |
| Navigation | `adminWorkInboxDetailHref` uses `item.workflow?.currentStep` (or explicit canonical queue → step) |

Data flow proven:

```text
DB/markers
→ batchLoadPackWorkflowFacts
→ buildPackWorkflowSnapshot
→ Inbox DTO.workflow
→ adminWorkInboxDetailHref(?step=currentStep)
→ AdminWorkInboxTable / Sections / shared CTA href
```

---

## 4. Runtime consumer #2 — Publish Workbench

| Field | Evidence |
|---|---|
| File | `src/components/AdminApprovalPublishWorkbenchPanel.tsx` |
| Import | `assemblePackWorkflowFacts`, `buildPackWorkflowSnapshot` |
| Facts input | pack status, workerZipPhase, quality, openSupplement, serviceDone→phase, providerConfirmed→phase, recovery mode/ids |
| Snapshot fields used for CTA | `availableActions` → `PUBLISH_FIRST_REVISION`, `UNPUBLISH`, `RESTORE_EXISTING_REVISION`, `PUBLISH_NEW_REVISION` |
| Wire-in | `AdminReviewDetailPageClient.tsx` passes `knowledgeScopeFinalized` |

### CTA mapping (actions → UI → API)

| WorkflowAction | CTA visibility | Client API |
|---|---|---|
| PUBLISH_FIRST_REVISION | `showDecisionForm` → AcceptTab | approve/reject via AcceptTab (server `publishing/publish-first-revision`, `reject-pack-review`) |
| RESTORE_EXISTING_REVISION | `showRestore` | `restorePublishAdminReview` |
| PUBLISH_NEW_REVISION | `showNewRevision` | `publishNewRevisionAdminReview` |
| UNPUBLISH | `showUnpublish` | `unpublishAdminReview` |
| REJECT_REVIEW | with first-publish decision form | reject path via AcceptTab |

### Residual UI gate recomposition (HARDENING)

Still present in the same panel:

1. `buildAdminApprovalPublishViewModel(...)` for labels / blockedReasons fallback  
2. Checklist `gates[]` recomputed from `serviceDone`, `providerConfirmed`, `openSupplement`, `quality`  
3. `showNewRevisionBlocked` uses `recovery?.mode === "PUBLISH_NEW_REVISION"`  
4. Remediation buttons when blocked still branch on `!serviceDone` / `!providerConfirmed`

Primary publish CTAs use Snapshot actions, but **UI publish gate recalculation is not zero**.

---

## 5. Facts Loader source audit

File: `src/lib/workflow/pack-workflow-facts-loader.ts`

| Concern | Finding |
|---|---|
| `loadPackWorkflowFacts` | wraps `batchLoadPackWorkflowFacts([id])` |
| `batchLoadPackWorkflowFacts` | single `Promise.all` of batch queries |
| Typed normalize | `pack-workflow-facts-normalize.ts` |
| Markers | `batchResolveStoreWorkflowMarkers` |
| Recovery | pure `resolvePublishRecoveryMode` after batched unpublish audit + draft gens (**lightweight**, not full `resolvePublishRecoveryForPack`) |
| Provider/SV | from markers phases |
| Generation/quality | releaseGate + draft/production gens + correction severity groupBy |
| Correction/supplement | OPEN count + `isOpenProviderSupplementPhase` |

### Strong typing

`PackWorkflowFacts` fields:

- `packStatus: PackStatus`
- `workerZipPhase: AdminWorkerZipPhase`
- `serviceValidation.phase: AdminServiceValidationPhase`
- `providerReview.phase: AdminProviderReviewPhase`
- `packReviewStatus: PackReviewStatusValue | null`

Search in `src/lib/workflow` for loose Facts types:

```text
PackStatus | string  → only AssemblePackWorkflowFactsInput (boundary), not PackWorkflowFacts
```

**PASS** for Facts output typing. Boundary inputs may still accept string (normalize).

### Loader invariants

| Invariant | Enforced? | Evidence |
|---|---|---|
| confirmed=true → generationId | **No hard assert** | `confirmed: providerPhase === "CONFIRMED"`; `generationId: draftGenId` may be null |
| SV PASSED → generationId | **No hard assert** | phase from markers; generationId = draftGenId |
| RESTORE_EXISTING → preservedGenerationId | Soft | recovery mode uses `Boolean(preservedGenerationId)` |
| PUBLISH_NEW_REVISION → draft gen | Soft | `hasCurrentDraftReady: Boolean(draftGenId)` |

No dedicated invariant validator/tests that throw on violation.

---

## 6. Batch / N+1

### Pattern search

No inbox path of:

```ts
for (const pack of packs) await loadPackWorkflowFacts(pack.packId)
```

or `Promise.all(packs.map(p => loadPackWorkflowFacts(p.packId)))`.

Inbox uses `batchAttachInboxWorkflow(packIds)` once per list response.

### Query structure (CODE-INSPECTED)

From loader comment + source:

1. `knowledgePack.findMany`  
2. `pipelineRun.findMany`  
3. `knowledgeScopeInventory.findMany`  
4. `correctionCase.groupBy` (open)  
5. `correctionCase.groupBy` (severity)  
6. `releaseGateRun.findMany`  
7. `searchIndexGeneration.findMany` (draft)  
8. `searchIndexGeneration.findMany` (production)  
9. `packReview.findMany`  
10. `auditLog.findMany`  
11. `batchResolveStoreWorkflowMarkers` (3 findMany)

Post-query: in-memory map assembly only (no per-pack await).

**N+1 verdict: CODE-INSPECTED — no N+1 pattern found. Not MEASURED (no query counter / Prisma middleware evidence).**

Note: list endpoints still run their own list queries *before* facts batch (zip list + markers inside listAdminWorkerZipRequests). Extra overlap possible; not N+1-per-pack.

---

## 7. Snapshot resolver audit

File: `src/lib/workflow/pack-workflow-snapshot.ts`

| Check | Result |
|---|---|
| Prisma client / fetch / dynamic import / env / Date.now policy | **Absent** (only `PackStatus` enum import from `@prisma/client`) |
| Pure function | **Yes** |
| StepState model | `NOT_STARTED \| AVAILABLE \| IN_PROGRESS \| COMPLETED \| WARNING \| BLOCKED` on `StepSnapshot.state` |
| ready/blocked | Derived compatibility fields — **not** sole model |
| currentStep / availableActions / blockingReasons | Computed |

Blocking reason codes present in source:

```text
INVENTORY_NOT_FINALIZED
OPEN_SUPPLEMENT
UNRESOLVED_CORRECTION
QUALITY_BLOCKERS
SERVICE_VALIDATION_REQUIRED
PROVIDER_REVIEW_REQUIRED
PROVIDER_REVIEW_STALE
PUBLISH_RECOVERY_BLOCKED
```

---

## 8. Admin Inbox navigation audit

### Navigation file

`src/lib/admin-work-inbox/admin-work-inbox-navigation.ts`

```bash
rg adminQueueGroup|ACCEPT_REQUIRED → NO MATCHES in this file
```

Href logic: canonical `queueScope` → step map, else `workflow.currentStep`.

### Remaining queue-group / phase usage (classified)

| Location | Classification |
|---|---|
| `AdminWorkInboxPageClient` filter by `adminQueueGroup` / `serviceValidationPhase` | **Presentation / filter** (which rows show) — not step deep-link SoT |
| `admin-work-inbox-view-model` `mapQueuePresentation` | **Presentation** (displayStatus / CTA label / queue group) |
| Table/shared `queueGroup` badge styling | **Presentation** |
| `admin-work-inbox.types` FILTER_TO_GROUPS | **Presentation** |

**Queue→Step operational switch in navigation: 0** ✅  

Residual: dual presentation SoT for queue labels/filters still exists (Known Issue).

---

## 9. Compatibility boundary

Registry entries (`compatibility-registry.ts`):

- `admin-queue-aliases`, `admin-step-aliases`  
- `admin-queue-group-to-step` (P12.1)  
- `store-workflow-markers-ui` (P12.1)  

Each has legacy / canonical / reason / removalGate.

Legacy queue normalize still in `routes.normalizeAdminWorkQueue` (compatibility parser).

---

## 10. Publishing policy regression

**No edits** to these files in `cba955e6..HEAD`:

- `publish-identity-policy.ts`
- `restore-published-revision.ts`
- `publish-new-revision.ts`
- `publish-first-revision.ts`
- `publish-eligibility-policy.ts`

### Identity (source-verified)

Restore (`restore-published-revision.ts` return):

```text
preservedGenerationId = preservedId
restoredGenerationId = preservedId
```

New revision (`publish-new-revision.ts` return):

```text
reviewedGenerationId
publishedGenerationId: reviewedGenerationId
servedGenerationId: reviewedGenerationId
```

### Eligibility (still on server)

`resolvePublishEligibilityBlock` + `assertProviderReviewBindingCurrent` still called from `publish-first-revision.ts` / `publish-new-revision.ts`.

Snapshot did not remove server enforcement.

Targeted tests: `p9-1-publish-recovery.test.ts` (pass in targeted run).

---

## 11. Test evidence

### Full suite

```bash
npm test   # scripts/run-unit-tests.mjs
EXIT=0
```

Batches reported `fail 0` throughout. Approximate batch sizes observed via regex: ~271 / 239 / 271 / 333 / 305 tests (runner does not print a single aggregate). Last batch: **305 pass / 0 fail**.

### Targeted (exit 0)

| File | Role | Result |
|---|---|---|
| `pack-workflow-snapshot.test.ts` | Snapshot unit | pass |
| `pack-workflow-facts-normalize.test.ts` | typing normalize | pass |
| `pack-workflow-facts-loader.test.ts` | batch structure (not DB) | pass |
| `admin-work-inbox-navigation-snapshot.test.ts` | inbox step = snapshot | pass |
| `admin-publish-workbench-snapshot.test.ts` | CTA actions | pass |
| `p9-1-publish-recovery.test.ts` | publish identity/recovery | pass |
| `p11-clean-reset-safety.test.ts` | P11 safety | included in full suite exit 0 |

**Gap:** Facts Loader has **no live DB integration test** proving raw DB → typed Facts → Snapshot end-to-end.

### Static / build

| Command | Exit |
|---|---:|
| `npx tsc --noEmit` | 0 |
| `npm run lint` | 0 (pre-existing warnings only) |
| `npx prisma validate` | 0 |
| `npm run build` | 0 |

---

## 12. Complexity table

| 지표 | Before (P12.1 start) | After (62fa7961) | Result |
|---|---:|---:|---|
| Snapshot Runtime consumers | 0 | 2 | Improved |
| Queue→Step operational switches (nav) | 1+ | 0 | Improved |
| UI publish gate recalculation sites | high | residual (≥1 panel) | **Incomplete** |
| Facts loose string fields (Facts type) | 5+ | 0 | Improved |
| Full test failures | 0 | 0 | Hold |
| N+1 risk | Unknown | CODE-INSPECTED clear | Not MEASURED |

---

## 13. Known Issues (must not hide)

1. **Publish Workbench residual gate recomputation** — `buildAdminApprovalPublishViewModel`, checklist, `recovery.mode` blocked branch, remediation still use marker-ish props.  
2. **Loader invariants not enforced** — confirmed/PASSED without guaranteed generationId.  
3. **List recoveryMode is lightweight** — not full material-change detection of `resolvePublishRecoveryForPack`. Detail workbench uses full recovery API separately.  
4. **N+1 not MEASURED** — structure only.  
5. **Facts Loader DB integration test missing**.  
6. **Inbox queue-group presentation SoT remains** for filters/labels (`mapQueuePresentation`, PageClient filters).  
7. **Admin Detail rail / Provider Review UI** not converted to Snapshot consumers.  
8. **Overlapping queries**: zip list already batch-resolves markers; facts loader resolves markers again.  
9. **docs adoption report** claimed PASSED; this evidence audit finds HARDENING REQUIRED for residual UI gates.

---

## 14. PASS checklist (audit)

| Required | Status |
|---|---|
| HEAD = origin/main | ✅ |
| Actual Git diff recorded | ✅ |
| Runtime Snapshot consumers ≥ 2 | ✅ |
| Facts Loader actually used | ✅ |
| Facts strongly typed | ✅ |
| Admin Inbox Queue→Step switch removed | ✅ |
| Publish Workbench Snapshot actions used | ✅ (primary CTAs) |
| UI publish gate recalculation absent | ❌ residual |
| Legacy operational decision only at compatibility | ⚠️ filter/presentation residual |
| N+1 absent or batch proven | ⚠️ CODE-INSPECTED only |
| Revision identity regression none | ✅ (untouched + tests) |
| Full tests 0 FAIL | ✅ exit 0 |
| tsc/lint/build/Prisma PASS | ✅ |
| Known Issues disclosed | ✅ |

---

## 15. Final verdict

```text
P12.1 EVIDENCE AUDIT HARDENING REQUIRED
```

**Why not PASS:** Publish Workbench still recomposes gates for checklist/labels/blocked remediation; loader invariants unenforced; N+1 not MEASURED; no DB-backed Facts Loader integration test.

**What is verified on GitHub `main@62fa7961`:** typed Facts + batch loader + pure Snapshot StepState; Inbox deep-links from Snapshot `currentStep`; Publish primary CTAs from `availableActions`; server publishing identity/eligibility unchanged; full unit suite / tsc / lint / prisma / build green.

### Suggested hardening (out of audit-only scope unless requested)

1. Remove `buildAdminApprovalPublishViewModel` from CTA/checklist path; drive checklist from `snapshot.blockingReasons` / step states only.  
2. Drop `recovery?.mode` UI branches in favor of Snapshot actions + blockingReasons.  
3. Add Facts invariant checks (dev/test) + DB integration test.  
4. Optionally MEASURE query count on inbox list path.

---

## 16. Audit metadata

| Item | Value |
|---|---|
| Audit date | 2026-08-02 |
| Report path | `docs/JYKStore_P12_1_EVIDENCE_AUDIT_REPORT.md` |
| Change class | Documentation-only |
| Implementation corrections in this audit | none |
