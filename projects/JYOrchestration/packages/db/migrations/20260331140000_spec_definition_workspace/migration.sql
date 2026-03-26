-- Project Spec 정의 워크스페이스: 프로젝트 확장 필드 + 프롬프트/AI 응답 엔터티

ALTER TABLE "projects" ADD COLUMN "specCoreGoals" TEXT;
ALTER TABLE "projects" ADD COLUMN "specScopeIn" TEXT;
ALTER TABLE "projects" ADD COLUMN "specScopeOut" TEXT;
ALTER TABLE "projects" ADD COLUMN "specTargetUsers" TEXT;
ALTER TABLE "projects" ADD COLUMN "specSuccessCriteria" TEXT;
ALTER TABLE "projects" ADD COLUMN "confirmedSpecMarkdown" TEXT;
ALTER TABLE "projects" ADD COLUMN "confirmedSpecResponseId" TEXT;
ALTER TABLE "projects" ADD COLUMN "confirmedSpecAt" TIMESTAMP(3);

CREATE TABLE "project_spec_workspace_prompts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "promptText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByUserId" TEXT,

    CONSTRAINT "project_spec_workspace_prompts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_spec_workspace_prompts_projectId_version_key" ON "project_spec_workspace_prompts"("projectId", "version");

CREATE INDEX "project_spec_workspace_prompts_projectId_idx" ON "project_spec_workspace_prompts"("projectId");

ALTER TABLE "project_spec_workspace_prompts" ADD CONSTRAINT "project_spec_workspace_prompts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_spec_workspace_responses" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "responseMarkdown" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_spec_workspace_responses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_spec_workspace_responses_projectId_idx" ON "project_spec_workspace_responses"("projectId");

CREATE INDEX "project_spec_workspace_responses_promptId_idx" ON "project_spec_workspace_responses"("promptId");

ALTER TABLE "project_spec_workspace_responses" ADD CONSTRAINT "project_spec_workspace_responses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_spec_workspace_responses" ADD CONSTRAINT "project_spec_workspace_responses_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "project_spec_workspace_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
