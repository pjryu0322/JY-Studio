-- Relay orchestration: policy flags on execution_setups (task_execution_runs columns moved to 20260329180000 — table is created there)

ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "gitRepoProvider" TEXT NOT NULL DEFAULT 'github';
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "stopOnRepeatedFailure" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "stopOnOutOfScopeChange" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "requireApprovalForSensitiveTasks" BOOLEAN NOT NULL DEFAULT false;
