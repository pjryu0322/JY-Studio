# JYKStore P12 — Source Complexity Reduction

## 1. Base / Work SHA

| | SHA |
|---|---|
| Base | `9e3b179d` (P11 evidence) |
| Work | `c13f86d2f977e1f25fdd06aa8ff610e9aa852d31` |

## 2. Before complexity metrics

See `docs/JYKStore_P12_1_source_complexity_audit.md`.

| Metric | Before |
|---:|
| AdminWorkInbox entry LOC | 1237 |
| admin-review-service LOC | 1467 |
| P11 CLI entry LOC | 1031 |
| npm test fail | 6 |

## 3. Target architecture

```text
Route / UI
→ Presenter / Application
→ Domain Policy (pure; PackWorkflowSnapshot, publishing policies)
→ Infrastructure (Prisma / S3 / Worker)
```

Legacy aliases only at compatibility boundary (`compatibility-registry.ts`).

## 4. Workflow Snapshot

| Artifact | Role |
|---|---|
| `src/lib/workflow/pack-workflow-facts.ts` | Raw facts type + WorkflowAction enum |
| `src/lib/workflow/pack-workflow-snapshot.ts` | Pure SoT: currentStep, actions, blockingReasons |
| Tests | `pack-workflow-snapshot.test.ts` |

Provider Review remains a **publish gate**, never a rail step.

## 5. Workflow policy consolidation

- Gates remain in `admin-workflow-gates.ts` (pure)
- Snapshot composes gates; UI should consume Snapshot / navigation helpers
- Inbox queue→step mapping moved to `lib/admin-work-inbox/admin-work-inbox-navigation.ts`

## 6. Admin Inbox split

| Path | Role |
|---|---|
| `components/AdminWorkInboxPageClient.tsx` | Re-export entry (**2 LOC**) |
| `components/admin-work-inbox/*` | Toolbar, Summary, Table, Sections, PageClient (~394 LOC) |
| `lib/admin-work-inbox/*` | Navigation, format, mappers |

## 7. Publishing split

| Path | Role |
|---|---|
| `lib/publishing/*` | Use cases + identity/eligibility policies |
| `lib/admin-review-service.ts` | Compatibility facade (**~416 LOC**) |

External names preserved: `approvePackReview`, `rejectPackReview`, `unpublishPackReview`, `restorePublishedPackAfterUnpublish`, `publishNewRevisionAfterUnpublish`.

## 8. Worker boundary

No Worker parsing/embedding algorithm changes. Worker services were not moved this phase (risk); documented as remaining high-complexity (`store-workflow-markers`, python-worker services).

## 9. Retrieval boundary

`retrieval-service.ts` kept as facade entry; quality/pgvector/policy unchanged. Deep `retrieval/**` ownership documented in audit; large move deferred to avoid contract risk.

## 10. Test architecture

- Stale expectations fixed (ranking v3, rail labels, panel summaryMessage, generation panel name)
- Added `pack-workflow-snapshot` + ensured P9/P11 safety in `unit-test-files.json`
- `npm test`: **284 pass / 0 fail**

## 11. Six known failures — resolution

| Failure cluster | Fix |
|---|---|
| RAG export evidence PIPELINE_NOT_CURRENT | Fixture `relevance_diversity_v2` → `v3` |
| Provider registration readiness | Same v3 |
| Account menu “지식데이터 접수” | Expect “자료 접수” |
| Ops 대시보드 rail label | Expect “공개/운영” |
| Admin rail `categories` | Expect 6-step keys |
| Panel `bindingStatus` literal | Expect `vm.summaryMessage` |
| Docling detail card name | Expect `AdminKnowledgeGenerationPanel` |

## 12. P11 CLI split

| Path | Role |
|---|---|
| `scripts/p11-clean-reset.ts` | Thin entry (**22 LOC**) |
| `scripts/p11/**` | policy / db / storage / commands |

Safety: `--execute --confirm JYKSTORE_CLEAN_RESET` unchanged; wrappers retained.

## 13. Compatibility registry

`src/lib/compatibility/compatibility-registry.ts` lists queue/step aliases, 410 freeze, Docling flag, worker-request mirror, JSON vector fallback, admin-review facade.

## 14. Dependency rules

Documented direction in §3. Automated dependency-cruiser not added (audit script / tsc sufficient this phase). New modules avoid Domain→Prisma (snapshot/policies pure).

## 15. Files (summary)

**Added:** `admin-work-inbox/`, `publishing/`, `workflow/pack-workflow-*`, `compatibility/`, `scripts/p11/`, P12 docs, snapshot test  
**Reduced:** inbox entry, admin-review-service facade, p11 entry  
**Unchanged contracts:** Public API / MCP / RAG / Worker algorithms / Prisma schema / Object key layout

## 16. After complexity metrics

| Metric | After |
|---:|
| AdminWorkInbox entry LOC | 2 |
| Inbox impl LOC | 394 |
| admin-review-service LOC | 416 |
| P11 CLI entry LOC | 22 |
| npm test fail | 0 |
| npm test total | 284 |

## 17. Before / After

| 지표 | Before | After | 목표 | 결과 |
|---|---:|---:|---:|---|
| AdminWorkInbox entry LOC | 1237 | 2 | -50% | **PASS** (−99%) |
| admin-review-service LOC | 1467 | 416 facade | -60%/facade | **PASS** |
| P11 CLI entry LOC | 1031 | 22 | ≤150 | **PASS** |
| Circular dependency | 0 hard | 0 hard | 0 | **PASS** |
| UI Queue→Step in entry | yes | moved to lib | 0 in UI entry | **PASS** |
| npm test fail | 6 | 0 | 0 | **PASS** |

## 18. Full regression

| Check | Result |
|---|---|
| `npm test` | **284/284 PASS** |
| `tsc --noEmit` | PASS |
| `prisma validate` | PASS |
| lint (touched) | warnings only (pre-existing hooks) |
| P9 publish recovery / workflow unit | PASS |
| P11 safety | PASS |
| PackWorkflowSnapshot unit | PASS |

## 19. Known Issues

- `store-workflow-markers.ts` still large (~1381 LOC) — further Fact loader extraction remains
- Retrieval deep folder move not executed (facade-only) to protect P8 quality
- Worker service file split deferred
- Some call sites still import `admin-review-service` facade (compat registry)
- Full browser Role E2E with disposable packs deferred to P14 (DB clean; no ops pack recreate here)

## 20. Remaining high-complexity

| File | Why kept |
|---|---|
| `store-workflow-markers.ts` | Broad marker SoT; needs dedicated Facts loader PR |
| `python-worker/*` large services | Algorithm freeze |
| `retrieval/**` internal layout | Quality freeze |

## 21. Final Verdict

```text
P12 SOURCE COMPLEXITY REDUCTION PASSED
```

Evidence: LOC targets met, Snapshot/Publishing/Inbox/P11 CLI splits landed, identity/policies preserved, **npm test 0 FAIL**.
