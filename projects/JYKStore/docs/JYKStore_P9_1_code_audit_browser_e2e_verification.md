# JYKStore P9.1 — Code Audit & Browser E2E Verification

Base commit: `f571950c` (`origin/main`)

## Verdict

```text
P9.1 VERIFICATION FAILED — PASS 선언 금지
```

| Gate | Result |
|------|--------|
| 코드 감사 | **PASS** |
| UI CTA → Service 매핑 | **PASS** |
| Retrieval core 회귀 | **PASS** (diff empty vs P9) |
| 신규 TS 오류 | **PASS** (0) |
| DB Identity (live) | **FAIL** — Postgres `127.0.0.1:5432` hung |
| Browser E2E Case A/B/C | **FAIL** — not executed (DB down + no live session) |
| Audit script live output | **FAIL** — DB unreachable |

---

## 1. Code audit

### 1.1 `restorePublishedPackAfterUnpublish`

File: `src/lib/admin-review-service.ts`

| Check | Evidence |
|-------|----------|
| Draft Review 미참조 | Restore body does **not** call `assertProviderReviewBindingCurrent` |
| Production identity only | Uses `resolvePublishRecoveryForPack` → Unpublish audit `preservedProductionGenerationId` |
| New draft blocks restore | `recovery.mode === "PUBLISH_NEW_REVISION"` → `NEW_REVISION_PENDING` |
| Atomic restore | Tx re-validates PRODUCTION/PROMOTED + pack DRAFT→PUBLISHED |
| Audit | `RESTORE_EXISTING_AFTER_UNPUBLISH` with `restoredGenerationId = preservedId` |

### 1.2 `publishNewRevisionAfterUnpublish`

| Check | Evidence |
|-------|----------|
| Draft binding only | `assertProviderReviewBindingCurrent` + must equal `currentDraftGenerationId` |
| Forbid reusing Production A | Rejects if `binding.indexGenerationId === preservedGenerationId` (`RESTORE_EXISTING_AVAILABLE`) |
| Promote then publish | `promoteSearchGeneration(reviewedGenerationId)` then pack status |
| Identity return | `reviewedGenerationId = publishedGenerationId = servedGenerationId` |

### 1.3 `resolvePublishRecoveryMode` / `resolvePublishRecoveryForPack`

| Mode | Condition |
|------|-----------|
| `RESTORE_EXISTING` | DRAFT + unpublish snapshot + preserved valid + no material post-unpublish change |
| `PUBLISH_NEW_REVISION` | Material change / new Draft READY after unpublish |
| `BLOCKED` | Not DRAFT, open supplement/correction, missing/invalid snapshot |

Pure tests: `src/__tests__/p9-1-publish-recovery.test.ts` — **PASS**

### 1.4 Retrieval core unchanged

```text
git diff 29e4819a..f571950c -- src/lib/retrieval src/lib/mcp ...
→ empty (no retrieval/MCP core edits in P9.1)
```

---

## 2. UI audit

File: `AdminApprovalPublishWorkbenchPanel.tsx` + `AdminReviewAcceptTab.tsx`

| CTA | Client API | Server route / service |
|-----|------------|------------------------|
| 게시 중단 | `unpublishAdminReview` | `POST .../unpublish` → `unpublishPackReview` |
| 기존 게시본 다시 게시 | `restorePublishAdminReview` | `POST .../restore-publish` → `restorePublishedPackAfterUnpublish` |
| 새 Revision 게시 | `publishNewRevisionAdminReview` | `POST .../publish-new-revision` → `publishNewRevisionAfterUnpublish` |
| 검수 반려 | `rejectAdminReview` | `POST .../reject` → `rejectPackReview` |

Labels: `ADMIN_REVIEW_CTA_*` in `role-based-ux-copy.ts` — reject ≠ unpublish.

Mode source for restore/new: `GET .../publish-recovery` → `resolvePublishRecoveryForPack`.

---

## 3. Browser E2E

### Attempted

1. Postgres restart (non-admin) — **Access denied**; postmaster hung (`worker took too long to start; canceled`).
2. Elevated `Restart-Service` via UAC — still `pg_isready` exit 2 afterward.
3. No browser MCP; Playwright available via npx but app/DB unavailable for real flows.

### Case status

| Case | Required | Status |
|------|----------|--------|
| A Restore Existing — preserved=published=served=A | Browser + DB | **NOT RUN** |
| B New Revision — reviewed=published=served=B | Browser + DB | **NOT RUN** |
| C Draft+Production — public serves Production only | Browser + DB | **NOT RUN** (unit coverage exists when DB up: `p9-public-version-selection.db.test.ts`) |

Harness stub (fails closed without env): `scripts/p9-1-browser-role-e2e.ts`  
Service identity script (needs DB): `scripts/p9-1-role-publish-identity-e2e.ts`

### Case A “Reviewed=A” note

Restore Existing intentionally **does not** re-bind current Draft review. Invariant for Case A is:

```text
preservedGenerationId = restoredGenerationId = servedGenerationId = A
```

Current provider-review binding may be empty/stale and must not gate restore.

---

## 4. DB verification / Audit script

```text
pg_isready -h 127.0.0.1 -p 5432 → exit 2 (no response)
prisma SELECT 1 → Can't reach database server
scripts/audit-published-revision-identity.ts → not executable until Postgres recovers
```

DB suites skip when unreachable (`t.skip`), not silent-pass.

---

## 5. Static regression executed this pass

| Suite | Result |
|-------|--------|
| `p9-1-publish-recovery.test.ts` | PASS |
| `p7-published-revision-multichannel.test.ts` | PASS |
| `tsc --noEmit` | 0 errors |
| Live DB identity / browser | FAIL / NOT RUN |

---

## 6. Unblock checklist (operator)

1. Admin PowerShell: `Restart-Service postgresql-x64-14 -Force`
2. Confirm: `pg_isready -h 127.0.0.1 -p 5432` → accepting connections
3. `npm run dev` (port 3004)
4. `node --import tsx --test src/__tests__/p9-1-publish-revision-identity.db.test.ts`
5. `node --import tsx scripts/p9-1-role-publish-identity-e2e.ts`
6. `node --import tsx scripts/audit-published-revision-identity.ts`
7. Set `P91_*` env + `npx playwright install chromium` then `node --import tsx scripts/p9-1-browser-role-e2e.ts` (selectors may need tuning to live login)

Only after steps 4–7 green may P9.1 be declared **PASSED**.
