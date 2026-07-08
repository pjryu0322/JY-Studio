-- AlterEnum
ALTER TYPE "PipelineStatus" ADD VALUE 'RELEASE_CHECKING';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_RELEASE_GATE_EVALUATE';

-- CreateTable
CREATE TABLE "ReleaseGateRun" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT,
    "targetStatus" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blockingIssueCount" INTEGER NOT NULL DEFAULT 0,
    "warningIssueCount" INTEGER NOT NULL DEFAULT 0,
    "sourceStatus" TEXT,
    "structureStatus" TEXT,
    "chunkStatus" TEXT,
    "retrievalStatus" TEXT,
    "graphStatus" TEXT,
    "summary" TEXT NOT NULL,
    "checkedBy" TEXT NOT NULL DEFAULT 'SYSTEM_RULE',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseGateRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReleaseGateIssue" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "field" TEXT,
    "hint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleaseGateIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReleaseGateRun_packId_idx" ON "ReleaseGateRun"("packId");

-- CreateIndex
CREATE INDEX "ReleaseGateRun_versionId_idx" ON "ReleaseGateRun"("versionId");

-- CreateIndex
CREATE INDEX "ReleaseGateRun_targetStatus_idx" ON "ReleaseGateRun"("targetStatus");

-- CreateIndex
CREATE INDEX "ReleaseGateRun_status_idx" ON "ReleaseGateRun"("status");

-- CreateIndex
CREATE INDEX "ReleaseGateRun_checkedAt_idx" ON "ReleaseGateRun"("checkedAt");

-- CreateIndex
CREATE INDEX "ReleaseGateIssue_runId_idx" ON "ReleaseGateIssue"("runId");

-- CreateIndex
CREATE INDEX "ReleaseGateIssue_severity_idx" ON "ReleaseGateIssue"("severity");

-- CreateIndex
CREATE INDEX "ReleaseGateIssue_code_idx" ON "ReleaseGateIssue"("code");

-- AddForeignKey
ALTER TABLE "ReleaseGateRun" ADD CONSTRAINT "ReleaseGateRun_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReleaseGateIssue" ADD CONSTRAINT "ReleaseGateIssue_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReleaseGateRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
