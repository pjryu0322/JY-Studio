-- Task 초안(TaskDraft) 및 Task의 워크스페이스 Spec 출처 지원

CREATE TABLE "task_drafts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "specVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dependsOn" JSONB,
    "acceptanceCriteria" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sourceModel" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_drafts_projectId_status_idx" ON "task_drafts"("projectId", "status");
CREATE INDEX "task_drafts_projectId_specVersionId_idx" ON "task_drafts"("projectId", "specVersionId");

ALTER TABLE "task_drafts" ADD CONSTRAINT "task_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_drafts" ADD CONSTRAINT "task_drafts_specVersionId_fkey" FOREIGN KEY ("specVersionId") REFERENCES "project_spec_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "task_drafts" IS 'Project Spec 기반 AI Task 초안(사용자 검토·확정 전)';
COMMENT ON COLUMN "task_drafts"."specVersionId" IS '초안 생성에 사용한 project_spec_versions.id';
COMMENT ON COLUMN "task_drafts"."dependsOn" IS '선행 Task 제목 문자열 배열(JSON)';
COMMENT ON COLUMN "task_drafts"."acceptanceCriteria" IS '수용 기준 문자열 배열(JSON)';
COMMENT ON COLUMN "task_drafts"."status" IS 'DRAFT(검토 중) | CONFIRMED(실제 Task 반영됨) | SUPERSEDED(새 Spec으로 대체됨)';

ALTER TABLE "tasks" ALTER COLUMN "projectSpecUploadId" DROP NOT NULL;

ALTER TABLE "tasks" ADD COLUMN "sourceSpecVersionId" TEXT;

CREATE INDEX "tasks_sourceSpecVersionId_idx" ON "tasks"("sourceSpecVersionId");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sourceSpecVersionId_fkey" FOREIGN KEY ("sourceSpecVersionId") REFERENCES "project_spec_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON COLUMN "tasks"."projectSpecUploadId" IS '레거시 업로드 파이프라인용; 워크스페이스 Spec만 쓰는 Task는 NULL 가능';
COMMENT ON COLUMN "tasks"."sourceSpecVersionId" IS '워크스페이스 확정 Spec 버전 출처(project_spec_versions.id)';
