-- AlterTable
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "envTestRemoteBranchDeletedAt" TIMESTAMP(3);
