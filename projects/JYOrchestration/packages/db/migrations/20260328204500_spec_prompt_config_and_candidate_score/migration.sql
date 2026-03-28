-- CreateTable
CREATE TABLE "public"."spec_prompt_configs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "templatePrompt" TEXT NOT NULL,
    "preset" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spec_prompt_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spec_prompt_configs_projectId_key" ON "public"."spec_prompt_configs"("projectId");

-- AddForeignKey
ALTER TABLE "public"."spec_prompt_configs"
ADD CONSTRAINT "spec_prompt_configs_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "public"."project_spec_workspace_responses"
ADD COLUMN "specCandidateScore" JSONB;

-- AlterTable
ALTER TABLE "public"."project_spec_workspace_responses"
ADD COLUMN "specCandidateMeta" JSONB;
