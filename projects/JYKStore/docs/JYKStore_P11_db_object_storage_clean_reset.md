# JYKStore P11 — DB / Object Storage Clean Reset

## 1. Base / Work SHA

| | SHA |
|---|---|
| Base | `f9185449` (P10 PASSED) |
| Work | *(this commit)* |

## 2. Maintenance

| Step | Result |
|---|---|
| Stopped Next/dev write stack (`npm run dev`) | Done before execute |
| MinIO kept/restarted for object wipe | Port 9000 healthy |
| Workers / public serving during wipe | Stopped |
| App restarted after verify | `JYKSTORE_REQUIRE_PGVECTOR=true npm run dev` |

## 3. DB Inventory Before

| Model | Count |
|---:|---:|
| User | 5 |
| ProviderProfile | 44 |
| KnowledgePack | 31 |
| KnowledgePackVersion | 31 |
| KnowledgeChunk | 13,223 |
| KnowledgeChunkEmbedding | 12,380 |
| SearchIndexVector | 12,166 |
| PipelineRun | 253 |
| KnowledgeScopeInventoryItem | 1,734 |
| PackCategory (keep) | 13 |

Pack IDs included empirical packs (`rmategridh5webv60`, `p431e2ems633k5n`, `ra-pack-*`, `rh-pack-*`, …) — **all deleted**.

## 4. Object Inventory Before

| Metric | Value |
|---|---:|
| Objects under `payloads/` | 1,686 |
| Bytes | 711,221,835 (~678 MiB) |
| ACTIVE_REFERENCED | 12 |
| ORPHAN_OBJECT | 1,674 |
| MISSING_OBJECT findings | 18 (DB keys without object; removed with DB wipe) |
| UNKNOWN | 0 |

## 5. Account Allowlist

Canonical (seeded / kept):

| Email | Role |
|---|---|
| `admin@jyk.local` | ADMIN |
| `provider@jyk.local` | PROVIDER |
| `user@jyk.local` | USER |

All other users deleted. Quick Login lists exactly these 3.

## 6. Category / System Allowlist

| Item | Action |
|---|---|
| PackCategory (13 from `mockCategories`) | KEEP / re-seed |
| KnowledgeStructureTemplate (2) + sections | KEEP / re-seed |
| No SystemSetting model | n/a |

## 7. Pack Allowlist

```text
유지 Pack = 0
```

## 8–9. Dry-run

```text
safeToExecute: true
blockers: []
packs delete: 31
objects delete: 1686 / 711221835 bytes
accounts: create canonical 3; delete non-canonical
```

CLI:

```bash
node --import tsx scripts/p11-clean-reset.ts inventory
node --import tsx scripts/p11-clean-reset.ts dry-run
node --import tsx scripts/p11-clean-reset.ts backup
node --import tsx scripts/p11-clean-reset.ts execute --execute --confirm JYKSTORE_CLEAN_RESET
node --import tsx scripts/p11-clean-reset.ts verify
```

## 10. Backup

Local only (`tmp-p11-clean-reset/backup/`, **not committed**):

| Artifact | Status |
|---|---|
| `pg_dump` custom format | OK (`jykstore-p11.dump`) |
| `accounts-allowlist.json` | OK (emails/roles only) |
| `object-manifest.json` | OK (key/size/class) |
| `db-inventory.json` | OK |
| `BACKUP_COMPLETE.json` | OK |

## 11. Actual DB Delete

- Truncate pack-derived tables with `CASCADE` (ordered list in CLI)
- Delete non-canonical users, all ApiKeys, organizations
- Idempotent re-run safe after empty state

## 12. Actual Object Delete

| | |
|---|---:|
| Deleted objects | 1,686 |
| Failed keys | 0 |
| Bucket/prefix guard | `HeadBucket` + configured `JYKSTORE_PAYLOAD_S3_PREFIX` |

## 13. Seed Reconstruction

- Categories + structure templates upserted
- 3 users + 1 ProviderProfile for `provider@jyk.local`
- `prisma/seed.ts` updated to create the same canonical trio

## 14. DB Inventory After

| Check | Value |
|---|---:|
| User | 3 |
| ADMIN / PROVIDER / USER | 1 / 1 / 1 |
| ProviderProfile | 1 |
| KnowledgePack | 0 |
| Versions / Reviews / Generations / Chunks / Vectors | 0 |
| WorkerZip* / Scope / Correction / ServiceValidation / Pipeline | 0 |
| PackCategory | 13 |
| Structure templates | 2 |

## 15. Object Inventory After

| Check | Value |
|---|---:|
| Objects under prefix | 0 |
| Orphan / Unknown / Missing | 0 |

## 16. DB/Object Reconciliation

```text
DB Pack = 0
Object Pack prefix = 0
MISSING_OBJECT = 0
```

## 17. Role Login Smoke

`scripts/p11-role-empty-smoke.ts` → **PASS**

- Admin / Provider / User login OK
- Admin inbox shows receipt queue
- Provider pack API count = 0
- Quick Login = exactly 3 canonical emails

## 18. Empty State UX

| Surface | Result |
|---|---|
| Admin Inbox | 200, empty queues |
| Provider Pack List | 0 packs |
| Public Store / packs | 200, no published packs |
| API Key / Usage | Clean (ApiKey=0) |

## 19. Regression

| Check | Result |
|---|---|
| `p11-clean-reset-safety` unit | PASS |
| Prisma validate | PASS |
| `tsc --noEmit` | PASS |
| Lint (touched) | No new errors (pre-existing script warnings only) |
| Pack P7/P8/P9 E2E | Deferred to **P13** (new pack) |

## 20. Findings

- 18 pre-reset `MISSING_OBJECT` integrity findings (DB storageKey without object) — cleared by DB truncate; reported in dry-run, not hidden.
- Personal/dev accounts present before reset were removed in favor of canonical `@jyk.local` trio.

## 21. Remaining Risk

- Local `.env` must include `JYKSTORE_ADMIN_EMAILS=admin@jyk.local` for allowlist promotion on login.
- Backups live only under `tmp-p11-clean-reset/` — retain outside git if needed.
- P13 must register a **new** pack (no restore of wiped packs).

## 22. Final Verdict

```text
P11 DB / OBJECT STORAGE CLEAN RESET PASSED
```

### 삭제 증적

| 영역 | Before | Deleted | Kept | After | Result |
|---|---:|---:|---:|---:|---|
| User | 5 | 5 | 3 (seeded) | 3 | PASS |
| ProviderProfile | 44 | 44 | 1 | 1 | PASS |
| KnowledgePack | 31 | 31 | 0 | 0 | PASS |
| Chunks/Vectors/Gens | ~37k+ | all | 0 | 0 | PASS |
| Objects | 1,686 | 1,686 | 0 | 0 | PASS |
| Bytes | 711,221,835 | 711,221,835 | 0 | 0 | PASS |
