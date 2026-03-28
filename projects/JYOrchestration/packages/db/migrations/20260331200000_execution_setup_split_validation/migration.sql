-- Split repository vs executor validation (Prisma default column names = camelCase on this table)
ALTER TABLE "execution_setups" ADD COLUMN "repoConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN "repoValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN "repoValidationError" TEXT;
ALTER TABLE "execution_setups" ADD COLUMN "executorConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN "executorValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN "executorValidationError" TEXT;

UPDATE "execution_setups"
SET
  "repoConnectionOk" = true,
  "executorConnectionOk" = true
WHERE "status" = 'validated'
  AND "repoConnectionOk" IS NULL
  AND "executorConnectionOk" IS NULL;
