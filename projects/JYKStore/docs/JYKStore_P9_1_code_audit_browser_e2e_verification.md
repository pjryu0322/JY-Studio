# JYKStore P9.1 — Code Audit & Browser E2E Verification (post-reboot)

Base: `ec280683` → Work: this commit  
Live stack: Postgres accepting connections + `npm run dev` on `:3004`

## Final Verdict

```text
P9.1 PUBLISH REVISION IDENTITY / ROLE E2E PASSED
```

| Gate | Result |
|------|--------|
| 코드 감사 | **PASS** (unchanged from prior audit) |
| UI CTA → Service | **PASS** |
| Retrieval core 회귀 | **PASS** |
| TS | **PASS** (0) |
| DB Identity tests | **PASS** |
| Service Role E2E | **PASS** (5/5) |
| Live DB audit script | **PASS** (hardened; PUBLIC_SERVE_ERROR only on packs without PRODUCTION) |
| Browser E2E Case A/B/C | **PASS** (3/3) |

---

## DB tests (live)

```text
p9-1-publish-recovery.test.ts                          PASS
p9-1-publish-revision-identity.db.test.ts Case A/B     PASS
p8-2-3-published-serving-lifecycle.db.test.ts          PASS
p9-public-version-selection.db.test.ts                 PASS
```

## Service Role E2E

`scripts/p9-1-role-publish-identity-e2e.ts` → `passCount: 5`, `failCount: 0`

| Scenario | Result |
|----------|--------|
| Published serve A | PASS |
| Unpublish → public blocked | PASS |
| Restore Existing → served A | PASS |
| Draft B → restore blocked `NEW_REVISION_PENDING` | PASS |
| New Revision Publish → reviewed=published=served=B | PASS |

## Browser E2E

`scripts/p9-1-browser-role-e2e.ts` (Playwright Chromium)  
Report: `tmp-p9-1-browser-e2e/report.json` (local, not committed)

| Case | Result | Evidence |
|------|--------|----------|
| A Restore Existing | **PASS** | UI shows 게시 중단 / 기존 게시본 다시 게시; restored=served=A |
| B New Revision | **PASS** | UI shows 새 Revision 게시; restore blocked; served=B; A RETIRED |
| C Draft+Production | **PASS** | Public pack page 200; served=PRODUCTION only |

Mode: browser cookie session (admin login API) + publish workbench page + admin recovery APIs + public pack UI.

## Audit script

`scripts/audit-published-revision-identity.ts` now tolerates published packs without PRODUCTION (reports `PUBLIC_SERVE_ERROR` instead of crashing).

## Note

During probing, `ra-pack-a70737b5` was briefly unpublished then restored via `restore-publish` (status confirmed **PUBLISHED** again).
