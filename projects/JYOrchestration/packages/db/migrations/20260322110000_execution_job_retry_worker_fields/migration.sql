-- AlterTable
ALTER TABLE "execution_jobs"
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "lastError" TEXT,
ADD COLUMN "availableAt" TIMESTAMP(3),
ADD COLUMN "claimedBy" TEXT,
ADD COLUMN "heartbeatAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "execution_jobs_status_availableAt_createdAt_idx"
ON "execution_jobs"("status", "availableAt", "createdAt");
