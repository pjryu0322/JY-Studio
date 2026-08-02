# JYKStore P11 Evidence Audit Report

**Audit time (UTC):** 2026-08-02T00:05:26Z (live SQL/S3)  
**Auditor mode:** evidence-only (source + live DB + Object Storage + API + build)  
**Base (P10):** `f9185449`  
**HEAD / origin/main:** `791bf8f5d56cef4847e9e4fac158aef2403a3e26`

---

## 1. Git Evidence

### 1.1 Commits (P10 → HEAD)

| SHA | Message |
|---|---|
| `ca661c5c` | feat(JYKStore): clean-reset DB and object storage to 3 canonical accounts (P11) |
| `1c825a90` … `8d2c68c2` | docs(JYKStore): P11 report / SHA / encoding fixes |

### 1.2 `git diff --stat f9185449..HEAD -- projects/JYKStore`

```text
 .env.example                                       |    6 +-
 .gitignore                                         |    1 +
 docs/JYKStore_P11_db_object_storage_clean_reset.md |  216 ++++
 prisma/seed.ts                                     |   44 +
 scripts/p11-clean-reset.ts                         | 1123 ++++++++++++++++++++
 scripts/p11-db-inventory.ts                        |   12 +
 scripts/p11-object-storage-inventory.ts            |   12 +
 scripts/p11-post-reset-verify.ts                   |   12 +
 scripts/p11-role-empty-smoke.ts                    |  210 ++++
 src/__tests__/p11-clean-reset-safety.test.ts       |   29 +
 10 files changed, 1663 insertions(+), 2 deletions(-)
```

### 1.3 Changed files (name-status)

| Status | Path |
|---|---|
| M | `.env.example`, `.gitignore`, `prisma/seed.ts` |
| A | `docs/JYKStore_P11_db_object_storage_clean_reset.md` |
| A | `scripts/p11-clean-reset.ts` (+ thin wrappers + role smoke) |
| A | `src/__tests__/p11-clean-reset-safety.test.ts` |

**Note:** No application runtime under `src/app` / `src/components` / `src/lib` changed in P11 (except new unit test). Reset is ops-script + seed + data wipe.

---

## 2. Source Audit

### 2.1 `scripts/p11-clean-reset.ts` (canonical)

| Item | Evidence |
|---|---|
| Role | Unified CLI: `inventory` / `dry-run` / `backup` / `execute` / `verify` |
| Safety | Default read-only; execute requires `--execute --confirm JYKSTORE_CLEAN_RESET` (`CONFIRM_TOKEN`, refuse path at ~L1085) |
| Allowlist | `P11_CANONICAL_ACCOUNTS`: admin/provider/user `@jyk.local` |
| DB wipe | Ordered `TRUNCATE TABLE … CASCADE` for pack-derived tables |
| Object wipe | `ListObjectsV2` under configured prefix + `DeleteObjects` batches; `HeadBucket` guard |
| Design match | Matches P11 prompt: dry-run → backup → confirm → delete → seed → verify |
| Risks | `TRUNCATE CASCADE` is destructive (mitigated by confirm + backup gate); prefix-other keys classified ORPHAN (not UNKNOWN blocker) |

### 2.2 `scripts/p11-db-inventory.ts`

| Item | Evidence |
|---|---|
| Role | Thin wrapper → `p11-clean-reset.ts inventory` |
| Design match | Yes (subcommand integration) |
| Risk | LOW |

### 2.3 `scripts/p11-object-storage-cleanup.ts`

| Item | Evidence |
|---|---|
| Path in prompt | **MISSING** — file does not exist |
| Actual | `scripts/p11-object-storage-inventory.ts` (wrapper → inventory) + object delete inside `p11-clean-reset.ts execute` |
| Design match | Functionally covered; **filename mismatch vs audit prompt checklist** |
| Risk | LOW (ops confusion only) |

### 2.4 Prisma-related

| File | Role / change | Design match | Risk |
|---|---|---|---|
| `prisma/seed.ts` | Added `seedCanonicalAccounts()` — 3 users + 1 ProviderProfile; still no demo packs | Yes (P11 seed reconstruction) | LOW; leftover unused `seedPack` lint warning |
| `prisma/schema.prisma` | **Unchanged** in P11 | N/A | — |
| No new migration | Physical wipe via script TRUNCATE, not Prisma migrate | Matches “no DROP migration in P10; P11 wipe” | MED if re-run against wrong DB URL |

### 2.5 Supporting scripts (extra evidence)

| File | Role |
|---|---|
| `scripts/p11-post-reset-verify.ts` | Wrapper → `verify` |
| `scripts/p11-role-empty-smoke.ts` | Live Role/empty API+page smoke |
| `scripts/p11-evidence-sql-audit.ts` | Read-only SQL + S3 counts for this audit |

---

## 3. DB Audit (live SQL)

**Source:** `node --import tsx scripts/p11-evidence-sql-audit.ts` → `tmp-p11-clean-reset/evidence-sql-audit.json`  
**Before snapshot:** `tmp-p11-clean-reset/backup/db-inventory.json` (local, not git)

### 3.1 Counts — After (live `SELECT COUNT(*)`)

| Table | COUNT(*) |
|---|---:|
| User | **3** |
| ProviderProfile | **1** |
| KnowledgePack | **0** |
| KnowledgePackVersion | **0** |
| PackReview | 0 |
| SearchIndexGeneration | 0 |
| KnowledgeChunk | 0 |
| SearchIndexVector | 0 |
| WorkerZipSourceRevision | 0 |
| WorkerZipWorkingCopy | 0 |
| KnowledgeScopeInventory | 0 |
| CorrectionCase | 0 |
| ServiceValidationRun | 0 |
| PipelineRun | 0 |
| ApiKey | 0 |
| DoclingImportBundle | 0 |
| NormalizedDocument | 0 |
| PackCategory | 13 |
| KnowledgeStructureTemplate | 2 |

### 3.2 User Before / After

| | Before (backup inventory) | After (live SQL) |
|---|---|---|
| Count | 5 | 3 |
| Roles | ADMIN×3, PROVIDER×1, USER×1 | ADMIN×1, PROVIDER×1, USER×1 |
| Emails | Non-canonical (full list only in local backup; **not copied here**) | `admin@jyk.local`, `provider@jyk.local`, `user@jyk.local` |

### 3.3 KnowledgePack / Version / ProviderProfile

| Model | Before | After |
|---|---:|---:|
| KnowledgePack | 31 | 0 |
| KnowledgePackVersion | 31 | 0 |
| ProviderProfile | 44 | 1 (linked to provider user) |

Integrity SQL (live):

| Check | Result |
|---|---:|
| Orphan ProviderProfile (`userId IS NULL`) | 0 |
| Pack → missing PackCategory | 0 |

---

## 4. Object Storage Audit

### 4.1 Bucket

| Field | Live value |
|---|---|
| Configured bucket | `jykstore` |
| Prefix | `payloads` |
| `ListBuckets` names | `["jykstore"]` |
| `HeadBucket` | OK |

### 4.2 Object count Before / After

| | Count | Bytes |
|---|---:|---:|
| Before (`BACKUP_COMPLETE.json` / inventory) | 1,686 | 711,221,835 |
| Delete manifest | deleted=1686, failed=[] | — |
| After (live `ListObjectsV2` prefix) | **0** | **0** |

### 4.3 Manifest / allowlist

| Artifact (local `tmp-p11-clean-reset/`) | Present |
|---|---|
| `backup/object-manifest.json` | Yes (~607 KB) |
| `backup/jykstore-p11.dump` | Yes (`pg_dump` ok) |
| `backup/BACKUP_COMPLETE.json` | Yes |
| `object-delete-manifest.json` | Yes (1686/0 failed) |
| Pack objects kept | **None** (allowlist packs=0) |
| System/account objects under prefix | **0** |

---

## 5. API Audit

| Check | Evidence | Result |
|---|---|---|
| `GET /api/health` | `{"ok":true,"service":"jykstore","version":"0.1.0","status":"alive"}` | PASS |
| Admin login | `p11-role-empty-smoke` — `admin@jyk.local` cookies=2 | PASS |
| Provider login | `provider@jyk.local` | PASS |
| User login | `user@jyk.local` | PASS |
| Empty Admin Inbox | `/admin?queue=receipt` status 200 + “자료 접수” | PASS |
| Empty Provider packs | `GET /api/v1/provider/packs` → packs=0 | PASS |
| Public packs page | status 200 | PASS |
| Quick Login 3 accounts | `GET /api/v1/dev/test-accounts` → exactly 3 canonical emails | PASS |

Full smoke report: `tmp-p11-clean-reset/role-smoke.json` (`pass: true`, re-run during this audit).

---

## 6. Build Audit

| Command | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` | exit **0** | Audit shell `tsc_exit=0` |
| `npx prisma validate` | schema valid | Prisma CLI OK |
| `npx next lint` (touched paths) | Warnings only: unused `error` in p11-clean-reset; unused `seedPack` | No errors |
| `npx next build` | **Succeeded** (routes emitted) | `tmp-p11-clean-reset/next-build.log` |
| `npm test` (unit runner) | **264 pass / 6 fail / 270 tests** (exit 1) | `tmp-p11-clean-reset/npm-test.log` |
| P11 safety unit | **2/2 pass** | `p11-clean-reset-safety.test.ts` |
| P9 workflow unit (sample) | **5/5 pass** | re-run with P11 safety |

### 6.1 `npm test` failing suites (observed)

Not introduced by P11 file diff (P11 did not modify failing product sources):

- `review-submit-rag-export-evidence.test.ts` (multiple)
- `store-workflow-handoff-gates.test.ts` (`bindingStatus` assertion)
- Additional assertion errors also observed in log for: `role-based-ux`, `provider-registration-readiness`, `provider-workspace-role-separation`, `account-session-exit-ux`, `docling-import-ux` (runner summary reports **fail 6** — treat full suite as **not green**)

---

## 7. Data Integrity

| Invariant | Evidence | Result |
|---|---|---|
| FK: packs → categories | 0 packs; dangling check 0 | PASS |
| Orphan ProviderProfile | 0 | PASS |
| Dangling objects under prefix | live count 0 | PASS |
| DB keys without objects | verify MISSING_OBJECT=0 | PASS |
| Inventory keep set | Categories 13 + structure templates 2 kept | PASS |
| Pack derived rows | all zero (see §3.1) | PASS |

Pre-reset integrity finding (historical): **18 MISSING_OBJECT** keys in dry-run — DB rows without objects; cleared by truncate; recorded in dry-run, not hidden.

---

## 8. Known Issues

1. **Prompt filename gap:** `scripts/p11-object-storage-cleanup.ts` does not exist; cleanup lives in `p11-clean-reset.ts execute` + inventory wrapper named `p11-object-storage-inventory.ts`.
2. **`npm test` not fully green:** 6 failures in unit suite; appear **pre-existing / out of P11 diff scope**; must be tracked for P12.
3. **Lint warnings:** unused catch `error`; unused `seedPack` in seed.
4. **Personal emails in local backup** (`accounts-allowlist.json`) — must stay out of git (currently gitignored via `tmp-p11-clean-reset/`).
5. **Execute deletes all keys under prefix** including orphans — correct for P11, irreversible without `pg_dump` / object manifest restore.
6. **P11 phase report encoding** needed multiple doc fix commits (`??` corruption under PowerShell) — content re-verified.

---

## 9. Final Verdict (evidence-based)

### PASS criteria for P11 clean-reset (each has evidence)

| Criterion | Evidence pointer | Met? |
|---|---|---|
| Dry-run completed | `dry-run-latest.json` safeToExecute=true | Yes |
| Backup completed | `BACKUP_COMPLETE.json` + `jykstore-p11.dump` | Yes |
| Confirm gate | source refuse without token | Yes |
| ADMIN/PROVIDER/USER = 1 each | live SQL §3 | Yes |
| ProviderProfile = 1 | live SQL | Yes |
| Pack + derived = 0 | live SQL | Yes |
| Pack objects = 0 | live S3 list | Yes |
| Orphan/unknown/missing = 0 | verify + S3 | Yes |
| Quick Login 3 accounts | role-smoke | Yes |
| Role empty UX | role-smoke | Yes |
| tsc / prisma / build | §6 | Yes |

### FAIL conditions (would block P11 reset PASS)

| Condition | Present? |
|---|---|
| No backup / no dry-run | No |
| Pack rows or pack objects remain | No |
| Unknown allowlist / ≠3 users | No |
| DB↔Object mismatch after reset | No |
| Missing evidence for a PASS claim | No (for reset scope) |

### Verdict

```text
P11 CLEAN RESET — EVIDENCE AUDIT PASSED
```

with:

```text
KNOWN ISSUE: npm test unit suite NOT fully green (6 fail) — outside P11 code diff; track in P12
KNOWN ISSUE: prompt path p11-object-storage-cleanup.ts missing (function covered under p11-clean-reset)
```

**Do not claim “entire repository test suite PASS”.** Claim only what evidence supports: **clean-reset invariants + Role empty smoke + tsc/prisma/build**.

---

## Appendix — Local evidence paths (not in git)

```text
tmp-p11-clean-reset/backup/BACKUP_COMPLETE.json
tmp-p11-clean-reset/backup/jykstore-p11.dump
tmp-p11-clean-reset/backup/object-manifest.json
tmp-p11-clean-reset/backup/db-inventory.json
tmp-p11-clean-reset/execute-summary.json
tmp-p11-clean-reset/object-delete-manifest.json
tmp-p11-clean-reset/verify-latest.json
tmp-p11-clean-reset/role-smoke.json
tmp-p11-clean-reset/evidence-sql-audit.json
tmp-p11-clean-reset/npm-test.log
tmp-p11-clean-reset/next-build.log
```
