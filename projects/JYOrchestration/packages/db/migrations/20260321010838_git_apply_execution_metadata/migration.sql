-- AlterTable
ALTER TABLE "public"."git_change_requests" ADD COLUMN     "applyFinishedAt" TIMESTAMP(3),
ADD COLUMN     "applyStartedAt" TIMESTAMP(3),
ADD COLUMN     "branchName" TEXT;
