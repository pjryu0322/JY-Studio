-- AlterTable
ALTER TABLE "public"."task_drafts"
ADD COLUMN "taskInput" TEXT;

-- AlterTable
ALTER TABLE "public"."task_drafts"
ADD COLUMN "taskOutput" TEXT;

-- AlterTable
ALTER TABLE "public"."task_drafts"
ADD COLUMN "estimatedSize" TEXT;

-- AlterTable
ALTER TABLE "public"."task_drafts"
ADD COLUMN "executionKind" TEXT;
