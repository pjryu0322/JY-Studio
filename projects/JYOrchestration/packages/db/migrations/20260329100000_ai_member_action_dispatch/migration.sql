-- AI 멤버 액션 디스패치·재시도·클레임 필드 확장
-- ExecutionMode: FUTURE_OPENAI -> OPENAI, INTERNAL_AGENT 추가

ALTER TYPE "public"."AiMemberActionExecutionMode" RENAME VALUE 'FUTURE_OPENAI' TO 'OPENAI';

ALTER TYPE "public"."AiMemberActionExecutionMode" ADD VALUE 'INTERNAL_AGENT';

ALTER TABLE "public"."project_member_actions"
  ADD COLUMN "lastError" TEXT,
  ADD COLUMN "providerKey" TEXT,
  ADD COLUMN "assignedExecutor" TEXT,
  ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "availableAt" TIMESTAMP(3),
  ADD COLUMN "consumedBy" TEXT,
  ADD COLUMN "correlationKey" TEXT;

CREATE INDEX "project_member_actions_status_availableAt_requestedAt_idx"
  ON "public"."project_member_actions"("status", "availableAt", "requestedAt");

COMMENT ON COLUMN "public"."project_member_actions"."lastError" IS '마지막 실행 오류 메시지';
COMMENT ON COLUMN "public"."project_member_actions"."providerKey" IS '실행 프로바이더 키(OPENAI_REVIEWER 등)';
COMMENT ON COLUMN "public"."project_member_actions"."assignedExecutor" IS '실제 수행한 실행기 식별명';
COMMENT ON COLUMN "public"."project_member_actions"."retryCount" IS '재시도 누적 횟수';
COMMENT ON COLUMN "public"."project_member_actions"."availableAt" IS '다시 디스패치 가능 시각';
COMMENT ON COLUMN "public"."project_member_actions"."consumedBy" IS '디스패처/워커 클레임 식별자';
COMMENT ON COLUMN "public"."project_member_actions"."correlationKey" IS '상관·추적용 키';
