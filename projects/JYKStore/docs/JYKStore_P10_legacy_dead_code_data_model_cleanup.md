# JYKStore P10 — Legacy / Dead Code / Data Model Cleanup

## 1. Base / Work Commit

| | SHA |
|---|---|
| Base | `69732a51` (P9.1 PASSED) |
| Work | *(this commit)* |

## 2. Reference Inventory

See `docs/JYKStore_P10_1_reference_inventory.md`.

## 3. Canonical Runtime Map

```text
receipt → knowledgeScope → generation → correction → serviceValidation → publish
Provider Review = Publish Gate (not rail step)
RESTORE_EXISTING | PUBLISH_NEW_REVISION | BLOCKED
```

## 4. Deleted files

| Path | Action | Reason | Reference proof | Regression |
|---|---|---|---|---|
| `src/components/AdminReviewDecisionPanel.tsx` | DELETE | Deprecated re-export; zero runtime imports | Grep: only negative test asserts | PASS |
| `src/components/AdminReviewDecisionSummary.tsx` | DELETE | Deprecated re-export → AcceptTab | Only DecisionPanel | PASS |
| `scripts/p4-3-1-check-run.ts` | DELETE | Hard-coded pack probe | No package script / imports | n/a |
| `scripts/p4-3-pack-state.ts` | DELETE | Hard-coded pack probe | Same | n/a |
| `scripts/p4-3-1-bootstrap-lookup.ts` | DELETE | Hard-coded probe | Same | n/a |
| `scripts/p4-3-db-snapshot.ts` | DELETE | Debug snapshot | Same | n/a |
| `scripts/p4-3-deep-probe.ts` | DELETE | One-off debug | Same | n/a |
| `scripts/p4-3-analyze-worker-output.ts` | DELETE | One-off debug | Same | n/a |
| `scripts/p4-3-inventory-capability-scan.ts` | DELETE | One-off debug | Same | n/a |
| `scripts/p4-3-provenance-map-check.ts` | DELETE | One-off debug | Same | n/a |

## 5. Consolidated / cleaned

| Path / Identifier | Action | Reason |
|---|---|---|
| `QUALITY_CHECK_REQUIRED` inbox group | DELETE | Never assigned by mapper; dead section/badge |
| `adminAccept` BottomTab | DELETE | Duplicate of `admin` / `adminReceipt` |
| KU drafts admin page | Redirect → `adminReviews` | Bookmark compat; UI body removed |
| `isOpenAdminSupplementPhase` | CONSOLIDATE | Alias of `isOpenProviderSupplementPhase` |
| `.gitignore` | Expand | `tmp-p*-e2e/`, `tmp-p*-browser-e2e/` |
| `.env.example` | Document | `NEXT_PUBLIC_PROVIDER_LEGACY_DOCLING` DEPRECATED |

## 6. Kept compatibility

- Legacy queue parsers: `accept` / `quality` / `provider-review` / `approval-publish` → canonical
- Legacy step query aliases: `providerConfirm` / `decision` / `searchValidation`
- ~25× `LEGACY_BUILDER_DISABLED` **410** freeze routes (intentional contract)
- Publish recovery trio + identity audit metadata
- Generation-internal quality domain (`AdminQualityCheckPanel`, quality reports)

## 7–12. Cleanup areas

| Area | Result |
|---|---|
| Workflow | Canonical 6-step intact; Provider Review remains publish gate |
| Inbox/Queue | Dead `QUALITY_CHECK_REQUIRED` removed; legacy filter keys still normalize |
| Publish | No change to restore / new-revision identity services |
| UI | Decision re-exports + duplicate tab removed; KU page → redirect |
| API/Route | Freeze 410 stubs **kept**; no duplicate publish route removal |
| Script/Test | Obsolete p4-3 probes removed; `p4-3-1-admin-e2e.ts` kept |

## 13. Prisma audit

See `docs/JYKStore_P10_3_data_model_cleanup_plan.md`. **No DROP in P10.**

## 14. Object Storage audit

Active `payloads/packs/.../source-revisions|working-copies|runs|worker-request` documented; orphan deletion deferred to **P11**.

## 15. Env cleanup

Documented deprecated Docling UI flag; ops degraded `JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK` retained.

## 16. High-risk not deleted

| Candidate | Why kept |
|---|---|
| Docling models + upload APIs | Conditional runtime + data |
| `PipelineStatus` | Still written by worker pipeline |
| 410 builder stubs | External contract / freeze tests |
| Legacy queue deep-link parsers | Bookmarks |

## 17. Regression

| Check | Result |
|---|---|
| Inbox / rail / decision UX unit | PASS |
| P9 workflow SoT + P9.1 recovery unit | PASS |
| P9.1 identity DB Case A/B | PASS |
| Prisma validate | PASS |
| `tsc --noEmit` | PASS |
| Lint (touched) | PASS (pre-existing hooks warning only) |
| Service Role E2E (`p9-1-role-publish-identity-e2e`) | **5/5 PASS** |
| Browser Role E2E | *(see §18)* |

## 18. Role E2E

| Case | Result |
|---|---|
| A. Existing Production Restore | **PASS** (service + browser) |
| B. New Revision Publish | **PASS** (service + browser) |
| C. Draft + Production coexistence | **PASS** (browser) |

Service Role E2E: **5/5 PASS**. Browser Playwright: **3/3 PASS**.
## 19. Remaining Gap → P11

- Physical DB/object clean reset
- Docling schema/UI cutover
- Stop `worker-request` stable mirror writes after readers migrate
- Optional retirement of legacy queue alias types after traffic dies

## 20. Final Verdict

```text
P10 LEGACY / DEAD CODE / DATA MODEL CLEANUP PASSED
```
