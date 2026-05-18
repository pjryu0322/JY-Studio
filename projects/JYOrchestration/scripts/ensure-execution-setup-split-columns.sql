-- Prisma ExecutionSetup uses camelCase column names (same as projectId, gitRepoUrl, …).
-- Idempotent. Same Postgres as Next.js:
--   pnpm db:fix:execution-setup-columns
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoValidationError" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "executorConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "executorValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "executorValidationError" TEXT;

-- 20260428120000_execution_setup_cursor_api_split
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "cursorApiConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "cursorApiValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "cursorApiValidationError" TEXT;

-- 20260402120000_execution_setup_github_token
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAccessToken" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAccessTokenMasked" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAuthConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAuthValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAuthValidationError" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubCapabilityValidation" JSONB;

-- If an older script added wrong snake_case columns, merge then drop them.
UPDATE "execution_setups"
SET
  "repoConnectionOk" = COALESCE("repoConnectionOk", "repo_connection_ok"),
  "repoValidatedAt" = COALESCE("repoValidatedAt", "repo_validated_at"),
  "repoValidationError" = COALESCE("repoValidationError", "repo_validation_error"),
  "executorConnectionOk" = COALESCE("executorConnectionOk", "executor_connection_ok"),
  "executorValidatedAt" = COALESCE("executorValidatedAt", "executor_validated_at"),
  "executorValidationError" = COALESCE("executorValidationError", "executor_validation_error")
WHERE EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'execution_setups'
    AND column_name = 'repo_connection_ok'
);

ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "repo_connection_ok";
ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "repo_validated_at";
ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "repo_validation_error";
ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "executor_connection_ok";
ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "executor_validated_at";
ALTER TABLE "execution_setups" DROP COLUMN IF EXISTS "executor_validation_error";

UPDATE "execution_setups"
SET
  "repoConnectionOk" = true,
  "executorConnectionOk" = true
WHERE "status" = 'validated'
  AND "repoConnectionOk" IS NULL
  AND "executorConnectionOk" IS NULL;
