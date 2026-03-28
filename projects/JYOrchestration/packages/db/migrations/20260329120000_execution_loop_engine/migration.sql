-- Execution Loop Engine: Task DAG + ExecutionSetup loop policy

ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "autoAdvanceToNextTask" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "maxAutoRetriesPerTask" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "stopOnTestFailure" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "dependsOnTaskIds" JSONB;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "acceptanceCriteria" JSONB;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "executionWorkflowStatus" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "loopRetryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lastLoopRunAt" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lastEvalResult" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "lastEvalSummary" TEXT;
