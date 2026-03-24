-- 프로젝트·액션 유형별 AI 승인/적용 정책 및 액션 행 스냅샷

CREATE TYPE "public"."ProjectAiActionApprovalMode" AS ENUM ('AUTO_APPROVE', 'MANUAL_REVIEW');

CREATE TYPE "public"."ProjectAiActionApplyMode" AS ENUM ('AUTO_APPLY', 'MANUAL_APPLY');

CREATE TABLE "public"."project_ai_action_policies" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "actionType" "public"."AiMemberActionType" NOT NULL,
  "approvalMode" "public"."ProjectAiActionApprovalMode" NOT NULL,
  "applyMode" "public"."ProjectAiActionApplyMode" NOT NULL DEFAULT 'MANUAL_APPLY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_ai_action_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_ai_action_policies_projectId_actionType_key"
  ON "public"."project_ai_action_policies"("projectId", "actionType");

CREATE INDEX "project_ai_action_policies_projectId_idx"
  ON "public"."project_ai_action_policies"("projectId");

ALTER TABLE "public"."project_ai_action_policies"
  ADD CONSTRAINT "project_ai_action_policies_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."project_member_actions"
  ADD COLUMN "resolvedApprovalMode" "public"."ProjectAiActionApprovalMode",
  ADD COLUMN "resolvedApplyMode" "public"."ProjectAiActionApplyMode";

COMMENT ON TYPE "public"."ProjectAiActionApprovalMode" IS 'AI 액션 승인 정책(자동 vs 수동 검토)';
COMMENT ON TYPE "public"."ProjectAiActionApplyMode" IS 'AI 승인 결과 적용 정책(자동 vs 수동 적용)';

COMMENT ON TABLE "public"."project_ai_action_policies" IS '프로젝트·액션 유형별 AI 승인·적용 정책';

COMMENT ON COLUMN "public"."project_ai_action_policies"."id" IS '정책 행 ID';
COMMENT ON COLUMN "public"."project_ai_action_policies"."projectId" IS '프로젝트 ID';
COMMENT ON COLUMN "public"."project_ai_action_policies"."actionType" IS 'AI 멤버 액션 유형';
COMMENT ON COLUMN "public"."project_ai_action_policies"."approvalMode" IS '승인 모드';
COMMENT ON COLUMN "public"."project_ai_action_policies"."applyMode" IS '적용 모드';
COMMENT ON COLUMN "public"."project_ai_action_policies"."createdAt" IS '생성일시';
COMMENT ON COLUMN "public"."project_ai_action_policies"."updatedAt" IS '수정일시';

COMMENT ON COLUMN "public"."project_member_actions"."resolvedApprovalMode" IS '요청 시점 확정 승인 정책 스냅샷';
COMMENT ON COLUMN "public"."project_member_actions"."resolvedApplyMode" IS '요청 시점 확정 적용 정책 스냅샷';
