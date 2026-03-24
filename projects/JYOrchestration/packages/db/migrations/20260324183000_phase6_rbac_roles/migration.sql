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
