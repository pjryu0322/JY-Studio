-- TaskDraft 워크플로우 작성(스테이지/생성 주체) 필드 추가

ALTER TABLE "task_drafts"
ADD COLUMN "stage" TEXT NOT NULL DEFAULT 'Build',
ADD COLUMN "createdByType" TEXT NOT NULL DEFAULT 'AI';

COMMENT ON COLUMN "task_drafts"."stage" IS 'Workflow 단계(스윔레인): Planning|Build|Test|Review|Apply';
COMMENT ON COLUMN "task_drafts"."createdByType" IS '생성 주체: AI | USER';

