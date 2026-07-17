-- CreateEnum
CREATE TYPE "SearchIndexGenerationStatus" AS ENUM ('PENDING', 'EMBEDDING', 'INDEXING', 'READY', 'FAILED', 'STALE', 'PROMOTED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SearchIndexGenerationScope" AS ENUM ('DRAFT', 'PRODUCTION');

-- AlterTable
ALTER TABLE "KnowledgeChunk" ADD COLUMN     "chunkGenerationId" TEXT;

-- AlterTable
ALTER TABLE "KnowledgeChunkEmbedding" ADD COLUMN     "searchIndexGenerationId" TEXT;

-- AlterTable
ALTER TABLE "ObjectStorageCleanupJob" RENAME CONSTRAINT "PayloadStorageCleanupJob_pkey" TO "ObjectStorageCleanupJob_pkey";

-- AlterTable
ALTER TABLE "ServiceValidationRun" ADD COLUMN     "searchIndexGenerationId" TEXT;

-- CreateTable
CREATE TABLE "SearchIndexGeneration" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "pipelineRunId" TEXT NOT NULL,
    "normalizedDocumentId" TEXT NOT NULL,
    "chunkGenerationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "embeddingProvider" TEXT NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "embeddingDimension" INTEGER NOT NULL,
    "distanceMetric" TEXT NOT NULL,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "embeddedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" "SearchIndexGenerationStatus" NOT NULL,
    "scope" "SearchIndexGenerationScope" NOT NULL DEFAULT 'DRAFT',
    "generationFingerprint" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "staleAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchIndexGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchIndexGeneration_packId_idx" ON "SearchIndexGeneration"("packId");

-- CreateIndex
CREATE INDEX "SearchIndexGeneration_versionId_idx" ON "SearchIndexGeneration"("versionId");

-- CreateIndex
CREATE INDEX "SearchIndexGeneration_normalizedDocumentId_idx" ON "SearchIndexGeneration"("normalizedDocumentId");

-- CreateIndex
CREATE INDEX "SearchIndexGeneration_pipelineRunId_idx" ON "SearchIndexGeneration"("pipelineRunId");

-- CreateIndex
CREATE INDEX "SearchIndexGeneration_chunkGenerationId_idx" ON "SearchIndexGeneration"("chunkGenerationId");

-- CreateIndex
CREATE INDEX "SearchIndexGeneration_status_idx" ON "SearchIndexGeneration"("status");

-- CreateIndex
CREATE INDEX "SearchIndexGeneration_scope_idx" ON "SearchIndexGeneration"("scope");

-- CreateIndex
CREATE INDEX "SearchIndexGeneration_generationFingerprint_idx" ON "SearchIndexGeneration"("generationFingerprint");

-- CreateIndex
CREATE INDEX "SearchIndexGeneration_versionId_scope_status_idx" ON "SearchIndexGeneration"("versionId", "scope", "status");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_chunkGenerationId_idx" ON "KnowledgeChunk"("chunkGenerationId");

-- CreateIndex
CREATE INDEX "KnowledgeChunkEmbedding_searchIndexGenerationId_idx" ON "KnowledgeChunkEmbedding"("searchIndexGenerationId");

-- CreateIndex
CREATE INDEX "ServiceValidationRun_searchIndexGenerationId_idx" ON "ServiceValidationRun"("searchIndexGenerationId");

-- AddForeignKey
ALTER TABLE "ServiceValidationRun" ADD CONSTRAINT "ServiceValidationRun_searchIndexGenerationId_fkey" FOREIGN KEY ("searchIndexGenerationId") REFERENCES "SearchIndexGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunkEmbedding" ADD CONSTRAINT "KnowledgeChunkEmbedding_searchIndexGenerationId_fkey" FOREIGN KEY ("searchIndexGenerationId") REFERENCES "SearchIndexGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIndexGeneration" ADD CONSTRAINT "SearchIndexGeneration_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIndexGeneration" ADD CONSTRAINT "SearchIndexGeneration_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchIndexGeneration" ADD CONSTRAINT "SearchIndexGeneration_normalizedDocumentId_fkey" FOREIGN KEY ("normalizedDocumentId") REFERENCES "NormalizedDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "PayloadStorageCleanupJob_doclingBundleId_status_idx" RENAME TO "ObjectStorageCleanupJob_doclingBundleId_status_idx";

-- RenameIndex
ALTER INDEX "PayloadStorageCleanupJob_objectKey_idx" RENAME TO "ObjectStorageCleanupJob_objectKey_idx";

-- RenameIndex
ALTER INDEX "PayloadStorageCleanupJob_status_createdAt_idx" RENAME TO "ObjectStorageCleanupJob_status_createdAt_idx";

-- RenameIndex
ALTER INDEX "ServiceValidationProviderConfirmation_sharedConfirmationGroupId" RENAME TO "ServiceValidationProviderConfirmation_sharedConfirmationGro_idx";
