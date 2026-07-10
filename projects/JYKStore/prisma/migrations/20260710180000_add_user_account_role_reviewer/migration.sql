-- AlterTable
ALTER TABLE "User" ADD COLUMN "accountRole" TEXT NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "User_accountRole_idx" ON "User"("accountRole");

-- AlterTable
ALTER TABLE "PackReview" ADD COLUMN "reviewerUserId" TEXT;

-- CreateIndex
CREATE INDEX "PackReview_reviewerUserId_idx" ON "PackReview"("reviewerUserId");
