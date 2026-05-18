-- 사용자 연동: 표시명·capability별 기본값, 프로젝트 override 메타
ALTER TABLE "user_integrations" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "user_integrations" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "project_integrations" ADD COLUMN IF NOT EXISTS "metaOverride" JSONB;

-- 추가 LLM 제공자 (이미 있으면 마이그레이션 실패 — 수동으로 해당 줄 제거)
ALTER TYPE "IntegrationProvider" ADD VALUE 'GEMINI';
ALTER TYPE "IntegrationProvider" ADD VALUE 'AZURE_OPENAI';
ALTER TYPE "IntegrationProvider" ADD VALUE 'LOCAL_LLM';
