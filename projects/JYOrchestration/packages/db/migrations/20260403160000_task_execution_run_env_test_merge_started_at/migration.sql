-- AlterTable
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "envTestMergeStartedAt" TIMESTAMP(3);

