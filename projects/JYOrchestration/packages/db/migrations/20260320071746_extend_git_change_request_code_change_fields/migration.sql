-- AlterTable
ALTER TABLE "public"."git_change_requests" ADD COLUMN     "commitMessage" TEXT,
ADD COLUMN     "diffText" TEXT,
ADD COLUMN     "files" JSONB;
