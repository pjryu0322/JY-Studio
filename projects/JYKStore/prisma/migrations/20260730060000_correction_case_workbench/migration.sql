-- P5: Exception-only Correction Workbench

CREATE TYPE "CorrectionTargetType" AS ENUM ('FILE', 'STRUCTURE', 'CHUNK');
CREATE TYPE "CorrectionSeverity" AS ENUM ('BLOCKER', 'WARNING');
CREATE TYPE "CorrectionCaseStatus" AS ENUM ('OPEN', 'APPLIED', 'REGENERATED', 'VERIFIED', 'CLOSED');
CREATE TYPE "CorrectionRequestedAction" AS ENUM (
  'FILE_EXCLUDE',
  'FILE_REQUEST_PROVIDER',
  'STRUCTURE_DELETE',
  'STRUCTURE_MERGE',
  'CHUNK_DELETE',
  'CHUNK_MERGE'
);

ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_CORRECTION_APPLY';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_CORRECTION_REGENERATE';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_CORRECTION_VERIFY';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_CORRECTION_CLOSE';

CREATE TABLE "CorrectionCase" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "targetType" "CorrectionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "secondaryTargetId" TEXT,
    "issueCode" TEXT,
    "severity" "CorrectionSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceLocation" TEXT,
    "contentPreview" TEXT,
    "recommendedAction" "CorrectionRequestedAction",
    "status" "CorrectionCaseStatus" NOT NULL DEFAULT 'OPEN',
    "generationRunId" TEXT,
    "searchIndexGenerationId" TEXT,
    "inventoryItemId" TEXT,
    "relativePath" TEXT,
    "parameters" JSONB,
    "appliedAt" TIMESTAMP(3),
    "appliedByUserId" TEXT,
    "regeneratedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectionCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CorrectionAuditEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "CorrectionCaseStatus",
    "toStatus" "CorrectionCaseStatus",
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrectionAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CorrectionCase_packId_status_idx" ON "CorrectionCase"("packId", "status");
CREATE INDEX "CorrectionCase_versionId_status_idx" ON "CorrectionCase"("versionId", "status");
CREATE INDEX "CorrectionCase_targetType_targetId_idx" ON "CorrectionCase"("targetType", "targetId");
CREATE INDEX "CorrectionCase_createdAt_idx" ON "CorrectionCase"("createdAt");
CREATE INDEX "CorrectionAuditEvent_caseId_createdAt_idx" ON "CorrectionAuditEvent"("caseId", "createdAt");

ALTER TABLE "CorrectionCase" ADD CONSTRAINT "CorrectionCase_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorrectionCase" ADD CONSTRAINT "CorrectionCase_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CorrectionAuditEvent" ADD CONSTRAINT "CorrectionAuditEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "CorrectionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
