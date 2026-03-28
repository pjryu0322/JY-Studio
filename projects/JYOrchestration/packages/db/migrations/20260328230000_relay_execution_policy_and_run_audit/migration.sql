-- Relay orchestration: policy flags + run audit fields (local to JYOrchestration DB)

ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "gitRepoProvider" TEXT NOT NULL DEFAULT 'github';
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "stopOnRepeatedFailure" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "stopOnOutOfScopeChange" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "requireApprovalForSensitiveTasks" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "workflowId" TEXT;
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'cursor';
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "repoUrlSnapshot" TEXT;
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "evaluationDecision" TEXT;
ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "runError" TEXT;
