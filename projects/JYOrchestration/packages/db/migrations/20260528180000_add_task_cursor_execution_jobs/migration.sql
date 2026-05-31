-- CreateTable
CREATE TABLE "task_cursor_execution_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "cursorRunId" TEXT,
    "status" TEXT NOT NULL,
    "failureReason" TEXT,
    "errorMessage" TEXT,
    "targetRepository" TEXT NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "workBranch" TEXT NOT NULL,
    "workItemIdsJson" JSONB NOT NULL,
    "executionJson" JSONB NOT NULL,
    "historyJson" JSONB,
    "lastPollAt" TIMESTAMP(3),
    "nextPollAt" TIMESTAMP(3),
    "pollCount" INTEGER NOT NULL DEFAULT 0,
    "maxPollCount" INTEGER NOT NULL DEFAULT 270,
    "lockedBy" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "task_cursor_execution_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_cursor_execution_jobs_projectId_idx" ON "task_cursor_execution_jobs"("projectId");

-- CreateIndex
CREATE INDEX "task_cursor_execution_jobs_status_nextPollAt_idx" ON "task_cursor_execution_jobs"("status", "nextPollAt");

-- CreateIndex
CREATE INDEX "task_cursor_execution_jobs_cursorRunId_idx" ON "task_cursor_execution_jobs"("cursorRunId");

-- CreateIndex
CREATE INDEX "task_cursor_execution_jobs_taskId_idx" ON "task_cursor_execution_jobs"("taskId");

-- CreateIndex
CREATE INDEX "task_cursor_execution_jobs_projectId_taskId_status_idx" ON "task_cursor_execution_jobs"("projectId", "taskId", "status");

-- AddForeignKey
ALTER TABLE "task_cursor_execution_jobs" ADD CONSTRAINT "task_cursor_execution_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
