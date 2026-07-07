-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_REVIEW_CREATE';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_REVIEW_UPDATE';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_PACK_APPROVE';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_PACK_REJECT';

-- CreateTable
CREATE TABLE "PackReview" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "reviewerClientId" TEXT,
    "status" TEXT NOT NULL,
    "decision" TEXT,
    "memo" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "PackReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackReview_packId_idx" ON "PackReview"("packId");

-- CreateIndex
CREATE INDEX "PackReview_status_idx" ON "PackReview"("status");

-- CreateIndex
CREATE INDEX "PackReview_decision_idx" ON "PackReview"("decision");

-- CreateIndex
CREATE INDEX "PackReview_createdAt_idx" ON "PackReview"("createdAt");

-- AddForeignKey
ALTER TABLE "PackReview" ADD CONSTRAINT "PackReview_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;
