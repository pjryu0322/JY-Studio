-- TaskDraft 워크플로우 빌더(캔버스)용 필드 추가

ALTER TABLE "task_drafts"
ADD COLUMN "dependsOnIds" JSONB,
ADD COLUMN "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0;

COMMENT ON COLUMN "task_drafts"."dependsOnIds" IS '선행 TaskDraft id 배열(JSON) — Workflow 캔버스 연결용';
COMMENT ON COLUMN "task_drafts"."positionX" IS 'Workflow 캔버스 노드 X 좌표(px)';
COMMENT ON COLUMN "task_drafts"."positionY" IS 'Workflow 캔버스 노드 Y 좌표(px)';

