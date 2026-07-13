-- P0-A.3: Docling safe staging defaults + one live staging per version + ND language fields

ALTER TABLE "DoclingImportBundle" ALTER COLUMN "isActive" SET DEFAULT false;

ALTER TABLE "NormalizedDocument" ADD COLUMN IF NOT EXISTS "languageSource" TEXT;
ALTER TABLE "NormalizedDocument" ADD COLUMN IF NOT EXISTS "languageConfidence" DOUBLE PRECISION;
ALTER TABLE "NormalizedDocument" ADD COLUMN IF NOT EXISTS "structureSummaryJson" JSONB;

-- One live (non-active, storage-active, not deleted) staging bundle per version
CREATE UNIQUE INDEX IF NOT EXISTS "DoclingImportBundle_one_live_staging_per_version"
ON "DoclingImportBundle" ("versionId")
WHERE
  "isActive" = false
  AND "storageStatus" = 'ACTIVE'::"DoclingBundleStorageStatus"
  AND "deletedAt" IS NULL;
