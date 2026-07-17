-- AlterTable
ALTER TABLE "ServiceValidationResultItem" ADD COLUMN IF NOT EXISTS "sourceFileId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ServiceValidationResultItem_sourceFileId_idx" ON "ServiceValidationResultItem"("sourceFileId");
