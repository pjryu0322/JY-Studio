-- AI/멤버 대상 프로젝트 액션 요청 테이블

CREATE TYPE "public"."AiMemberActionType" AS ENUM (
  'REVIEW_REQUEST',
  'TASK_DRAFT_REQUEST',
  'QA_CHECK_REQUEST',
  'SUMMARY_REQUEST'
);

CREATE TYPE "public"."AiMemberActionStatus" AS ENUM (
  'REQUESTED',
  'IN_PROGRESS',
  'DONE',
  'FAILED',
  'CANCELED'
);

CREATE TYPE "public"."AiMemberActionExecutionMode" AS ENUM (
  'STUB',
  'MANUAL_AGENT',
  'FUTURE_OPENAI'
);

CREATE TABLE "public"."project_member_actions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "taskPromptId" TEXT,
    "taskRunId" TEXT,
    "gitChangeRequestId" TEXT,
    "projectMemberId" TEXT NOT NULL,
    "actionType" "public"."AiMemberActionType" NOT NULL,
    "status" "public"."AiMemberActionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestPayload" JSONB,
    "resultPayload" JSONB,
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "executionMode" "public"."AiMemberActionExecutionMode" NOT NULL DEFAULT 'STUB',
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_member_actions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_member_actions_projectId_requestedAt_idx" ON "public"."project_member_actions"("projectId", "requestedAt");
CREATE INDEX "project_member_actions_taskId_idx" ON "public"."project_member_actions"("taskId");
CREATE INDEX "project_member_actions_projectMemberId_idx" ON "public"."project_member_actions"("projectMemberId");

ALTER TABLE "public"."project_member_actions" ADD CONSTRAINT "project_member_actions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."project_member_actions" ADD CONSTRAINT "project_member_actions_projectMemberId_fkey" FOREIGN KEY ("projectMemberId") REFERENCES "public"."project_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."project_member_actions" ADD CONSTRAINT "project_member_actions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."project_member_actions" ADD CONSTRAINT "project_member_actions_taskPromptId_fkey" FOREIGN KEY ("taskPromptId") REFERENCES "public"."task_prompts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."project_member_actions" ADD CONSTRAINT "project_member_actions_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "public"."task_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."project_member_actions" ADD CONSTRAINT "project_member_actions_gitChangeRequestId_fkey" FOREIGN KEY ("gitChangeRequestId") REFERENCES "public"."git_change_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."project_member_actions" ADD CONSTRAINT "project_member_actions_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "public"."project_member_actions" IS '프로젝트 멤버(주로 AI)에 대한 협업 액션 요청';
COMMENT ON COLUMN "public"."project_member_actions"."projectId" IS '소속 프로젝트 ID';
COMMENT ON COLUMN "public"."project_member_actions"."taskId" IS '연결 태스크 ID';
COMMENT ON COLUMN "public"."project_member_actions"."taskPromptId" IS '연결 태스크 프롬프트 ID';
COMMENT ON COLUMN "public"."project_member_actions"."taskRunId" IS '연결 태스크 실행 ID';
COMMENT ON COLUMN "public"."project_member_actions"."gitChangeRequestId" IS '연결 Git 변경 요청 ID';
COMMENT ON COLUMN "public"."project_member_actions"."projectMemberId" IS '대상 프로젝트 멤버 ID';
COMMENT ON COLUMN "public"."project_member_actions"."actionType" IS '액션 유형(리뷰·초안·QA·요약 등)';
COMMENT ON COLUMN "public"."project_member_actions"."status" IS '진행 상태';
COMMENT ON COLUMN "public"."project_member_actions"."requestPayload" IS '요청 본문 JSON';
COMMENT ON COLUMN "public"."project_member_actions"."resultPayload" IS '결과 본문 JSON';
COMMENT ON COLUMN "public"."project_member_actions"."requestedByUserId" IS '요청한 로그인 사용자 ID';
COMMENT ON COLUMN "public"."project_member_actions"."requestedAt" IS '요청 시각';
COMMENT ON COLUMN "public"."project_member_actions"."startedAt" IS '처리 시작 시각';
COMMENT ON COLUMN "public"."project_member_actions"."finishedAt" IS '처리 종료 시각';
COMMENT ON COLUMN "public"."project_member_actions"."errorMessage" IS '실패 시 오류 메시지';
COMMENT ON COLUMN "public"."project_member_actions"."executionMode" IS '실행 모드(스텁·수동 에이전트·향후 OpenAI)';
