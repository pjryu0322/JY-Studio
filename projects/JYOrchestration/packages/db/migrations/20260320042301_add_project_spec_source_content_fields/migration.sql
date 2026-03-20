-- AlterTable
ALTER TABLE "public"."project_spec_uploads" ADD COLUMN     "contentText" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'UNKNOWN';
