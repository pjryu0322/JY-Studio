-- TaskExecutionRun.completedAt (Prisma 스키마와 DB 동기화)
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "mergeCommitSha" TEXT;
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "mergedAt" TIMESTAMP(3);
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "envTestRemoteBranchDeletedAt" TIMESTAMP(3);
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "envTestMergeBlockedReason" TEXT;
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "envTestMergeStartedAt" TIMESTAMP(3);
