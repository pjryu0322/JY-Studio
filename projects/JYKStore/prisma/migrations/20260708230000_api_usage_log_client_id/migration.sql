-- AlterTable
ALTER TABLE "ApiUsageLog" ADD COLUMN "clientId" TEXT;

-- CreateIndex
CREATE INDEX "ApiUsageLog_clientId_idx" ON "ApiUsageLog"("clientId");

-- CreateIndex
CREATE INDEX "ApiUsageLog_clientId_createdAt_idx" ON "ApiUsageLog"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "ApiUsageLog_statusCode_createdAt_idx" ON "ApiUsageLog"("statusCode", "createdAt");
