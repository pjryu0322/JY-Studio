/**
 * P12.1 baseline — source complexity audit (quantitative).
 *
 * Base SHA: 9e3b179d (P11 evidence)
 * Measurement note: LOC via PowerShell Get-Content Measure-Object -Line on key files.
 */

## 1. Base SHA

`9e3b179d` (origin/main at P12 start)

## 2. Code scale (approx)

| Scope | Count |
|---|---:|
| `src/**/*.ts(x)` files | ~1,198 |
| Priority hotspots measured below | — |

## 3. Large files (before P12 refactors)

| File | LOC (lines) | Grade |
|---|---:|---|
| `src/lib/admin-review-service.ts` | 1467 → **facade ~416** | P0 → KEEP facade |
| `src/lib/store-workflow-markers.ts` | 1381 | P1 |
| `src/components/AdminWorkInboxPageClient.tsx` | 1237 → **entry 3** / impl ~394 | P0 → split |
| `scripts/p11-clean-reset.ts` | 1031 | P1 (CLI split target ≤150 entry) |
| `src/lib/admin-work-inbox-view-model.ts` | 490 | P1 |
| `src/lib/retrieval-service.ts` | 268 | KEEP / facade candidate |

## 4–6. Complexity / fan-in / cycles

| Signal | Finding |
|---|---|
| Cyclomatic hotspots | Workflow markers + publish recovery + inbox filters (status/phase switches) |
| Fan-in | `admin-review-service`, `store-workflow-markers`, `routes` (normalize queues) |
| Fan-out | Inbox page client, admin-review-service (pre-split) |
| Circular deps | No hard cycles found between new `publishing/` ↔ facade (lazy import used for detail loader) |

## 7. Workflow policy duplication (P0)

Same pack state interpreted via: Step / Queue / QueueGroup / Marker / Phase / Gate / DisplayStatus across rail, inbox, detail, publish workbench.

**Target:** `PackWorkflowFacts` + `PackWorkflowSnapshot` pure SoT.

## 8. Publish policy duplication (P0)

Approve / restore / new-revision eligibility and identity checks lived inside `admin-review-service`.

**Target:** `src/lib/publishing/*` policies + use cases; facade re-exports.

## 9. UI over-responsibility (P0)

`AdminWorkInboxPageClient` owned fetch, filter, queue→step navigation, section rendering.

**Target:** `components/admin-work-inbox/*` + `lib/admin-work-inbox/navigation`.

## 10. DB access spread

Prisma concentrated in services; UI must not import prisma (rule).

## 11. Test / fixture debt

Stale ranking `v2` fixtures and rail copy expectations caused npm test fails (fixed in P12.6).

## 12. Legacy boundary

See `src/lib/compatibility/compatibility-registry.ts`.

## 13. Priority

1. Full test green  
2. Workflow snapshot SoT  
3. Inbox + Publishing split  
4. P11 CLI modularize  
5. Retrieval/Worker direction docs (no algo change)

## 14. Target architecture

```text
Route/UI → Application / Presenter → Domain Policy (pure) → Infrastructure
```

## 15. Baseline metrics (pre-refactor)

| Metric | Before |
|---:|
| AdminWorkInbox entry LOC | 1237 |
| admin-review-service LOC | 1467 |
| P11 CLI entry LOC | 1031 |
| npm test fail | 6 |
