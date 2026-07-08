-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PRODUCT_MANUAL', 'INTEGRATION_GUIDE', 'API_SPEC', 'OPENAPI_SCHEMA', 'ERROR_CODE_TABLE', 'SAMPLE_CODE', 'FAQ', 'RELEASE_NOTE', 'SECURITY_GUIDE', 'TEST_ENV_GUIDE', 'OPERATION_GUIDE', 'CALLBACK_GUIDE', 'TROUBLESHOOTING', 'ETC');

-- CreateEnum
CREATE TYPE "SourceFormat" AS ENUM ('TEXT', 'MARKDOWN', 'HTML', 'PDF', 'DOCX', 'XLSX', 'CSV', 'JSON', 'YAML', 'OPENAPI_JSON', 'OPENAPI_YAML', 'CODE', 'URL', 'ETC');

-- CreateEnum
CREATE TYPE "SourceValidationStatus" AS ENUM ('NOT_CHECKED', 'PASS', 'WARNING', 'FAIL');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('SOURCE_REGISTERING', 'SOURCE_VALIDATING', 'STRUCTURING', 'STRUCTURE_VALIDATING', 'KNOWLEDGE_CHECKING', 'CHUNKING', 'CHUNK_EVALUATING', 'INDEXING', 'SEARCH_EVALUATING', 'READY_FOR_REVIEW', 'REVIEWING', 'APPROVED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "PipelineStepStatus" AS ENUM ('PENDING', 'RUNNING', 'PASS', 'WARNING', 'FAIL', 'SKIPPED');

-- AlterTable KnowledgePack
ALTER TABLE "KnowledgePack" ADD COLUMN "pipelineStatus" "PipelineStatus" NOT NULL DEFAULT 'SOURCE_REGISTERING',
ADD COLUMN "pipelineUpdatedAt" TIMESTAMP(3);

-- AlterTable SourceDocument: preserve legacy free-text sourceType before enum conversion
ALTER TABLE "SourceDocument" ADD COLUMN "legacySourceType" TEXT;
UPDATE "SourceDocument" SET "legacySourceType" = "sourceType";

-- Convert sourceType from free text to enum (unknown values mapped to ETC)
ALTER TABLE "SourceDocument" ALTER COLUMN "sourceType" TYPE "SourceType" USING (
    CASE upper("sourceType")
        WHEN 'PRODUCT_MANUAL' THEN 'PRODUCT_MANUAL'::"SourceType"
        WHEN 'INTEGRATION_GUIDE' THEN 'INTEGRATION_GUIDE'::"SourceType"
        WHEN 'API_SPEC' THEN 'API_SPEC'::"SourceType"
        WHEN 'OPENAPI_SCHEMA' THEN 'OPENAPI_SCHEMA'::"SourceType"
        WHEN 'ERROR_CODE_TABLE' THEN 'ERROR_CODE_TABLE'::"SourceType"
        WHEN 'SAMPLE_CODE' THEN 'SAMPLE_CODE'::"SourceType"
        WHEN 'FAQ' THEN 'FAQ'::"SourceType"
        WHEN 'RELEASE_NOTE' THEN 'RELEASE_NOTE'::"SourceType"
        WHEN 'SECURITY_GUIDE' THEN 'SECURITY_GUIDE'::"SourceType"
        WHEN 'TEST_ENV_GUIDE' THEN 'TEST_ENV_GUIDE'::"SourceType"
        WHEN 'OPERATION_GUIDE' THEN 'OPERATION_GUIDE'::"SourceType"
        WHEN 'CALLBACK_GUIDE' THEN 'CALLBACK_GUIDE'::"SourceType"
        WHEN 'TROUBLESHOOTING' THEN 'TROUBLESHOOTING'::"SourceType"
        WHEN 'ETC' THEN 'ETC'::"SourceType"
        ELSE 'ETC'::"SourceType"
    END
);
ALTER TABLE "SourceDocument" ALTER COLUMN "sourceType" SET DEFAULT 'ETC';

-- AlterTable SourceDocument: new pipeline foundation columns
ALTER TABLE "SourceDocument" ADD COLUMN "sourceFormat" "SourceFormat" NOT NULL DEFAULT 'TEXT',
ADD COLUMN "fileName" TEXT,
ADD COLUMN "mimeType" TEXT,
ADD COLUMN "productVersion" TEXT,
ADD COLUMN "documentVersion" TEXT,
ADD COLUMN "licenseStatus" TEXT,
ADD COLUMN "validationStatus" "SourceValidationStatus" NOT NULL DEFAULT 'NOT_CHECKED',
ADD COLUMN "validationSummary" TEXT,
ADD COLUMN "registeredByClientId" TEXT,
ADD COLUMN "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "KnowledgePack_pipelineStatus_idx" ON "KnowledgePack"("pipelineStatus");

-- CreateIndex
CREATE INDEX "SourceDocument_versionId_idx" ON "SourceDocument"("versionId");

-- CreateIndex
CREATE INDEX "SourceDocument_sourceType_idx" ON "SourceDocument"("sourceType");

-- CreateIndex
CREATE INDEX "SourceDocument_validationStatus_idx" ON "SourceDocument"("validationStatus");

-- CreateTable
CREATE TABLE "PipelineRun" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "status" "PipelineStepStatus" NOT NULL DEFAULT 'RUNNING',
    "triggerType" TEXT NOT NULL,
    "triggeredByClientId" TEXT,
    "summary" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStepLog" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "step" "PipelineStatus" NOT NULL,
    "status" "PipelineStepStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "details" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineStepLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineRun_packId_idx" ON "PipelineRun"("packId");

-- CreateIndex
CREATE INDEX "PipelineRun_status_idx" ON "PipelineRun"("status");

-- CreateIndex
CREATE INDEX "PipelineRun_triggerType_idx" ON "PipelineRun"("triggerType");

-- CreateIndex
CREATE INDEX "PipelineRun_startedAt_idx" ON "PipelineRun"("startedAt");

-- CreateIndex
CREATE INDEX "PipelineStepLog_runId_idx" ON "PipelineStepLog"("runId");

-- CreateIndex
CREATE INDEX "PipelineStepLog_packId_idx" ON "PipelineStepLog"("packId");

-- CreateIndex
CREATE INDEX "PipelineStepLog_step_idx" ON "PipelineStepLog"("step");

-- CreateIndex
CREATE INDEX "PipelineStepLog_status_idx" ON "PipelineStepLog"("status");

-- AddForeignKey
ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStepLog" ADD CONSTRAINT "PipelineStepLog_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStepLog" ADD CONSTRAINT "PipelineStepLog_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;
