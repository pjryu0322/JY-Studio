# JYKStore P12.1 — Workflow Snapshot Runtime Adoption

## 1. Base / Work SHA

| Item | Value |
|---|---|
| Base (origin/main at start) | `cba955e6` |
| Work | `e650970d` (suite close; docs pin follows) |

## 2. 기존 결함 재현

### 3.1 Snapshot 사용처 (before)

검색: `buildPackWorkflowSnapshot`, `PackWorkflowFacts`, `PackWorkflowSnapshot`

| Location | Role |
|---|---|
| `src/lib/workflow/pack-workflow-snapshot.ts` | definition |
| `src/__tests__/pack-workflow-snapshot.test.ts` | unit test |
| docs | description |

**Runtime UI/application consumers: 0**

### 3.2 Inbox Navigation 직접 해석 (before)

`src/lib/admin-work-inbox/admin-work-inbox-navigation.ts` contained:

```text
ACCEPT_REQUIRED → receipt
GENERATE_REQUIRED → knowledgeScope / generation
PROVIDER_REVIEW_IN_PROGRESS → publish
PROVIDER_SUPPLEMENT_REQUIRED → correction
ADMIN_REVIEW_REQUIRED → serviceValidation / publish
```

This was a second Workflow SoT independent of Snapshot.

## 3. Snapshot 기존 사용처 → After

Runtime consumers (≥2 required):

1. **Admin Inbox** — `batchAttachInboxWorkflow` → zip/reviews list APIs → row.`workflow.currentStep`
2. **Publish Workbench** — `AdminApprovalPublishWorkbenchPanel` → `assemblePackWorkflowFacts` + `buildPackWorkflowSnapshot` → CTA from `availableActions`

## 4. Facts Loader 구조

`src/lib/workflow/pack-workflow-facts-loader.ts`

- `loadPackWorkflowFacts(packId)`
- `batchLoadPackWorkflowFacts(packIds)` — single `Promise.all` of batch queries (no per-pack await loop)

Batch sources:

| Facts field | Source |
|---|---|
| packStatus | `knowledgePack.findMany` |
| workerZipPhase / receipt ids | `pipelineRun.findMany` (REQUEST + IMPORT) |
| knowledgeScope | `knowledgeScopeInventory.findMany` (DRAFT prefer) |
| correction open / severity | `correctionCase.groupBy` |
| generation quality | `releaseGateRun.findMany` |
| draft/production gen | `searchIndexGeneration.findMany` |
| packReviewStatus | `packReview.findMany` |
| recoveryMode | unpublish `auditLog` + pure `resolvePublishRecoveryMode` |
| provider/service/supplement | `batchResolveStoreWorkflowMarkers` |

Normalize boundary: `pack-workflow-facts-normalize.ts`  
Client assemble (no Prisma): `pack-workflow-facts-assemble.ts`

## 5. Facts 타입 강화

`PackWorkflowFacts` now uses:

- `packStatus: PackStatus`
- `workerZipPhase: AdminWorkerZipPhase`
- `serviceValidation.phase: AdminServiceValidationPhase`
- `providerReview.phase: AdminProviderReviewPhase`
- `packReviewStatus: PackReviewStatusValue | null`

No `PackStatus | string` / loose phase strings after loader.

## 6. StepState 모델

`WorkflowStepState`: `NOT_STARTED | AVAILABLE | IN_PROGRESS | COMPLETED | WARNING | BLOCKED`

`StepSnapshot` carries `state`, `blockingReasons`, `availableActions`, plus derived `ready`/`blocked` for compatibility.

## 7. Snapshot policy

`buildPackWorkflowSnapshot` remains pure (no Prisma/fetch/Date.now).

- `resolveCurrentAdminStep` — single current-step SoT
- `resolveAvailableActions` — CTA actions SoT
- `resolveBlockingReasons` — OPEN_SUPPLEMENT, QUALITY_BLOCKERS, INVENTORY_NOT_FINALIZED, SERVICE_VALIDATION_REQUIRED, PROVIDER_REVIEW_REQUIRED, PROVIDER_REVIEW_STALE, UNRESOLVED_CORRECTION, PUBLISH_RECOVERY_BLOCKED

## 8. Admin Inbox 적용

- API: `worker-zip-requests` + `listReviewingPacks` attach `workflow` via `batchAttachInboxWorkflow`
- ViewModel: `AdminWorkInboxItemViewModel.workflow`
- Mappers pass through `workflow`

## 9. Navigation switch 제거

`adminWorkInboxDetailHref({ packId, workflow }, queueScope)`:

- explicit canonical queue → step
- else `workflow.currentStep`
- **no** `adminQueueGroup` switch

Verified absent under `lib/admin-work-inbox/admin-work-inbox-navigation.ts`.

## 10. 두 번째 Runtime 소비자

Publish Workbench CTAs driven by Snapshot actions:

- `UNPUBLISH`
- `RESTORE_EXISTING_REVISION`
- `PUBLISH_NEW_REVISION`
- `PUBLISH_FIRST_REVISION` / `REJECT_REVIEW`

Server `publishing/*` remains command enforcement SoT.

## 11. Marker / Queue compatibility

Registry entries added:

- `admin-queue-group-to-step`
- `store-workflow-markers-ui`

Markers remain Facts loader input; queue groups remain presentation/filter only.

## 12. Publish policy 정합성

No change to identity policies in `publishing/*`. Snapshot does not re-implement eligibility enforcement.

## 13. Batch / N+1

Inbox path: one `batchLoadPackWorkflowFacts(packIds)` after list fetch (not `for pack of packs await load...`).

Evidence: loader structure test + `Promise.all` + `groupBy` in source.

## 14. Tests

| Suite | Focus |
|---|---|
| `pack-workflow-snapshot.test.ts` | expanded scenarios + StepState |
| `pack-workflow-facts-normalize.test.ts` | typed normalize |
| `pack-workflow-facts-loader.test.ts` | batch structure / wiring |
| `admin-work-inbox-navigation-snapshot.test.ts` | row step = snapshot step |
| `admin-publish-workbench-snapshot.test.ts` | CTA = actions |

`npm test` → **0 FAIL** (305+ in final batch; full runner exit 0).

Also retargeted P12 facade source-string tests to `publishing/*`.

## 15. Runtime usage evidence

```text
src/lib/admin-work-inbox/admin-work-inbox-workflow.ts  → buildPackWorkflowSnapshot
src/components/AdminApprovalPublishWorkbenchPanel.tsx → buildPackWorkflowSnapshot
src/app/api/v1/admin/worker-zip-requests/route.ts     → batchAttachInboxWorkflow
src/lib/admin-review-service.ts                       → batchAttachInboxWorkflow
```

## 16. Complexity before/after

| Metric | Before | After |
|---|---|---|
| Snapshot runtime consumers | 0 | 2 |
| Inbox queue→step SoT | navigation switch | Snapshot currentStep |
| Facts typing | loose strings | canonical enums |

## 17. Known Issues

- List-scale `recoveryMode` uses lightweight unpublish/draft signals (not full `resolvePublishRecoveryForPack` material-change detection). Detail Publish Workbench still loads full recovery API and feeds Snapshot.
- Inbox still uses `adminQueueGroup` for **filter/display** only (not step navigation).

## 18. Final Verdict

```text
P12.1 WORKFLOW SNAPSHOT RUNTIME ADOPTION PASSED
```

Checklist:

- [x] Facts Loader
- [x] Facts strongly typed
- [x] Snapshot pure resolver
- [x] Admin Inbox runtime
- [x] Publish Workbench runtime
- [x] Queue→Step switch removed from inbox nav
- [x] Legacy normalize at compatibility/loader boundary
- [x] UI uses Snapshot actions/reasons
- [x] Server publish policy retained
- [x] N+1 avoided (batch structure)
- [x] Full unit suite 0 FAIL
- [x] tsc / Prisma validate PASS
