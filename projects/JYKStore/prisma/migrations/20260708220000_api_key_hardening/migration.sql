-- AlterEnum
ALTER TYPE "ApiKeyStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'API_KEY_VERIFY_FAILED';
ALTER TYPE "AuditAction" ADD VALUE 'API_KEY_EXPIRED';
ALTER TYPE "AuditAction" ADD VALUE 'API_KEY_SCOPE_DENIED';

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");
