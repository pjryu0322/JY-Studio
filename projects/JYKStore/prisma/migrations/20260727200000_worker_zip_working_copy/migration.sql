-- P1.1 correction engine: Working Copy + PipelineRun lineage + SourceDocument scope.
-- Additive + nullable FKs. Repair of unsafe stable-key revisions is application-side.

CREATE TYPE "WorkerZipWorkingCopyPurpose" AS ENUM (
  'INITIAL_GENERATION',
  'CORRECTION_REBUILD'
);

CREATE TYPE "WorkerZipWorkingCopyStatus" AS ENUM (
  'CREATING',
  'READY',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TABLE "WorkerZipWorkingCopy" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "sourceRevisionId" TEXT NOT NULL,
  "purpose" "WorkerZipWorkingCopyPurpose" NOT NULL,
  "status" "WorkerZipWorkingCopyStatus" NOT NULL DEFAULT 'CREATING',
  "storageKey" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "directiveSnapshot" JSONB NOT NULL,
  "directiveChecksumSha256" TEXT NOT NULL,
  "createdById" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readyAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "WorkerZipWorkingCopy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkerZipWorkingCopy_storageKey_key"
  ON "WorkerZipWorkingCopy"("storageKey");

CREATE UNIQUE INDEX "WorkerZipWorkingCopy_versionId_idempotencyKey_key"
  ON "WorkerZipWorkingCopy"("versionId", "idempotencyKey");

CREATE INDEX "WorkerZipWorkingCopy_sourceRevisionId_createdAt_idx"
  ON "WorkerZipWorkingCopy"("sourceRevisionId", "createdAt");

CREATE INDEX "WorkerZipWorkingCopy_versionId_status_idx"
  ON "WorkerZipWorkingCopy"("versionId", "status");

CREATE INDEX "WorkerZipWorkingCopy_clientId_packId_versionId_idx"
  ON "WorkerZipWorkingCopy"("clientId", "packId", "versionId");

CREATE INDEX "WorkerZipWorkingCopy_packId_idx"
  ON "WorkerZipWorkingCopy"("packId");

ALTER TABLE "WorkerZipWorkingCopy"
  ADD CONSTRAINT "WorkerZipWorkingCopy_packId_fkey"
  FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerZipWorkingCopy"
  ADD CONSTRAINT "WorkerZipWorkingCopy_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerZipWorkingCopy"
  ADD CONSTRAINT "WorkerZipWorkingCopy_sourceRevisionId_fkey"
  FOREIGN KEY ("sourceRevisionId") REFERENCES "WorkerZipSourceRevision"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Same bytes in a version reuse one revision row.
CREATE UNIQUE INDEX "WorkerZipSourceRevision_versionId_checksumSha256_key"
  ON "WorkerZipSourceRevision"("versionId", "checksumSha256");

ALTER TABLE "KnowledgePackVersion"
  ADD COLUMN "currentWorkingCopyId" TEXT;

CREATE UNIQUE INDEX "KnowledgePackVersion_currentWorkingCopyId_key"
  ON "KnowledgePackVersion"("currentWorkingCopyId");

ALTER TABLE "KnowledgePackVersion"
  ADD CONSTRAINT "KnowledgePackVersion_currentWorkingCopyId_fkey"
  FOREIGN KEY ("currentWorkingCopyId") REFERENCES "WorkerZipWorkingCopy"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SourceDocument"
  ADD COLUMN "workingCopyId" TEXT;

CREATE INDEX "SourceDocument_workingCopyId_idx"
  ON "SourceDocument"("workingCopyId");

CREATE INDEX "SourceDocument_versionId_sourceRevisionId_workingCopyId_idx"
  ON "SourceDocument"("versionId", "sourceRevisionId", "workingCopyId");

ALTER TABLE "SourceDocument"
  ADD CONSTRAINT "SourceDocument_workingCopyId_fkey"
  FOREIGN KEY ("workingCopyId") REFERENCES "WorkerZipWorkingCopy"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PipelineRun"
  ADD COLUMN "versionId" TEXT,
  ADD COLUMN "sourceRevisionId" TEXT,
  ADD COLUMN "workingCopyId" TEXT;

CREATE INDEX "PipelineRun_versionId_idx" ON "PipelineRun"("versionId");
CREATE INDEX "PipelineRun_sourceRevisionId_idx" ON "PipelineRun"("sourceRevisionId");
CREATE INDEX "PipelineRun_workingCopyId_idx" ON "PipelineRun"("workingCopyId");

ALTER TABLE "PipelineRun"
  ADD CONSTRAINT "PipelineRun_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PipelineRun"
  ADD CONSTRAINT "PipelineRun_sourceRevisionId_fkey"
  FOREIGN KEY ("sourceRevisionId") REFERENCES "WorkerZipSourceRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PipelineRun"
  ADD CONSTRAINT "PipelineRun_workingCopyId_fkey"
  FOREIGN KEY ("workingCopyId") REFERENCES "WorkerZipWorkingCopy"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
