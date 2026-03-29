-- AI 멤버 오케스트레이션(역할·스테이지·모델·활성) + 실행 기록에 리뷰어 단계 JSON
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "aiOrchestrationRole" TEXT;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "orchestrationStage" TEXT;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "aiModelOverride" TEXT;
ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "orchestrationEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "task_execution_runs" ADD COLUMN IF NOT EXISTS "evaluationReviewerSteps" JSONB;
