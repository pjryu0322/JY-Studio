-- AlterTable
ALTER TABLE "ApiUsageLog" ADD COLUMN "method" TEXT,
ADD COLUMN "latencyMs" INTEGER,
ADD COLUMN "metadata" JSONB;

-- CreateIndex
CREATE INDEX "ApiUsageLog_statusCode_idx" ON "ApiUsageLog"("statusCode");
