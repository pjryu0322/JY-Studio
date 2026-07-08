-- CreateTable
CREATE TABLE "ChunkQualityReport" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "coverageScore" INTEGER NOT NULL DEFAULT 0,
    "traceabilityScore" INTEGER NOT NULL DEFAULT 0,
    "sizeScore" INTEGER NOT NULL DEFAULT 0,
    "duplicateScore" INTEGER NOT NULL DEFAULT 0,
    "metadataScore" INTEGER NOT NULL DEFAULT 0,
    "structureAlignmentScore" INTEGER NOT NULL DEFAULT 0,
    "activeChunkCount" INTEGER NOT NULL DEFAULT 0,
    "inactiveChunkCount" INTEGER NOT NULL DEFAULT 0,
    "sourceDocumentCount" INTEGER NOT NULL DEFAULT 0,
    "coveredSourceDocumentCount" INTEGER NOT NULL DEFAULT 0,
    "orphanChunkCount" INTEGER NOT NULL DEFAULT 0,
    "missingSourceChunkCount" INTEGER NOT NULL DEFAULT 0,
    "shortChunkCount" INTEGER NOT NULL DEFAULT 0,
    "longChunkCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateChunkCount" INTEGER NOT NULL DEFAULT 0,
    "chunkWithoutMetadataCount" INTEGER NOT NULL DEFAULT 0,
    "blockingIssueCount" INTEGER NOT NULL DEFAULT 0,
    "warningIssueCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "checkedBy" TEXT NOT NULL DEFAULT 'SYSTEM_RULE',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChunkQualityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChunkQualityIssue" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "field" TEXT,
    "hint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChunkQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChunkQualityChunkMetric" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "chunkId" TEXT,
    "sourceDocumentId" TEXT,
    "title" TEXT,
    "contentLength" INTEGER NOT NULL DEFAULT 0,
    "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "issues" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChunkQualityChunkMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChunkQualityReport_packId_idx" ON "ChunkQualityReport"("packId");

-- CreateIndex
CREATE INDEX "ChunkQualityReport_versionId_idx" ON "ChunkQualityReport"("versionId");

-- CreateIndex
CREATE INDEX "ChunkQualityReport_status_idx" ON "ChunkQualityReport"("status");

-- CreateIndex
CREATE INDEX "ChunkQualityReport_checkedAt_idx" ON "ChunkQualityReport"("checkedAt");

-- CreateIndex
CREATE INDEX "ChunkQualityIssue_reportId_idx" ON "ChunkQualityIssue"("reportId");

-- CreateIndex
CREATE INDEX "ChunkQualityIssue_severity_idx" ON "ChunkQualityIssue"("severity");

-- CreateIndex
CREATE INDEX "ChunkQualityIssue_code_idx" ON "ChunkQualityIssue"("code");

-- CreateIndex
CREATE INDEX "ChunkQualityChunkMetric_reportId_idx" ON "ChunkQualityChunkMetric"("reportId");

-- CreateIndex
CREATE INDEX "ChunkQualityChunkMetric_chunkId_idx" ON "ChunkQualityChunkMetric"("chunkId");

-- CreateIndex
CREATE INDEX "ChunkQualityChunkMetric_sourceDocumentId_idx" ON "ChunkQualityChunkMetric"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "ChunkQualityChunkMetric_status_idx" ON "ChunkQualityChunkMetric"("status");

-- AddForeignKey
ALTER TABLE "ChunkQualityReport" ADD CONSTRAINT "ChunkQualityReport_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkQualityReport" ADD CONSTRAINT "ChunkQualityReport_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkQualityIssue" ADD CONSTRAINT "ChunkQualityIssue_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ChunkQualityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChunkQualityChunkMetric" ADD CONSTRAINT "ChunkQualityChunkMetric_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ChunkQualityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
