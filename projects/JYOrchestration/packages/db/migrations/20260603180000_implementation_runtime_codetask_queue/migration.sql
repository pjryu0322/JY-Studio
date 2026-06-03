CREATE TABLE "implementation_runtime_code_task_queue_items" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "queueOrder" INTEGER NOT NULL,
    "codeTaskId" TEXT NOT NULL,
    "parentTaskId" TEXT NOT NULL,
    "workItemId" TEXT,
    "status" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "cursorRequestId" TEXT,
    "cursorRunId" TEXT,
    "targetRepository" TEXT,
    "baseBranch" TEXT,
    "workBranch" TEXT,
    "commitSha" TEXT,
    "branchHeadCommitSha" TEXT,
    "changedFilesJson" JSONB,
    "noCodeChangeEvidence" TEXT,
    "failureReason" TEXT,
    "errorMessage" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "githubVerifiedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "implementation_runtime_code_task_queue_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "implementation_runtime_code_task_queue_items_jobId_queueOrder_key" ON "implementation_runtime_code_task_queue_items"("jobId", "queueOrder");
CREATE UNIQUE INDEX "implementation_runtime_code_task_queue_items_jobId_codeTaskId_key" ON "implementation_runtime_code_task_queue_items"("jobId", "codeTaskId");
CREATE INDEX "implementation_runtime_code_task_queue_items_projectId_idx" ON "implementation_runtime_code_task_queue_items"("projectId");
CREATE INDEX "implementation_runtime_code_task_queue_items_jobId_idx" ON "implementation_runtime_code_task_queue_items"("jobId");
CREATE INDEX "implementation_runtime_code_task_queue_items_jobId_status_idx" ON "implementation_runtime_code_task_queue_items"("jobId", "status");

ALTER TABLE "implementation_runtime_code_task_queue_items" ADD CONSTRAINT "implementation_runtime_code_task_queue_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "implementation_execution_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
