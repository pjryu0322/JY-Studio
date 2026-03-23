-- AlterTable: GitHub PR 추적 (선택 필드)
ALTER TABLE "git_change_requests" ADD COLUMN "pullRequestUrl" TEXT,
ADD COLUMN "pullRequestNumber" INTEGER,
ADD COLUMN "pullRequestState" TEXT,
ADD COLUMN "reviewStatus" TEXT,
ADD COLUMN "mergedAt" TIMESTAMP(3);
