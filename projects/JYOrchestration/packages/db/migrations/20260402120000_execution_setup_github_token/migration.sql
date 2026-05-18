-- GitHub access token + validation (platform-managed, same pattern as cursorApiToken)
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAccessToken" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAccessTokenMasked" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAuthConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAuthValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "githubAuthValidationError" TEXT;
