-- AlterTable
ALTER TABLE "public"."project_spec_uploads" ALTER COLUMN "sourceType" DROP NOT NULL,
ALTER COLUMN "sourceType" DROP DEFAULT;
