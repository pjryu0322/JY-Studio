-- CreateEnum
CREATE TYPE "DistributionRightsBasis" AS ENUM ('PUBLIC_LICENSE', 'RIGHTS_HOLDER', 'AUTHORIZED_BY_RIGHTS_HOLDER', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceValidationChannel" AS ENUM ('API', 'MCP', 'DOWNLOAD');

-- CreateEnum
CREATE TYPE "ServiceValidationStatus" AS ENUM ('NOT_SELECTED', 'PENDING', 'RUNNING', 'PASS', 'FAIL', 'STALE');

-- AlterTable
ALTER TABLE "PackDistributionMetadata"
  ADD COLUMN "allowApi" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowMcp" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "rightsBasis" "DistributionRightsBasis",
  ADD COLUMN "rightsBasisDetail" TEXT,
  ADD COLUMN "rightsConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "rightsConfirmedByUserId" TEXT,
  ADD COLUMN "serviceEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ServiceValidationRun" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "channel" "ServiceValidationChannel" NOT NULL,
    "status" "ServiceValidationStatus" NOT NULL DEFAULT 'PENDING',
    "pipelineRunId" TEXT,
    "indexGenerationId" TEXT,
    "normalizedDocumentId" TEXT,
    "fingerprint" TEXT,
    "testedAt" TIMESTAMP(3),
    "testedByUserId" TEXT,
    "query" TEXT,
    "resultCount" INTEGER,
    "topChunkId" TEXT,
    "sourceDocumentId" TEXT,
    "page" INTEGER,
    "latencyMs" INTEGER,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceValidationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceValidationRun_versionId_channel_key" ON "ServiceValidationRun"("versionId", "channel");

-- CreateIndex
CREATE INDEX "ServiceValidationRun_packId_channel_status_idx" ON "ServiceValidationRun"("packId", "channel", "status");

-- CreateIndex
CREATE INDEX "ServiceValidationRun_versionId_status_idx" ON "ServiceValidationRun"("versionId", "status");

-- AddForeignKey
ALTER TABLE "ServiceValidationRun" ADD CONSTRAINT "ServiceValidationRun_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceValidationRun" ADD CONSTRAINT "ServiceValidationRun_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
