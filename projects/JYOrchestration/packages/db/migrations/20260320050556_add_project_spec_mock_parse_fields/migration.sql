-- AlterTable
ALTER TABLE "public"."project_spec_uploads" ADD COLUMN     "parseStatus" TEXT DEFAULT 'PENDING',
ADD COLUMN     "parsedAt" TIMESTAMP(3),
ADD COLUMN     "parsedJson" JSONB;
