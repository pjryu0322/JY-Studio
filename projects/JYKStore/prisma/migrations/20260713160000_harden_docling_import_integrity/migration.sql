-- P0-A.1 Docling import hardening: lifecycle fields, partial unique indexes, audit actions

ALTER TYPE "AuditAction" ADD VALUE 'DOCLING_REVIEW_INTEGRITY_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCLING_REVIEW_INTEGRITY_FAILED';

CREATE TYPE "DoclingBundleStorageStatus" AS ENUM (
  'ACTIVE',
  'DELETE_PENDING',
  'DELETED',
  'DELETE_FAILED'
);

ALTER TABLE "DoclingImportBundle" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "DoclingImportBundle" ADD COLUMN "deactivationReason" TEXT;
ALTER TABLE "DoclingImportBundle" ADD COLUMN "replacedByBundleId" TEXT;
ALTER TABLE "DoclingImportBundle" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "DoclingImportBundle" ADD COLUMN "storageStatus" "DoclingBundleStorageStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "DoclingImportBundle" ADD COLUMN "storageDeleteAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DoclingImportBundle" ADD COLUMN "storageLastError" TEXT;

ALTER TABLE "NormalizedDocument" ADD COLUMN "fingerprintVersion" TEXT DEFAULT 'normalized-document-v2';

CREATE INDEX "DoclingImportBundle_storageStatus_idx" ON "DoclingImportBundle"("storageStatus");

-- One active Docling import bundle per pack version
CREATE UNIQUE INDEX "DoclingImportBundle_one_active_per_version"
ON "DoclingImportBundle" ("versionId")
WHERE "isActive" = true;

-- One active NormalizedDocument per bundle
CREATE UNIQUE INDEX "NormalizedDocument_one_active_per_bundle"
ON "NormalizedDocument" ("bundleId")
WHERE "isActive" = true;
