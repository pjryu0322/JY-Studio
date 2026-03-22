-- Project-level Git 승인 정책 (기본 AUTO_APPLY)
ALTER TABLE "projects" ADD COLUMN "gitApprovalMode" TEXT NOT NULL DEFAULT 'AUTO_APPLY';
