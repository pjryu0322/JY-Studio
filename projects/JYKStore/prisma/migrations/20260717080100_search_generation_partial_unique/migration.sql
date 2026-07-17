-- Migration B: active Draft / Production uniqueness for SearchIndexGeneration.
-- Applied after dual-write + backfill. Does not force NOT NULL on nullable FKs.

CREATE UNIQUE INDEX IF NOT EXISTS "SearchIndexGeneration_one_active_draft_per_version"
ON "SearchIndexGeneration" ("versionId")
WHERE "scope" = 'DRAFT'
  AND "status" IN ('PENDING', 'EMBEDDING', 'INDEXING', 'READY');

CREATE UNIQUE INDEX IF NOT EXISTS "SearchIndexGeneration_one_production_per_version"
ON "SearchIndexGeneration" ("versionId")
WHERE "scope" = 'PRODUCTION'
  AND "status" = 'PROMOTED';
