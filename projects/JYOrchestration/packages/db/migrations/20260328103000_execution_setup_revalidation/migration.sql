-- AlterTable
ALTER TABLE "public"."execution_setups"
ADD COLUMN "needsRevalidation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."execution_setups"
ADD COLUMN "lastValidationError" TEXT;
