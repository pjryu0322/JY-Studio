-- AlterTable: Project pipeline controls
ALTER TABLE "projects" ADD COLUMN "pipelineAutoExecute" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "projects" ADD COLUMN "pipelineAutoRetry" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: GitChangeRequest execution observability
ALTER TABLE "git_change_requests" ADD COLUMN "executionEvents" JSONB;
ALTER TABLE "git_change_requests" ADD COLUMN "executionSummary" TEXT;
