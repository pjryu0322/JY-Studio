-- AI 멤버 액션 사람 검토·승인 후 적용 워크플로우

CREATE TYPE "public"."AiMemberActionReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_REVISION');

CREATE TYPE "public"."AiMemberActionApplyStatus" AS ENUM ('NOT_APPLIED', 'APPLIED', 'APPLY_FAILED');

CREATE TYPE "public"."AiMemberActionReviewDecision" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_REVISION');

ALTER TABLE "public"."project_member_actions"
  ADD COLUMN "reviewStatus" "public"."AiMemberActionReviewStatus",
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewComment" TEXT,
  ADD COLUMN "approvedPayload" JSONB,
  ADD COLUMN "applyStatus" "public"."AiMemberActionApplyStatus" NOT NULL DEFAULT 'NOT_APPLIED',
  ADD COLUMN "appliedAt" TIMESTAMP(3),
  ADD COLUMN "appliedByUserId" TEXT;

CREATE TABLE "public"."ai_member_action_review_logs" (
  "id" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "reviewerUserId" TEXT NOT NULL,
  "decision" "public"."AiMemberActionReviewDecision" NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_member_action_review_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_member_action_review_logs_actionId_createdAt_idx"
  ON "public"."ai_member_action_review_logs"("actionId", "createdAt");

ALTER TABLE "public"."ai_member_action_review_logs"
  ADD CONSTRAINT "ai_member_action_review_logs_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "public"."project_member_actions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ai_member_action_review_logs"
  ADD CONSTRAINT "ai_member_action_review_logs_reviewerUserId_fkey"
  FOREIGN KEY ("reviewerUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."project_member_actions"
  ADD CONSTRAINT "project_member_actions_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."project_member_actions"
  ADD CONSTRAINT "project_member_actions_appliedByUserId_fkey"
  FOREIGN KEY ("appliedByUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "project_member_actions_projectId_reviewStatus_idx"
  ON "public"."project_member_actions"("projectId", "reviewStatus");

COMMENT ON TYPE "public"."AiMemberActionReviewStatus" IS 'AI 멤버 액션 사람 검토 상태';
COMMENT ON TYPE "public"."AiMemberActionApplyStatus" IS '승인된 AI 결과의 시스템 적용 상태';
COMMENT ON TYPE "public"."AiMemberActionReviewDecision" IS '검토 결정(로그용)';

COMMENT ON TABLE "public"."ai_member_action_review_logs" IS 'AI 멤버 액션 검토·승인/반려 결정 이력';

COMMENT ON COLUMN "public"."ai_member_action_review_logs"."id" IS '로그 ID';
COMMENT ON COLUMN "public"."ai_member_action_review_logs"."actionId" IS '대상 AI 멤버 액션 ID';
COMMENT ON COLUMN "public"."ai_member_action_review_logs"."reviewerUserId" IS '검토자 사용자 ID';
COMMENT ON COLUMN "public"."ai_member_action_review_logs"."decision" IS '결정 유형';
COMMENT ON COLUMN "public"."ai_member_action_review_logs"."comment" IS '코멘트';
COMMENT ON COLUMN "public"."ai_member_action_review_logs"."createdAt" IS '생성일시';

COMMENT ON COLUMN "public"."project_member_actions"."reviewStatus" IS '사람 검토 상태(제안 vs 승인)';
COMMENT ON COLUMN "public"."project_member_actions"."reviewedByUserId" IS '검토(승인/반려) 수행 사용자';
COMMENT ON COLUMN "public"."project_member_actions"."reviewedAt" IS '검토 시각';
COMMENT ON COLUMN "public"."project_member_actions"."reviewComment" IS '검토 코멘트(반려 사유 등)';
COMMENT ON COLUMN "public"."project_member_actions"."approvedPayload" IS '승인 시점 결과 스냅샷(JSON)';
COMMENT ON COLUMN "public"."project_member_actions"."applyStatus" IS '승인 결과 시스템 반영 상태';
COMMENT ON COLUMN "public"."project_member_actions"."appliedAt" IS '적용 시각';
COMMENT ON COLUMN "public"."project_member_actions"."appliedByUserId" IS '적용 수행 사용자';

-- 기존 완료·결과가 있는 액션은 검토 대기로 간주(이전 자동 반영 데이터와 병행 가능)
UPDATE "public"."project_member_actions"
SET "reviewStatus" = 'PENDING_REVIEW'
WHERE "status" = 'DONE'
  AND "resultPayload" IS NOT NULL
  AND "reviewStatus" IS NULL;
