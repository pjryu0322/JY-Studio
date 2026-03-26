-- Project Spec 워크스페이스 컬럼 한글 설명 (projects)

COMMENT ON COLUMN "projects"."specCoreGoals" IS 'Project Spec 정의 워크스페이스: 핵심 목표(텍스트)';
COMMENT ON COLUMN "projects"."specScopeIn" IS 'Project Spec 정의 워크스페이스: In scope 범위(불릿/텍스트)';
COMMENT ON COLUMN "projects"."specScopeOut" IS 'Project Spec 정의 워크스페이스: Out of scope(불릿/텍스트)';
COMMENT ON COLUMN "projects"."specTargetUsers" IS 'Project Spec 정의 워크스페이스: 대상 사용자(불릿/텍스트)';
COMMENT ON COLUMN "projects"."specSuccessCriteria" IS 'Project Spec 정의 워크스페이스: 성공 기준(불릿/텍스트)';
COMMENT ON COLUMN "projects"."confirmedSpecMarkdown" IS '사용자 확정 공식 Project Spec 본문(마크다운)';
COMMENT ON COLUMN "projects"."confirmedSpecResponseId" IS '확정에 사용한 워크스페이스 AI 응답 행 ID';
COMMENT ON COLUMN "projects"."confirmedSpecAt" IS '공식 Project Spec 확정 시각';

COMMENT ON TABLE "project_spec_workspace_prompts" IS 'Spec 정의 워크스페이스: 버전별 저장 프롬프트';
COMMENT ON COLUMN "project_spec_workspace_prompts"."promptText" IS '해당 버전의 전체 프롬프트 본문';

COMMENT ON TABLE "project_spec_workspace_responses" IS 'Spec 정의 워크스페이스: 프롬프트별 AI 응답 이력';
COMMENT ON COLUMN "project_spec_workspace_responses"."responseMarkdown" IS 'AI가 생성한 Project Spec 초안(마크다운)';
