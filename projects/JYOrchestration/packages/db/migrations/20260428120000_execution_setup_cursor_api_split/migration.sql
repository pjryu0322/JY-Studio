-- Split Cursor API validation vs Cursor↔Git execution (Agent) validation
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "cursorApiConnectionOk" BOOLEAN;
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "cursorApiValidatedAt" TIMESTAMP(3);
ALTER TABLE "execution_setups" ADD COLUMN IF NOT EXISTS "cursorApiValidationError" TEXT;

-- Prior single "executor" flag implied both API and repo access passed together
UPDATE "execution_setups"
SET "cursorApiConnectionOk" = "executorConnectionOk"
WHERE "cursorApiConnectionOk" IS NULL
  AND "executorConnectionOk" IS NOT NULL;
