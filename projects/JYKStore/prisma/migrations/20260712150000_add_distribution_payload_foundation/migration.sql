-- CreateEnum
CREATE TYPE "PayloadGeneratorType" AS ENUM ('DOCLING', 'UNSTRUCTURED');

-- CreateEnum
CREATE TYPE "PayloadValidationStatus" AS ENUM ('PENDING', 'VALID', 'INVALID');

-- CreateEnum
CREATE TYPE "DistributionVisibility" AS ENUM ('PRIVATE', 'PUBLIC', 'UNLISTED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'PAYLOAD_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYLOAD_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYLOAD_VALIDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DISTRIBUTION_METADATA_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DISTRIBUTION_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'PAYLOAD_DOWNLOADED';

-- CreateTable
CREATE TABLE "KnowledgePayload" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "generatorType" "PayloadGeneratorType" NOT NULL,
    "generatorVersion" TEXT,
    "originalFileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "validationStatus" "PayloadValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationMessage" TEXT,
    "validationReport" JSONB,
    "manifestJson" JSONB,
    "isImmutable" BOOLEAN NOT NULL DEFAULT true,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgePayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackDistributionMetadata" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sourceTitle" TEXT,
    "sourceUrl" TEXT,
    "licenseName" TEXT NOT NULL,
    "licenseUrl" TEXT,
    "usageTerms" TEXT,
    "readmeText" TEXT,
    "visibility" "DistributionVisibility" NOT NULL DEFAULT 'PRIVATE',
    "allowDownload" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackDistributionMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePayload_versionId_key" ON "KnowledgePayload"("versionId");

-- CreateIndex
CREATE INDEX "KnowledgePayload_packId_idx" ON "KnowledgePayload"("packId");

-- CreateIndex
CREATE INDEX "KnowledgePayload_checksumSha256_idx" ON "KnowledgePayload"("checksumSha256");

-- CreateIndex
CREATE UNIQUE INDEX "PackDistributionMetadata_versionId_key" ON "PackDistributionMetadata"("versionId");

-- CreateIndex
CREATE INDEX "PackDistributionMetadata_packId_idx" ON "PackDistributionMetadata"("packId");

-- AddForeignKey
ALTER TABLE "KnowledgePayload" ADD CONSTRAINT "KnowledgePayload_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePayload" ADD CONSTRAINT "KnowledgePayload_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDistributionMetadata" ADD CONSTRAINT "PackDistributionMetadata_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackDistributionMetadata" ADD CONSTRAINT "PackDistributionMetadata_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
