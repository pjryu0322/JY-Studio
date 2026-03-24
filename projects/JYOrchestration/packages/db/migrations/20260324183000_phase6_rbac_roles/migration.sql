-- Phase 6 RBAC roles migration
-- 1) Rename existing enum values to new role model
-- 2) Backfill owner membership rows for legacy projects

ALTER TYPE "ProjectMemberRole" RENAME VALUE 'PLANNER' TO 'EDITOR';
ALTER TYPE "ProjectMemberRole" RENAME VALUE 'OPERATOR' TO 'VIEWER';

INSERT INTO "project_members" ("projectId", "userId", "role", "createdAt")
SELECT
  p."id",
  p."ownerUserId",
  'OWNER'::"ProjectMemberRole",
  now()
FROM "projects" p
LEFT JOIN "project_members" pm
  ON pm."projectId" = p."id"
 AND pm."userId" = p."ownerUserId"
WHERE pm."id" IS NULL;

COMMENT ON TABLE "project_members" IS '프로젝트 협업 멤버 역할 테이블';
COMMENT ON COLUMN "project_members"."projectId" IS '소속 프로젝트 ID';
COMMENT ON COLUMN "project_members"."userId" IS '멤버 사용자 ID';
COMMENT ON COLUMN "project_members"."role" IS '프로젝트 내 역할(OWNER/EDITOR/REVIEWER/VIEWER)';
COMMENT ON COLUMN "project_members"."createdAt" IS '생성 일시';
