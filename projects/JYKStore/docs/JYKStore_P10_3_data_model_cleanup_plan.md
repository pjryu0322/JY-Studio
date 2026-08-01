# JYKStore P10.3 — Data Model / Object Storage / Env Cleanup Plan

**Base SHA:** `69732a51`  
**Rule:** P10 does **not** DROP tables or delete object bytes. Application cleanup first; physical reset is **P11**.

## 1. Prisma model / field actions

| Model / Field | Read refs | Write refs | Row estimate | Risk | Action |
|---|---:|---:|---|---|---|
| KnowledgePack + PackReview + workflow markers (JSON) | High | High | LIVE | — | **KEEP** |
| KnowledgePackVersion / SearchIndexGeneration (PRODUCTION binding) | High | High | LIVE | — | **KEEP** (identity SoT) |
| WorkerZipSourceRevision / WorkerZipWorkingCopy | High | High | LIVE | — | **KEEP** |
| KnowledgeScopeInventory* | High | High | LIVE | — | **KEEP** |
| CorrectionCase / CorrectionAuditEvent | High | High | LIVE | — | **KEEP** |
| ServiceValidation* | High | High | LIVE | — | **KEEP** |
| StructureCoverage* / ChunkQuality* / KnowledgeQuality* / ReleaseGate* / RetrievalEvaluation* | High | Worker + admin quality | LIVE | — | **KEEP** (generation quality domain) |
| KnowledgeChunk / Embedding / SearchIndexVector / Graph* | High | Worker + RAG | LIVE | — | **KEEP** |
| PipelineRun / PipelineStepLog + `PipelineStatus` | Med | Worker ZIP | LIVE | MED | **DEPRECATE** dual vocabulary vs Store markers; no DROP in P10 |
| DoclingImportBundle / DoclingUpload* / DoclingProcessing* | Conditional | Flag UI + worker | LIVE if used | HIGH | **DEPRECATE** → P11 after app write removal |
| SourceDocument.legacySourceType | Med | Worker ZIP bridge | LIVE | LOW | **KEEP** (rename later) |
| ObjectStorageCleanupJob | Ops | Cleanup jobs | LOW | LOW | **KEEP** |
| ApiKey / ApiUsageLog / AuditLog / User / ProviderProfile | High | Auth/ops | LIVE | — | **KEEP** |
| PackInstallation / Organization* | Med | Consumer | LIVE | LOW | **KEEP** (audit unused fields in P11) |
| KnowledgeUnit draft tables (if any residual) | Via 410 routes only | None (frozen) | NOT_VERIFIED | MED | **DROP-P11** after confirming zero app write |

DB unreachable cells would be `NOT_VERIFIED`; live Postgres was available post-P9.1 — estimates remain qualitative until P11 inventory SQL.

## 2. Drop sequence (P11, not P10)

```text
reference audit → remove app read → remove app write → mark deprecated → preserve/decide → migrate/drop
```

Only empty + zero-ref tables may drop earlier; none met that bar in P10.

## 3. Object Storage prefix inventory

Prefix root: `JYKSTORE_PAYLOAD_S3_PREFIX` (default `payloads`).

| Prefix pattern | Class | Notes |
|---|---|---|
| `payloads/packs/{packId}/versions/{versionId}/source-revisions/{id}/source.zip` | **ACTIVE** | Immutable revision ZIP |
| `.../working-copies/{id}/source.zip` | **ACTIVE** | Per-execution WC |
| `.../worker-request/source.zip` | **LEGACY_WRITE** / compat mirror | Stable key; still written for legacy readers |
| `.../runs/{runId}/source/original.zip` | **ACTIVE** | Per-run source copy |
| `.../runs/{runId}/worker-output/**` | **ACTIVE** | Worker artifacts |
| `.../runs/{runId}/rag-export/**` (and related) | **ACTIVE** | Export packages |
| Docling bundle / upload session keys | **LEGACY_READ** / conditional write | Behind Docling path |
| Orphan objects without DB row | **ORPHAN_CANDIDATE** | Enumerate in P11 via `ObjectStorageCleanupJob` + audit script |
| DB row without object | **ORPHAN_CANDIDATE** | Integrity repair / soft-fail in P11 |

**P10 action:** document only. **P11:** delete orphans after identity-safe allowlists (keep one admin / one provider / one user seed).

## 4. Env inventory

| Var | Class | Notes |
|---|---|---|
| `DATABASE_URL`, `JYKSTORE_API_KEY_SECRET`, `JYKSTORE_ADMIN_EMAILS` | **REQUIRED** | Boot / auth |
| Payload S3 `JYKSTORE_PAYLOAD_S3_*` | **REQUIRED** (prod) | Object storage |
| `JYKSTORE_REQUIRE_PGVECTOR` | **REQUIRED** (prod recommended) | Hard fail missing pgvector |
| `JYKSTORE_ALLOW_JSON_VECTOR_FALLBACK` | **OPTIONAL** ops degraded | Ignored if require-pgvector or production |
| Embedding / MCP / quota / anonymous id | **REQUIRED** or **OPTIONAL** per surface | See `.env.example` |
| `JYKSTORE_ENABLE_TEST_ACCOUNT_SWITCHER` | **TEST_ONLY** | Dev loopback |
| `NEXT_PUBLIC_PROVIDER_LEGACY_DOCLING` | **DEPRECATED** | Hide Docling UI by default; document in `.env.example` |
| `GITHUB_TOKEN` | **OPTIONAL** / legacy auto-collect | Routes frozen 410 |
| Docling size/TTL knobs | **DEPRECATED** with Docling stack | Keep until Docling cutover |

No unused required env removed blindly; temporary **test bypass** flags stay off in example.

## 5. P11 input checklist

1. SQL row counts per DROP-P11 / DEPRECATE family  
2. Object key sample vs DB `storageKey` join  
3. Disable Docling UI permanently; remove write paths  
4. Stop writing `worker-request/source.zip` after readers migrate  
5. Clean reset: 1 admin, 1 provider, 1 user + categories only
