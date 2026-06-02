-- ImplementationCodeTaskRun ↔ TaskCursorExecutionJob 1:1 + poll schedule on Run

ALTER TABLE "implementation_code_task_runs"
  ADD COLUMN IF NOT EXISTS "taskCursorJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "nextPollAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pollCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxPollCount" INTEGER NOT NULL DEFAULT 270,
  ADD COLUMN IF NOT EXISTS "lastPollAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pollLockedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "pollLockExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "implementation_code_task_runs_taskCursorJobId_key"
  ON "implementation_code_task_runs"("taskCursorJobId");

CREATE INDEX IF NOT EXISTS "implementation_code_task_runs_nextPollAt_runtimeState_idx"
  ON "implementation_code_task_runs"("nextPollAt", "runtimeState");

CREATE INDEX IF NOT EXISTS "implementation_code_task_runs_pollLockExpiresAt_idx"
  ON "implementation_code_task_runs"("pollLockExpiresAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'implementation_code_task_runs_taskCursorJobId_fkey'
  ) THEN
    ALTER TABLE "implementation_code_task_runs"
      ADD CONSTRAINT "implementation_code_task_runs_taskCursorJobId_fkey"
      FOREIGN KEY ("taskCursorJobId") REFERENCES "task_cursor_execution_jobs"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Backfill: link active jobs to current in-flight runs (best effort)
UPDATE "implementation_code_task_runs" AS r
SET
  "taskCursorJobId" = j."id",
  "nextPollAt" = COALESCE(r."nextPollAt", j."nextPollAt", j."createdAt"),
  "pollCount" = COALESCE(NULLIF(r."pollCount", 0), j."pollCount", 0),
  "maxPollCount" = COALESCE(NULLIF(r."maxPollCount", 0), j."maxPollCount", 270),
  "lastPollAt" = COALESCE(r."lastPollAt", j."lastPollAt")
FROM "task_cursor_execution_jobs" AS j
INNER JOIN "implementation_execution_jobs" AS ej
  ON ej."projectId" = j."projectId"
  AND ej."status" = 'running'
  AND ej."completedAt" IS NULL
WHERE r."jobId" = ej."id"
  AND r."codeTaskId" = ej."currentCodeTaskId"
  AND r."taskCursorJobId" IS NULL
  AND j."completedAt" IS NULL
  AND j."projectId" = r."projectId";
