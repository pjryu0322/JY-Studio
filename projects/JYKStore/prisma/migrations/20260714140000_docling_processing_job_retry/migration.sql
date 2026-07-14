-- Docling processing job retry/lock recovery + upload file resume fingerprints

ALTER TYPE "DoclingProcessingJobStatus" ADD VALUE IF NOT EXISTS 'RETRY_WAIT';

ALTER TABLE "DoclingProcessingJob"
  ADD COLUMN IF NOT EXISTS "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "nextRunAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockExpiresAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "DoclingProcessingJob_bundleId_idx";

-- Enforce one processing job per staging bundle (idempotent complete).
CREATE UNIQUE INDEX IF NOT EXISTS "DoclingProcessingJob_bundleId_key"
  ON "DoclingProcessingJob"("bundleId");

CREATE INDEX IF NOT EXISTS "DoclingProcessingJob_status_nextRunAt_idx"
  ON "DoclingProcessingJob"("status", "nextRunAt");

CREATE INDEX IF NOT EXISTS "DoclingProcessingJob_status_lockExpiresAt_idx"
  ON "DoclingProcessingJob"("status", "lockExpiresAt");

ALTER TABLE "DoclingUploadFile"
  ADD COLUMN IF NOT EXISTS "lastModifiedMs" BIGINT,
  ADD COLUMN IF NOT EXISTS "headSha256" TEXT,
  ADD COLUMN IF NOT EXISTS "tailSha256" TEXT;
