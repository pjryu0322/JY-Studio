-- Corrective migration: make unrelated renames from 20260717054932 idempotent-safe
-- for environments where the old names never existed (or already renamed).
-- Does NOT modify the already-applied 20260717054932 migration file.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PayloadStorageCleanupJob_pkey'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ObjectStorageCleanupJob_pkey'
  ) THEN
    ALTER TABLE "ObjectStorageCleanupJob" RENAME CONSTRAINT "PayloadStorageCleanupJob_pkey" TO "ObjectStorageCleanupJob_pkey";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'PayloadStorageCleanupJob_doclingBundleId_status_idx'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'ObjectStorageCleanupJob_doclingBundleId_status_idx'
  ) THEN
    ALTER INDEX "PayloadStorageCleanupJob_doclingBundleId_status_idx"
      RENAME TO "ObjectStorageCleanupJob_doclingBundleId_status_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'PayloadStorageCleanupJob_objectKey_idx'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'ObjectStorageCleanupJob_objectKey_idx'
  ) THEN
    ALTER INDEX "PayloadStorageCleanupJob_objectKey_idx"
      RENAME TO "ObjectStorageCleanupJob_objectKey_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'PayloadStorageCleanupJob_status_createdAt_idx'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'ObjectStorageCleanupJob_status_createdAt_idx'
  ) THEN
    ALTER INDEX "PayloadStorageCleanupJob_status_createdAt_idx"
      RENAME TO "ObjectStorageCleanupJob_status_createdAt_idx";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'ServiceValidationProviderConfirmation_sharedConfirmationGroupId'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'ServiceValidationProviderConfirmation_sharedConfirmationGro_idx'
  ) THEN
    ALTER INDEX "ServiceValidationProviderConfirmation_sharedConfirmationGroupId"
      RENAME TO "ServiceValidationProviderConfirmation_sharedConfirmationGro_idx";
  END IF;
END $$;
