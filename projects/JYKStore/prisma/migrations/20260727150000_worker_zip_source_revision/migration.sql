-- P1 correction engine: immutable Worker ZIP source revisions.
-- Additive + nullable FKs. Legacy stable worker-request/source.zip keys remain readable.

CREATE TYPE "WorkerZipSourceRevisionStatus" AS ENUM (
  'UPLOADED',
  'PROCESSING',
  'READY',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TABLE "WorkerZipSourceRevision" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "packId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "revisionNo" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "originalFileName" TEXT,
  "submittedById" TEXT,
  "reason" TEXT,
  "status" "WorkerZipSourceRevisionStatus" NOT NULL DEFAULT 'UPLOADED',
  "supersedesRevisionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readyAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),

  CONSTRAINT "WorkerZipSourceRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkerZipSourceRevision_storageKey_key"
  ON "WorkerZipSourceRevision"("storageKey");

CREATE UNIQUE INDEX "WorkerZipSourceRevision_versionId_revisionNo_key"
  ON "WorkerZipSourceRevision"("versionId", "revisionNo");

CREATE INDEX "WorkerZipSourceRevision_packId_idx"
  ON "WorkerZipSourceRevision"("packId");

CREATE INDEX "WorkerZipSourceRevision_versionId_idx"
  ON "WorkerZipSourceRevision"("versionId");

CREATE INDEX "WorkerZipSourceRevision_clientId_idx"
  ON "WorkerZipSourceRevision"("clientId");

CREATE INDEX "WorkerZipSourceRevision_status_idx"
  ON "WorkerZipSourceRevision"("status");

CREATE INDEX "WorkerZipSourceRevision_checksumSha256_idx"
  ON "WorkerZipSourceRevision"("checksumSha256");

CREATE INDEX "WorkerZipSourceRevision_supersedesRevisionId_idx"
  ON "WorkerZipSourceRevision"("supersedesRevisionId");

ALTER TABLE "WorkerZipSourceRevision"
  ADD CONSTRAINT "WorkerZipSourceRevision_packId_fkey"
  FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerZipSourceRevision"
  ADD CONSTRAINT "WorkerZipSourceRevision_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkerZipSourceRevision"
  ADD CONSTRAINT "WorkerZipSourceRevision_supersedesRevisionId_fkey"
  FOREIGN KEY ("supersedesRevisionId") REFERENCES "WorkerZipSourceRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgePackVersion"
  ADD COLUMN "currentSourceRevisionId" TEXT;

CREATE UNIQUE INDEX "KnowledgePackVersion_currentSourceRevisionId_key"
  ON "KnowledgePackVersion"("currentSourceRevisionId");

ALTER TABLE "KnowledgePackVersion"
  ADD CONSTRAINT "KnowledgePackVersion_currentSourceRevisionId_fkey"
  FOREIGN KEY ("currentSourceRevisionId") REFERENCES "WorkerZipSourceRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SourceDocument"
  ADD COLUMN "sourceRevisionId" TEXT;

CREATE INDEX "SourceDocument_sourceRevisionId_idx"
  ON "SourceDocument"("sourceRevisionId");

ALTER TABLE "SourceDocument"
  ADD CONSTRAINT "SourceDocument_sourceRevisionId_fkey"
  FOREIGN KEY ("sourceRevisionId") REFERENCES "WorkerZipSourceRevision"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
