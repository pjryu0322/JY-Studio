-- Push 정책
ALTER TABLE "projects" ADD COLUMN "gitPushMode" TEXT NOT NULL DEFAULT 'AUTO_PUSH';

-- 승인 정책: 레거시 AUTO_APPLY → NO_APPROVAL, 기본값 변경
UPDATE "projects" SET "gitApprovalMode" = 'NO_APPROVAL' WHERE "gitApprovalMode" = 'AUTO_APPLY';

ALTER TABLE "projects" ALTER COLUMN "gitApprovalMode" SET DEFAULT 'NO_APPROVAL';
