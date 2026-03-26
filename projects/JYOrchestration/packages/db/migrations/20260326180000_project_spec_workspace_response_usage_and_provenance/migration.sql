-- Project Spec Workspace 응답 usage(토큰) + 확정 provenance 저장

ALTER TABLE "project_spec_workspace_responses"
  ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER;

ALTER TABLE "project_spec_workspace_responses"
  ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER;

ALTER TABLE "project_spec_workspace_responses"
  ADD COLUMN IF NOT EXISTS "totalTokens" INTEGER;

COMMENT ON COLUMN "project_spec_workspace_responses"."promptTokens" IS 'OpenAI 사용량: 입력 토큰 수';
COMMENT ON COLUMN "project_spec_workspace_responses"."completionTokens" IS 'OpenAI 사용량: 출력 토큰 수';
COMMENT ON COLUMN "project_spec_workspace_responses"."totalTokens" IS 'OpenAI 사용량: 총 토큰 수';

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "confirmedSpecSourceType" TEXT;

ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "confirmedSpecSourceData" JSONB;

COMMENT ON COLUMN "projects"."confirmedSpecSourceType" IS '확정 출처 타입(RESPONSE 또는 MERGED_SECTIONS 등)';
COMMENT ON COLUMN "projects"."confirmedSpecSourceData" IS '확정 출처 상세(응답 ID, 섹션 선택 매핑 등)';

