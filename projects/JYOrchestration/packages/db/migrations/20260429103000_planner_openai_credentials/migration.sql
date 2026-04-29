-- Project-level OpenAI key for prototype planner (ExecutionSetup)
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "openaiPlannerApiKey" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "openaiPlannerApiKeyMasked" TEXT;

-- User default OpenAI key (fallback after project-level)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "defaultOpenaiApiKey" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "defaultOpenaiApiKeyMasked" TEXT;
