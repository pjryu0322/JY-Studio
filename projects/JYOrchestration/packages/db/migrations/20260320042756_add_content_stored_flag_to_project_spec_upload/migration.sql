-- AlterTable
ALTER TABLE "public"."project_spec_uploads" ADD COLUMN     "contentStored" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "sourceType" SET DEFAULT 'document';
