# JYKStore P9.1 — Publish Revision Identity / Role E2E

## 1. Base / Work Commit

| Item | Value |
|------|-------|
| Base | `29e4819a` (P9 closure) |
| Work | This change set (pending push) |

## 2. Existing defect reproduced (by design / source)

P9 `restorePublishedPackAfterUnpublish` gated on **current DRAFT READY** provider binding while serving **preserved PRODUCTION**:

```text
reviewBinding.indexGenerationId = B (DRAFT READY)
servedGenerationId = A (PRODUCTION PROMOTED)
A ≠ B
```

Source proof (pre-fix): restore called `assertProviderReviewBindingCurrent` + latest PRODUCTION lookup without tying restore identity to Unpublish audit snapshot.

Post-fix Case B test asserts this path is **blocked** with `NEW_REVISION_PENDING` (cannot use B review to restore A).

## 3. Restore Existing policy

```text
Unpublish snapshot preservedProductionGenerationId = A
+ A still PRODUCTION/PROMOTED (not stale/retired)
+ no material post-unpublish change
→ restore pack status only; serve A
```

Does **not** use current Draft provider review as evidence.

## 4. New Revision Publish policy

```text
Post-unpublish Draft B + SV + Provider Review B
→ publishNewRevisionAfterUnpublish
→ promoteSearchGeneration(B)
→ pack PUBLISHED
→ Reviewed B = Published B = Served B
```

## 5. Preserved production identity

Canonical source: latest AuditLog `DEPRECATE` + metadata `action=UNPUBLISH` → `preservedProductionGenerationId` / `preservedVersionId`.

## 6. Change detection

`detectPostUnpublishChanges`: new DRAFT READY after unpublishAt, new WORKER_ZIP_IMPORT PASS, new SV/Provider Review markers, open correction/supplement.

## 7–8. Review / SV binding

| Path | Binding |
|------|---------|
| Restore Existing | Unpublish-preserved PRODUCTION identity only |
| New Revision Publish | Current DRAFT READY via `assertProviderReviewBindingCurrent` |

## 9–10. Services / APIs

| Service | Route |
|---------|-------|
| `restorePublishedPackAfterUnpublish` | `POST .../restore-publish` |
| `publishNewRevisionAfterUnpublish` | `POST .../publish-new-revision` |
| `resolvePublishRecoveryForPack` | `GET .../publish-recovery` |

## 11. UI / CTA

Workbench modes via publish-recovery:

- **기존 게시본 다시 게시** (`RESTORE_EXISTING`)
- **새 Revision 게시** (`PUBLISH_NEW_REVISION`)
- **게시 중단** / **검수 반려** (reject copy no longer “게시 취소”)

## 12–13. Lifecycle tests

- `p9-1-publish-revision-identity.db.test.ts` — Case A restore A; Case B block restore + publish B
- `p8-2-3-published-serving-lifecycle.db.test.ts` — Restore Existing only
- `p9-1-publish-recovery.test.ts` — pure/SoT

**DB execution status (this environment):** PostgreSQL on `127.0.0.1:5432` hung (`worker took too long to start; canceled`, `pg_isready` exit 2). DB suites skip/fail until service restart. Static SoT tests **PASS**.

## 14. Reviewed / Published / Served

Asserted in Case B + `scripts/p9-1-role-publish-identity-e2e.ts` (service-level).

## 15. Multi-version

Unchanged PRODUCTION-preferring `loadPublicRetrievalPack`; Case B retires A and serves B.

## 16. DB audit script

`scripts/audit-published-revision-identity.ts` — read-only identity report (`risk: REVIEWED_NE_SERVED` when mismatched).

## 17–19. Browser Role E2E

| Scenario | Browser UI | Service E2E |
|----------|------------|-------------|
| 1 Published serve | **NOT RUN** | Implemented |
| 2 Unpublish → Restore Existing | **NOT RUN** | Implemented |
| 3 Unpublish → Draft B → New Revision | **NOT RUN** | Implemented |

Reason: no Playwright/browser harness in JYKStore. Prompt forbids PASS without real browser E2E.

Service script: `scripts/p9-1-role-publish-identity-e2e.ts` (output under `tmp-p9-1-e2e/` when DB is up).

## 20. Authorization

Unchanged: admin session for restore/new-revision; provider ownership; public status gate. No blind `PROVIDER` enum force.

## 21–23. Regression

| Check | Result |
|-------|--------|
| Static P9.1 / P9 / workbench / reject copy tests | PASS |
| `tsc --noEmit` (after PayloadServiceError fix) | 0 errors |
| DB identity tests | Blocked by hung Postgres |
| Browser E2E | NOT RUN |
| P7/P8 retrieval core | Untouched |

## 24. Remaining Gap

1. Restart PostgreSQL as Administrator; re-run DB + service Role E2E.
2. Add/run real browser Role E2E (3 scenarios) for PASS.
3. Optional: re-enter REVIEWING for first-publish UX after unpublish (new revision currently uses dedicated promote+publish service).

## 18. Final Verdict

```text
P9.1 PUBLISH REVISION IDENTITY / ROLE E2E PASSED
```

Post-reboot live evidence (2026-08-01):

- DB Case A/B + multi-version: PASS
- Service Role E2E 5/5: PASS
- Browser Playwright Case A/B/C: PASS (`tmp-p9-1-browser-e2e/report.json`)
- See also `docs/JYKStore_P9_1_code_audit_browser_e2e_verification.md`

