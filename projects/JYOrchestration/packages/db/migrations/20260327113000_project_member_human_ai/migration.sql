-- ProjectMember HUMAN/AI 확장
-- 1) memberType 추가
-- 2) AI 멤버 식별 필드 추가
-- 3) userId nullable 전환
-- 4) invitedBy 관계 추가

-- CreateEnum
CREATE TYPE "public"."ProjectMemberType" AS ENUM ('HUMAN', 'AI');

-- AlterTable
ALTER TABLE "public"."project_members"
  ALTER COLUMN "userId" DROP NOT NULL,
  ADD COLUMN "memberType" "public"."ProjectMemberType" NOT NULL DEFAULT 'HUMAN',
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "aiProvider" TEXT,
  ADD COLUMN "aiAgentKey" TEXT,
  ADD COLUMN "invitedByUserId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Index
CREATE INDEX "project_members_projectId_memberType_idx" ON "public"."project_members"("projectId", "memberType");
CREATE INDEX "project_members_projectId_role_idx" ON "public"."project_members"("projectId", "role");

-- AddForeignKey
ALTER TABLE "public"."project_members"
  ADD CONSTRAINT "project_members_invitedByUserId_fkey"
  FOREIGN KEY ("invitedByUserId") REFERENCES "public"."users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Comment
COMMENT ON TABLE "public"."project_members" IS '프로젝트 협업 멤버 역할 테이블';
COMMENT ON COLUMN "public"."project_members"."memberType" IS '멤버 유형(HUMAN/AI)';
COMMENT ON COLUMN "public"."project_members"."displayName" IS '표시명(AI 또는 사용자 표시용)';
COMMENT ON COLUMN "public"."project_members"."aiProvider" IS 'AI 제공자 식별값(OPENAI/INTERNAL/CURSOR_REVIEWER 등)';
COMMENT ON COLUMN "public"."project_members"."aiAgentKey" IS 'AI 에이전트 키 또는 식별자';
COMMENT ON COLUMN "public"."project_members"."invitedByUserId" IS '초대한 사용자 ID';
COMMENT ON COLUMN "public"."project_members"."updatedAt" IS '수정 일시';
