-- AlterTable
ALTER TABLE "git_change_requests" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "git_change_requests" ADD COLUMN "lastError" TEXT;
ALTER TABLE "git_change_requests" ADD COLUMN "lastRetryAt" TIMESTAMP(3);
