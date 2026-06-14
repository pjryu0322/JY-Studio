ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "implementationLlmProviderConfigJson" JSONB;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "implementationLlmProviderConfigJson" JSONB;
