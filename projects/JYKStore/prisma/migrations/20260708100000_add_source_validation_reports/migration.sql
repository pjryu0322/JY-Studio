-- CreateTable
CREATE TABLE "SourceValidationReport" (
    "id" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "sourceFormat" "SourceFormat" NOT NULL,
    "status" "SourceValidationStatus" NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "issueCount" INTEGER NOT NULL DEFAULT 0,
    "blockingIssueCount" INTEGER NOT NULL DEFAULT 0,
    "warningIssueCount" INTEGER NOT NULL DEFAULT 0,
    "checkedBy" TEXT NOT NULL DEFAULT 'SYSTEM_RULE',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceValidationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceValidationIssue" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "field" TEXT,
    "hint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceValidationIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceValidationReport_sourceDocumentId_idx" ON "SourceValidationReport"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "SourceValidationReport_packId_idx" ON "SourceValidationReport"("packId");

-- CreateIndex
CREATE INDEX "SourceValidationReport_versionId_idx" ON "SourceValidationReport"("versionId");

-- CreateIndex
CREATE INDEX "SourceValidationReport_status_idx" ON "SourceValidationReport"("status");

-- CreateIndex
CREATE INDEX "SourceValidationReport_checkedAt_idx" ON "SourceValidationReport"("checkedAt");

-- CreateIndex
CREATE INDEX "SourceValidationIssue_reportId_idx" ON "SourceValidationIssue"("reportId");

-- CreateIndex
CREATE INDEX "SourceValidationIssue_severity_idx" ON "SourceValidationIssue"("severity");

-- CreateIndex
CREATE INDEX "SourceValidationIssue_code_idx" ON "SourceValidationIssue"("code");

-- AddForeignKey
ALTER TABLE "SourceValidationReport" ADD CONSTRAINT "SourceValidationReport_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceValidationReport" ADD CONSTRAINT "SourceValidationReport_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceValidationReport" ADD CONSTRAINT "SourceValidationReport_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceValidationIssue" ADD CONSTRAINT "SourceValidationIssue_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "SourceValidationReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
