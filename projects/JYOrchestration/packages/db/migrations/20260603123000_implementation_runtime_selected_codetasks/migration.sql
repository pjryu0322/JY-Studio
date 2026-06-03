ALTER TABLE "implementation_execution_jobs"
ADD COLUMN "selectedCodeTaskIdsJson" JSONB;

CREATE INDEX IF NOT EXISTS "implementation_code_task_runs_jobId_codeTaskId_idx"
ON "implementation_code_task_runs"("jobId", "codeTaskId");
