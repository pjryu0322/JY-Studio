-- CreateTable
CREATE TABLE "implementation_execution_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentCodeTaskId" TEXT,
    "failureReason" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "implementation_execution_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "implementation_code_task_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "codeTaskId" TEXT NOT NULL,
    "runtimeState" TEXT NOT NULL,
    "cursorAgentId" TEXT,
    "branchName" TEXT,
    "commitSha" TEXT,
    "pullRequestUrl" TEXT,
    "failureReason" TEXT,
    "lastHeartbeatAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "implementation_code_task_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "implementation_runtime_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT,
    "runId" TEXT,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "implementation_runtime_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "implementation_execution_jobs_projectId_status_idx" ON "implementation_execution_jobs"("projectId", "status");

-- CreateIndex
CREATE INDEX "implementation_execution_jobs_projectId_createdAt_idx" ON "implementation_execution_jobs"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "implementation_code_task_runs_projectId_codeTaskId_idx" ON "implementation_code_task_runs"("projectId", "codeTaskId");

-- CreateIndex
CREATE INDEX "implementation_code_task_runs_jobId_runtimeState_idx" ON "implementation_code_task_runs"("jobId", "runtimeState");

-- CreateIndex
CREATE INDEX "implementation_runtime_events_projectId_createdAt_idx" ON "implementation_runtime_events"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "implementation_runtime_events_jobId_createdAt_idx" ON "implementation_runtime_events"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "implementation_runtime_events_runId_createdAt_idx" ON "implementation_runtime_events"("runId", "createdAt");

-- AddForeignKey
ALTER TABLE "implementation_execution_jobs" ADD CONSTRAINT "implementation_execution_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_code_task_runs" ADD CONSTRAINT "implementation_code_task_runs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "implementation_execution_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_runtime_events" ADD CONSTRAINT "implementation_runtime_events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_runtime_events" ADD CONSTRAINT "implementation_runtime_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "implementation_execution_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
