-- When ENV_TEST (and other flows) reach terminal success, persist completion time for UX/audit.
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
