-- CreateEnum
CREATE TYPE "PayloadCleanupStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "PayloadStorageCleanupJob" (
    "id" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "payloadId" TEXT,
    "reason" TEXT NOT NULL,
    "status" "PayloadCleanupStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PayloadStorageCleanupJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayloadStorageCleanupJob_status_createdAt_idx" ON "PayloadStorageCleanupJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PayloadStorageCleanupJob_objectKey_idx" ON "PayloadStorageCleanupJob"("objectKey");
