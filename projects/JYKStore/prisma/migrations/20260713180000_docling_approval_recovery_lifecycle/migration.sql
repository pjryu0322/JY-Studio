-- P0-A.2 Docling approval recovery and cleanup sync (additive)

ALTER TABLE "PayloadStorageCleanupJob" ADD COLUMN "doclingBundleId" TEXT;
ALTER TABLE "PayloadStorageCleanupJob" ADD COLUMN "knowledgePackFileId" TEXT;

CREATE INDEX "PayloadStorageCleanupJob_doclingBundleId_status_idx"
ON "PayloadStorageCleanupJob"("doclingBundleId", "status");

ALTER TABLE "DoclingImportBundle" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "DoclingImportBundle" ADD COLUMN "stagingReason" TEXT;
