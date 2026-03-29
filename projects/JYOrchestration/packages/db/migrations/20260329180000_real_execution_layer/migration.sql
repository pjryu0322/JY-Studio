-- Real execution layer: validation commands, path globs, TaskExecutionRun, Task denorm fields

ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoValidationCommands" JSONB;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "allowedPathGlobs" JSONB;

CREATE TABLE "task_execution_runs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "branchName" TEXT,
    "cursorRunId" TEXT,
    "promptSnapshot" TEXT,
    "cursorSummary" TEXT,
    "changedFiles" JSONB,
    "gitSummary" TEXT,
    "evaluationReason" TEXT,
    "validationOutput" TEXT,
    "commitStatus" TEXT,
    "pushStatus" TEXT,
    "commitSha" TEXT,
    "prStatus" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_execution_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_execution_runs_projectId_taskId_createdAt_idx" ON "task_execution_runs"("projectId", "taskId", "createdAt");

ALTER TABLE "task_execution_runs" ADD CONSTRAINT "task_execution_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_execution_runs" ADD CONSTRAINT "task_execution_runs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- From relay_execution_policy_and_run_audit (must run after table exists; see 20260328230000)
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "workflowId" TEXT;
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'cursor';
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "repoUrlSnapshot" TEXT;
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "evaluationDecision" TEXT;
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "runError" TEXT;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lastOrchestrationBranch" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lastOrchestrationCommitStatus" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lastOrchestrationPushStatus" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lastOrchestrationCommitSha" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lastOrchestrationChangedFileCount" INTEGER;
