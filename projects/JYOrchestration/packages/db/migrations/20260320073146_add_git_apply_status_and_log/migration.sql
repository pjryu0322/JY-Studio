-- AlterTable
ALTER TABLE "public"."git_change_requests" ADD COLUMN     "applyLog" TEXT,
ADD COLUMN     "applyStatus" TEXT DEFAULT 'PENDING';
