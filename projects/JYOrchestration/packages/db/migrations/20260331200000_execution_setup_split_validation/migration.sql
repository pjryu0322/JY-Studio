-- Split repository vs executor validation (Prisma default column names = camelCase on this table)
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "repoValidationError" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "executorConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "executorValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "executorValidationError" TEXT;

UPDATE "execution_setups"
SET
  "repoConnectionOk" = true,
  "executorConnectionOk" = true
WHERE "status" = 'validated'
  AND "repoConnectionOk" IS NULL
  AND "executorConnectionOk" IS NULL;
