-- 프로젝트 AI 멤버: 엔진(UI 선호) + 화면별 자동 실행 플래그
ALTER TABLE "workspace_ai_member" ADD COLUMN IF NOT EXISTS "enginePreference" TEXT;

ALTER TABLE "workspace_screen_ai_mapping" ADD COLUMN IF NOT EXISTS "autoRun" BOOLEAN NOT NULL DEFAULT false;
