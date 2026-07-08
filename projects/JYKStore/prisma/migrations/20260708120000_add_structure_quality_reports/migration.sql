-- AlterTable
ALTER TABLE "KnowledgePack" ADD COLUMN "structureTemplateKey" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeStructureTemplate" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeStructureTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeStructureSection" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "weight" INTEGER NOT NULL DEFAULT 10,
    "sourceTypes" TEXT[],
    "keywords" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeStructureSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureCoverageReport" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "coverageScore" INTEGER NOT NULL DEFAULT 0,
    "requiredSectionCount" INTEGER NOT NULL DEFAULT 0,
    "coveredRequiredCount" INTEGER NOT NULL DEFAULT 0,
    "missingRequiredCount" INTEGER NOT NULL DEFAULT 0,
    "optionalSectionCount" INTEGER NOT NULL DEFAULT 0,
    "coveredOptionalCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "checkedBy" TEXT NOT NULL DEFAULT 'SYSTEM_RULE',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructureCoverageReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StructureCoverageItem" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL,
    "covered" BOOLEAN NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "matchedDocIds" TEXT[],
    "matchedSignals" TEXT[],
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StructureCoverageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeQualityReport" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalScore" INTEGER NOT NULL DEFAULT 0,
    "completenessScore" INTEGER NOT NULL DEFAULT 0,
    "consistencyScore" INTEGER NOT NULL DEFAULT 0,
    "sourceQualityScore" INTEGER NOT NULL DEFAULT 0,
    "securityScore" INTEGER NOT NULL DEFAULT 0,
    "freshnessScore" INTEGER NOT NULL DEFAULT 0,
    "usabilityScore" INTEGER NOT NULL DEFAULT 0,
    "blockingIssueCount" INTEGER NOT NULL DEFAULT 0,
    "warningIssueCount" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL,
    "checkedBy" TEXT NOT NULL DEFAULT 'SYSTEM_RULE',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeQualityReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeQualityIssue" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "field" TEXT,
    "hint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeQualityIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeStructureTemplate_templateKey_key" ON "KnowledgeStructureTemplate"("templateKey");
CREATE INDEX "KnowledgeStructureTemplate_templateKey_idx" ON "KnowledgeStructureTemplate"("templateKey");
CREATE INDEX "KnowledgeStructureTemplate_isActive_idx" ON "KnowledgeStructureTemplate"("isActive");

CREATE UNIQUE INDEX "KnowledgeStructureSection_templateId_sectionKey_key" ON "KnowledgeStructureSection"("templateId", "sectionKey");
CREATE INDEX "KnowledgeStructureSection_templateId_idx" ON "KnowledgeStructureSection"("templateId");
CREATE INDEX "KnowledgeStructureSection_required_idx" ON "KnowledgeStructureSection"("required");

CREATE INDEX "StructureCoverageReport_packId_idx" ON "StructureCoverageReport"("packId");
CREATE INDEX "StructureCoverageReport_versionId_idx" ON "StructureCoverageReport"("versionId");
CREATE INDEX "StructureCoverageReport_templateKey_idx" ON "StructureCoverageReport"("templateKey");
CREATE INDEX "StructureCoverageReport_status_idx" ON "StructureCoverageReport"("status");
CREATE INDEX "StructureCoverageReport_checkedAt_idx" ON "StructureCoverageReport"("checkedAt");

CREATE INDEX "StructureCoverageItem_reportId_idx" ON "StructureCoverageItem"("reportId");
CREATE INDEX "StructureCoverageItem_sectionKey_idx" ON "StructureCoverageItem"("sectionKey");
CREATE INDEX "StructureCoverageItem_covered_idx" ON "StructureCoverageItem"("covered");
CREATE INDEX "StructureCoverageItem_required_idx" ON "StructureCoverageItem"("required");

CREATE INDEX "KnowledgeQualityReport_packId_idx" ON "KnowledgeQualityReport"("packId");
CREATE INDEX "KnowledgeQualityReport_versionId_idx" ON "KnowledgeQualityReport"("versionId");
CREATE INDEX "KnowledgeQualityReport_status_idx" ON "KnowledgeQualityReport"("status");
CREATE INDEX "KnowledgeQualityReport_checkedAt_idx" ON "KnowledgeQualityReport"("checkedAt");

CREATE INDEX "KnowledgeQualityIssue_reportId_idx" ON "KnowledgeQualityIssue"("reportId");
CREATE INDEX "KnowledgeQualityIssue_severity_idx" ON "KnowledgeQualityIssue"("severity");
CREATE INDEX "KnowledgeQualityIssue_code_idx" ON "KnowledgeQualityIssue"("code");

-- AddForeignKey
ALTER TABLE "KnowledgeStructureSection" ADD CONSTRAINT "KnowledgeStructureSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "KnowledgeStructureTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StructureCoverageReport" ADD CONSTRAINT "StructureCoverageReport_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StructureCoverageReport" ADD CONSTRAINT "StructureCoverageReport_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StructureCoverageItem" ADD CONSTRAINT "StructureCoverageItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "StructureCoverageReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeQualityReport" ADD CONSTRAINT "KnowledgeQualityReport_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeQualityReport" ADD CONSTRAINT "KnowledgeQualityReport_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeQualityIssue" ADD CONSTRAINT "KnowledgeQualityIssue_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "KnowledgeQualityReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
