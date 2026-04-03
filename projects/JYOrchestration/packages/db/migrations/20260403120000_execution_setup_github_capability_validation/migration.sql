-- Fine-grained GitHub PAT capability probe snapshot (repo / PR read / create / merge)
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubCapabilityValidation" JSONB;
