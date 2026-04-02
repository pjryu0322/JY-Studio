-- AlterTable
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "mergeCommitSha" TEXT;
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "mergedAt" TIMESTAMP(3);
