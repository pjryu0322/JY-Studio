-- 확정 Project Spec 버전 테이블 및 프로젝트의 현재 버전 포인터

CREATE TABLE "project_spec_versions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "markdown" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "project_spec_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_spec_versions_projectId_version_key" ON "project_spec_versions"("projectId", "version");

CREATE INDEX "project_spec_versions_projectId_idx" ON "project_spec_versions"("projectId");

ALTER TABLE "project_spec_versions" ADD CONSTRAINT "project_spec_versions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMENT ON TABLE "project_spec_versions" IS '확정 Project Spec 버전 이력(append-only, 행 수정 금지 원칙)';
COMMENT ON COLUMN "project_spec_versions"."version" IS '프로젝트별 순번(1부터)';
COMMENT ON COLUMN "project_spec_versions"."sourceType" IS 'RESPONSE, MERGED_SECTIONS, MANUAL_EDIT, AI_REFINE, LEGACY_IMPORT 등';

ALTER TABLE "projects" ADD COLUMN "currentSpecVersionId" TEXT;

CREATE UNIQUE INDEX "projects_currentSpecVersionId_key" ON "projects"("currentSpecVersionId");

-- 기존 확정 마크다운이 있으면 v1 행으로 승격
INSERT INTO "project_spec_versions" ("id", "projectId", "version", "markdown", "sourceType", "sourceData", "createdAt")
SELECT
    'psv_' || md5(p."id" || 'legacy_spec_v1'),
    p."id",
    1,
    p."confirmedSpecMarkdown",
    COALESCE(NULLIF(trim(p."confirmedSpecSourceType"), ''), 'LEGACY_IMPORT'),
    p."confirmedSpecSourceData",
    COALESCE(p."confirmedSpecAt", p."updatedAt")
FROM "projects" p
WHERE p."confirmedSpecMarkdown" IS NOT NULL AND trim(p."confirmedSpecMarkdown") <> '';

UPDATE "projects" p
SET "currentSpecVersionId" = v."id"
FROM "project_spec_versions" v
WHERE v."projectId" = p."id"
  AND v."version" = 1
  AND p."confirmedSpecMarkdown" IS NOT NULL
  AND trim(p."confirmedSpecMarkdown") <> '';

ALTER TABLE "projects" ADD CONSTRAINT "projects_currentSpecVersionId_fkey" FOREIGN KEY ("currentSpecVersionId") REFERENCES "project_spec_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMENT ON COLUMN "projects"."currentSpecVersionId" IS '현재 활성 확정 Spec 버전(project_spec_versions.id)';
