-- 실행 리뷰어 등 AI 멤버별 AI 액션 승인·적용 정책 오버라이드(null = 프로젝트 기본)

ALTER TABLE "public"."project_members"
  ADD COLUMN "aiActionApprovalModeOverride" "public"."ProjectAiActionApprovalMode",
  ADD COLUMN "aiActionApplyModeOverride" "public"."ProjectAiActionApplyMode";

COMMENT ON COLUMN "public"."project_members"."aiActionApprovalModeOverride" IS 'AI 멤버별 액션 승인 모드 오버라이드; null이면 프로젝트 정책';
COMMENT ON COLUMN "public"."project_members"."aiActionApplyModeOverride" IS 'AI 멤버별 액션 적용 모드 오버라이드; null이면 프로젝트 정책';
