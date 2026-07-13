-- P0-A Docling three-file import foundation (additive only)

-- AlterEnum AuditAction
ALTER TYPE "AuditAction" ADD VALUE 'DOCLING_IMPORT_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCLING_IMPORT_VALIDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCLING_IMPORT_NORMALIZED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCLING_IMPORT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCLING_IMPORT_RETRIED';

-- CreateEnum
CREATE TYPE "DoclingImportBundleStatus" AS ENUM (
  'UPLOADED',
  'VALIDATING',
  'VALIDATION_FAILED',
  'VALID',
  'NORMALIZING',
  'NORMALIZED',
  'NORMALIZATION_FAILED',
  'REVIEW_READY'
);

CREATE TYPE "KnowledgePackFileRole" AS ENUM (
  'SOURCE_ORIGINAL',
  'DOCLING_JSON',
  'DOCLING_MARKDOWN'
);

CREATE TYPE "DoclingProcessingStage" AS ENUM (
  'UPLOAD',
  'VALIDATION',
  'NORMALIZATION',
  'RETRY'
);

CREATE TYPE "DoclingProcessingStatus" AS ENUM (
  'STARTED',
  'SUCCEEDED',
  'FAILED'
);

-- CreateTable
CREATE TABLE "DoclingImportBundle" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "DoclingImportBundleStatus" NOT NULL DEFAULT 'UPLOADED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "adapterType" TEXT NOT NULL DEFAULT 'DOCLING',
    "adapterVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "doclingSchemaName" TEXT,
    "doclingSchemaVersion" TEXT,
    "validationReport" JSONB,
    "normalizationReport" JSONB,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "uploadedByUserId" TEXT,
    "validatedAt" TIMESTAMP(3),
    "normalizedAt" TIMESTAMP(3),
    "reviewReadyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoclingImportBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgePackFile" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "role" "KnowledgePackFileRole" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "isImmutable" BOOLEAN NOT NULL DEFAULT true,
    "uploadedByUserId" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgePackFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NormalizedDocument" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "adapterType" TEXT NOT NULL DEFAULT 'DOCLING',
    "adapterVersion" TEXT NOT NULL,
    "sourceSchemaName" TEXT,
    "sourceSchemaVersion" TEXT,
    "title" TEXT,
    "language" TEXT,
    "structureJson" JSONB,
    "sectionsJson" JSONB,
    "tablesJson" JSONB,
    "figuresJson" JSONB,
    "readingOrderJson" JSONB,
    "warningsJson" JSONB,
    "sourceFileId" TEXT,
    "jsonPayloadFileId" TEXT,
    "markdownPayloadFileId" TEXT,
    "sourcePayloadChecksum" TEXT,
    "fingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NormalizedDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DoclingProcessingLog" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "stage" "DoclingProcessingStage" NOT NULL,
    "status" "DoclingProcessingStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "adapterVersion" TEXT,
    "message" TEXT,
    "errorCode" TEXT,
    "detailsJson" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoclingProcessingLog_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "DoclingImportBundle_packId_versionId_idx" ON "DoclingImportBundle"("packId", "versionId");
CREATE INDEX "DoclingImportBundle_versionId_isActive_idx" ON "DoclingImportBundle"("versionId", "isActive");
CREATE INDEX "DoclingImportBundle_status_idx" ON "DoclingImportBundle"("status");

CREATE UNIQUE INDEX "KnowledgePackFile_bundleId_role_key" ON "KnowledgePackFile"("bundleId", "role");
CREATE INDEX "KnowledgePackFile_packId_versionId_idx" ON "KnowledgePackFile"("packId", "versionId");
CREATE INDEX "KnowledgePackFile_checksumSha256_idx" ON "KnowledgePackFile"("checksumSha256");
CREATE INDEX "KnowledgePackFile_storageKey_idx" ON "KnowledgePackFile"("storageKey");

CREATE INDEX "NormalizedDocument_bundleId_isActive_idx" ON "NormalizedDocument"("bundleId", "isActive");
CREATE INDEX "NormalizedDocument_packId_versionId_idx" ON "NormalizedDocument"("packId", "versionId");

CREATE INDEX "DoclingProcessingLog_bundleId_stage_createdAt_idx" ON "DoclingProcessingLog"("bundleId", "stage", "createdAt");

-- ForeignKeys
ALTER TABLE "DoclingImportBundle" ADD CONSTRAINT "DoclingImportBundle_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DoclingImportBundle" ADD CONSTRAINT "DoclingImportBundle_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KnowledgePackFile" ADD CONSTRAINT "KnowledgePackFile_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "DoclingImportBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgePackFile" ADD CONSTRAINT "KnowledgePackFile_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "KnowledgePackFile" ADD CONSTRAINT "KnowledgePackFile_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NormalizedDocument" ADD CONSTRAINT "NormalizedDocument_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "DoclingImportBundle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NormalizedDocument" ADD CONSTRAINT "NormalizedDocument_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NormalizedDocument" ADD CONSTRAINT "NormalizedDocument_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DoclingProcessingLog" ADD CONSTRAINT "DoclingProcessingLog_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "DoclingImportBundle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
