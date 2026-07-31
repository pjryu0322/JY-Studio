# JYKStore P9 — Role Workflow / UX Integration Audit

## 1. Base / Work Commit

| Item | Value |
|------|-------|
| Base (P8 closure) | `9e5cdb11` (`origin/main` at audit start) |
| Scope | `projects/JYKStore/**` only |
| Work | Workflow/UX audit + blocker hardening (canonical restore-publish, public version selection, publish workbench CTAs) |

## 2. Canonical Workflow SoT

| Concern | Source of truth |
|---------|-----------------|
| Admin rail steps | `src/lib/workflow/admin-workflow-steps.ts` — exactly 6 steps |
| Publish / step gates | `src/lib/workflow/admin-workflow-gates.ts` (pure) |
| Provider review + SV markers | `src/lib/store-workflow-markers.ts` (`PipelineRun` triggers) |
| First-time publish | `approvePackReview` — requires `REVIEWING` |
| Post-unpublish restore | `restorePublishedPackAfterUnpublish` — requires `DRAFT` + PRODUCTION + gates |
| Public pack load | `loadPublicRetrievalPack` — PUBLIC statuses + PRODUCTION version preference |

Duplicate/legacy identifiers still exist as **aliases** (`resolveAdminWorkflowStepQuery`, `normalizeAdminWorkQueue`) and must not be treated as operational SoT.

## 3. Admin Rail

Canonical order and labels:

1. `receipt` — 자료 접수  
2. `knowledgeScope` — 지식화 대상 확인  
3. `generation` — 지식데이터 생성  
4. `correction` — 보정  
5. `serviceValidation` — 서비스 검증  
6. `publish` — 게시  

Legacy query aliases map into these steps (`quality` → generation, `providerConfirm` → publish, `ops` → outside rail).

## 4–11. Stage / Gate summary

| Stage | Result |
|-------|--------|
| Receipt / Scope / Generation / Correction / SV | Rail + gate predicates align with golden-path tests in `admin-workflow-core.test.ts` |
| Provider Review | **Publish gate only** — not a rail step; `canPublish` requires SV PASSED + provider CONFIRMED |
| Publish (first) | `approvePackReview` + REVIEWING + binding to current DRAFT READY generation |
| Publish (restore) | `restorePublishedPackAfterUnpublish` + `/restore-publish` + workbench **재게시** CTA |
| Unpublish | `unpublishPackReview` + `/unpublish` + workbench **게시 중단** CTA (preserves PRODUCTION) |

**Copy note:** Review reject CTA remains labeled `게시 취소` (`ADMIN_REVIEW_CTA_REJECT`) while true unpublish is now **게시 중단**. Residual jargon risk for operators; candidate for P10 copy cleanup.

## 6. Provider UX

- Primary provider surface uses business-oriented tabs (기본정보 → 자료 → 요청 대응 → 미리보기 → 게시 현황).
- Preview uses provider/DRAFT validation channels; public catalog remains PUBLISHED/VERIFIED.
- Auth: `requireProviderApiAuth` = logged-in session; pack access filtered by `providerProfileId` ownership (cross-provider pack access blocked at query layer).
- Residual: orphaned `ProviderPackTabs` rail / advanced jargon in some diagnostics — P10 cleanup candidates, not blockers.

## 7. User UX

- Public retrieval / MCP / API gate on `PUBLIC_PACK_STATUSES` (PUBLISHED/VERIFIED).
- After unpublish → DRAFT, `loadPublicRetrievalPack` returns null → `PACK_NOT_FOUND`.

## 8. Canonical Republish E2E

**Before P9:** tests restored serving with raw `prisma.knowledgePack.update({ status: PUBLISHED })` because `approvePackReview` cannot accept post-unpublish DRAFT.

**After P9:**

```text
PUBLISHED
  → unpublishPackReview → DRAFT (PRODUCTION preserved)
  → public/MCP PACK_NOT_FOUND
  → restorePublishedPackAfterUnpublish (SV + provider binding + no open corrections)
  → PUBLISHED + same PRODUCTION generation served
```

Evidence: `src/__tests__/p8-2-3-published-serving-lifecycle.db.test.ts` (application restore, not DB flip).  
UI: `AdminApprovalPublishWorkbenchPanel` wires `unpublishAdminReview` / `restorePublishAdminReview`.

## 9. Multi-version serving policy

**Policy:** Prefer the version that owns the pack’s latest `PRODUCTION` + `PROMOTED` `SearchIndexGeneration`. Fallback to latest `createdAt` version only when no production generation exists (legacy).

Evidence: `src/__tests__/p9-public-version-selection.db.test.ts` — newer draft version is **not** selected while older version owns PRODUCTION.

## 10. CTA / Gate consistency

| Surface | Gate |
|---------|------|
| Publish workbench decide form | `vm.canDecide && status === REVIEWING` |
| Server approve | same canPublish + binding + corrections |
| Restore CTA | DRAFT + SV + provider confirm + no open supplement (server re-checks binding) |
| Unpublish CTA | published-like status only |

## 11. Inbox / Queue

Legacy admin queue query strings normalize via `normalizeAdminWorkQueue` → canonical receipt/work steps. Dead `QUALITY_CHECK_REQUIRED` inbox section remains unused — cleanup candidate.

## 12. Deep link

`resolveAdminWorkflowStepQuery` maps legacy `?step=` values; `ops` returns null (route outside rail).

## 13. Authorization

| Role | Mechanism |
|------|-----------|
| Admin review/publish/unpublish/restore | `requireAdminSession` |
| Provider pack APIs | logged-in + ownership by profile |
| User public retrieval | pack status ∈ PUBLIC only |

Finding (non-blocker): provider API does not require `accountRole === PROVIDER`; ownership still prevents cross-tenant pack access.

## 14. Role E2E

| Path | Status |
|------|--------|
| Admin unpublish → restore → public retrieval (service/DB) | **PASS** |
| Multi-version public selection (DB) | **PASS** |
| Admin/Provider/User full browser walkthrough | **Not executed** in this pass (UI wired; manual/browser Role E2E deferred) |

## 15. Legacy cleanup candidates (P10 — do not delete in P9)

- `ADMIN_REVIEW_CTA_REJECT` label “게시 취소” vs unpublish “게시 중단”
- Unused inbox section `QUALITY_CHECK_REQUIRED`
- Orphaned `ProviderPackTabs` / residual provider jargon surfaces
- Strict `PROVIDER` role check on provider APIs (optional hardening)
- Full browser Role E2E harness

## 16. Regression

| Suite | Result |
|-------|--------|
| `p9-workflow-ux-integration.test.ts` | PASS |
| `p9-public-version-selection.db.test.ts` | PASS |
| `p8-2-3-published-serving-lifecycle.db.test.ts` | PASS |
| `admin-workflow-core.test.ts` | PASS |
| `admin-approval-publish-workbench.test.ts` | PASS |
| `p6-1-publish-revision-gates.test.ts` | PASS |
| `p7-6-embedding-ownership.test.ts` | PASS |
| `p7-published-revision-multichannel.test.ts` | PASS |
| `mcp-stdio-launcher.test.ts` | PASS |
| `tsc --noEmit` | PASS |

## 17. Remaining Gap

1. Browser Role E2E (provider confirm → admin publish → user MCP → unpublish → restore) not run end-to-end in UI.  
2. Reject CTA copy still says “게시 취소”.  
3. Provider auth is session+ownership, not strict role enum.  
4. Restore still requires a live DRAFT READY generation for provider binding currency (same rule as first publish) — if draft is retired without re-confirm, restore correctly fails stale.

## 18. Final Verdict

```text
P9 ROLE WORKFLOW / UX INTEGRATION PASSED
```

Blockers addressed: canonical application restore (not DB-only), multi-version PRODUCTION-preferring serving, admin rail/gate consistency preserved, P7/P8 regressions green. Remaining items are non-blocking cleanup / browser Role E2E follow-ups for P10.
