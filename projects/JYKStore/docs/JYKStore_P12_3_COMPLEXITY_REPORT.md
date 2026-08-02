# JYKStore P12.3 — Complexity Report (Final Hardening)

| | SHA |
|---|---|
| Pre-final (docs) | `fca939c0` |
| Facade split | `8acc9f1c` |
| Final hardening HEAD | `ba868317` |

---

## 1. Before / After (Final Hardening targets)

Baseline “Before” = post-facade state at `fca939c0` (already modularized megafiles).

| 지표 | Before (`fca939c0`) | After (this hardening) | Result |
|---|---:|---:|---|
| Worker 최대 파일 LOC | 755 (`request-lifecycle.ts`) | **396** (`admin-inbox.ts`) | Improved |
| Worker 최대 함수 LOC | 466 (`runAdminWorkerZipGeneration`) | **339** (`listAdminWorkerZipRequests`) / **132** in admin-execution subtree | 466 removed |
| Marker 최대 파일 LOC | 442 (`supplement.ts`) | **282** (`provider-review.ts`) | Improved |
| Marker 최대 함수 LOC | 177 | 177 (`listAdminProviderReturnedPacks`) | Unchanged (out of split scope) |
| Circular dependency | Manual 0 | **Automated 0** (madge) | Pass |
| Presentation workflow decisions in next-action | Gate path in `getNextReviewAction` | **0** (Snapshot-only presenter) | Pass |
| Full test failures | Unknown at docs-only | **0** (311 pass) | Pass |

### Targeted entry LOC

| Entry | Target | Actual |
|---|---:|---:|
| `request-lifecycle/index.ts` | ≤150 | **25** |
| `admin-execution/run-admin-generation.ts` | ≤150 | **116** |
| Max fn in admin-execution/* | ≤150 | **132** (`executeTestOverrideGeneration`) |
| Max fn in request-lifecycle/* | ≤150 | **118** (`rejectAdminWorkerZipRequest`) |

---

## 2. Worker additional split

### request-lifecycle/ (was 755 LOC flat)

| File | LOC |
|---|---:|
| `admin-reject.ts` | 136 |
| `submit-request.ts` | 130 |
| `types.ts` | 108 |
| `rejection-response.ts` | 162 |
| `admin-accept.ts` | 93 |
| `withdraw-request.ts` | 78 |
| `request-state-query.ts` | 61 |
| `request-status-policy.ts` | 44 |
| `index.ts` | 25 |

### admin-execution/ (was 526 LOC / max fn 466)

| File | LOC | Max fn |
|---|---:|---:|
| `prepare-admin-generation.ts` | 284 | 89 |
| `execute-worker-run.ts` | 237 | **132** |
| `run-admin-generation.ts` | 116 | 88 |
| `finalize-generation.ts` | 69 | 60 |
| `types.ts` | 59 | — |
| `fail-generation.ts` | 22 | 16 |
| `index.ts` | 6 | — |

Orchestrator only sequences prepare → execute → finalize/fail.

---

## 3. Marker additional split

### supplement/ (was 442 LOC flat)

| File | LOC |
|---|---:|
| `admin-decision.ts` | 186 |
| `review-reentry.ts` | 83 |
| `clarification.ts` | 74 |
| `withdraw.ts` | 64 |
| `note.ts` | 63 |
| `policy.ts` | 24 |
| `index.ts` | 20 |
| `request.ts` | 5 |
| `types.ts` | 4 |

`resolve.ts` retained as Batch Loader + phase mapping only (no mutation / CTA / publish eligibility).

---

## 4. Presentation / Provider Review

| Item | Result |
|---|---|
| `presentNextAdminAction` | New LABEL_ONLY mapper from Snapshot |
| `getNextReviewAction` | Snapshot/runtime **required**; gate ladder deleted |
| Detail CTA | Passes `packWorkflowSnapshot` |
| Provider Review CTA | `availableActions.includes("REQUEST_PROVIDER_REVIEW")` |
| `mapQueuePresentation` | LABEL_ONLY / COMPATIBILITY (inbox chrome) |
| `getAdminReviewRailState` | Still gate-based for rail badges — residual COMPATIBILITY (P13) |

---

## 5. Remaining hotspots (P13)

| File | Max fn / LOC | Why deferred |
|---|---|---|
| `admin-inbox.ts` | fn 339 / file 396 | List aggregation; not PART C target |
| `import-run.ts` | fn 289 / file 393 | Pipeline bind; behavior-sensitive |
| `provider-review.ts` | file 282 | Stable mutation cluster |
| `admin-returned-queue.ts` | fn 177 | Queue projection |
| `prepare-admin-generation.ts` | file 284 | Helpers already ≤89 fn |

---

## 6. Automated complexity notes

| Metric | Method | Result |
|---|---|---|
| Max function length | Brace-depth scan | Worker targeted ≤132; overall worker max 339 |
| Branch/case | Qualitative | Logic preserved; moved not rewritten |
| Cycle | madge | **0** |
| Import count | madge warnings / rg | Layered; no reverse facade imports |
