-- Drop legacy KnowledgePayload (ZIP) after cleanup:legacy-zip-payloads --apply.
-- Prerequisite: KnowledgePayload must be empty (script deletes MinIO objects then rows).
-- Rename PayloadStorageCleanupJob → ObjectStorageCleanupJob (payloadId → artifactId).
-- Remove PublicArtifactType / primaryArtifactType ZIP selection.

DO $$
DECLARE
  remaining_payloads bigint;
BEGIN
  SELECT COUNT(*) INTO remaining_payloads FROM "KnowledgePayload";
  IF remaining_payloads > 0 THEN
    RAISE EXCEPTION
      'KnowledgePayload still has % row(s). Run: npm run cleanup:legacy-zip-payloads -- --apply',
      remaining_payloads;
  END IF;
END $$;

-- Rename cleanup status enum (keep values).
ALTER TYPE "PayloadCleanupStatus" RENAME TO "ObjectStorageCleanupStatus";

-- Rename cleanup job table + payloadId → artifactId.
ALTER TABLE "PayloadStorageCleanupJob" RENAME TO "ObjectStorageCleanupJob";
ALTER TABLE "ObjectStorageCleanupJob" RENAME COLUMN "payloadId" TO "artifactId";

-- Drop ZIP KnowledgePayload (FK from version already unique; no dependents after empty).
DROP TABLE IF EXISTS "KnowledgePayload";

DROP TYPE IF EXISTS "PayloadGeneratorType";
DROP TYPE IF EXISTS "PayloadValidationStatus";

-- Remove primaryArtifactType column and PublicArtifactType enum.
ALTER TABLE "PackDistributionMetadata" DROP COLUMN IF EXISTS "primaryArtifactType";
DROP TYPE IF EXISTS "PublicArtifactType";

-- AuditAction: keep PAYLOAD_* values for historical AuditLog rows (Postgres cannot DROP ENUM value safely).
-- New code should prefer DOCLING_* / OBJECT_* actions. No recreate performed here.
