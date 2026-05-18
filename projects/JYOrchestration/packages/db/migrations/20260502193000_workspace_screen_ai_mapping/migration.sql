-- CreateTable
CREATE TABLE "workspace_ai_member" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "catalogKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_ai_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_screen_ai_mapping" (
    "id" TEXT NOT NULL,
    "workspaceAiMemberId" TEXT NOT NULL,
    "screenKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_screen_ai_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_ai_member_projectId_catalogKey_key" ON "workspace_ai_member"("projectId", "catalogKey");

-- CreateIndex
CREATE INDEX "workspace_ai_member_projectId_idx" ON "workspace_ai_member"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_screen_ai_mapping_workspaceAiMemberId_screenKey_key" ON "workspace_screen_ai_mapping"("workspaceAiMemberId", "screenKey");

-- CreateIndex
CREATE INDEX "workspace_screen_ai_mapping_screenKey_idx" ON "workspace_screen_ai_mapping"("screenKey");

-- AddForeignKey
ALTER TABLE "workspace_ai_member" ADD CONSTRAINT "workspace_ai_member_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_screen_ai_mapping" ADD CONSTRAINT "workspace_screen_ai_mapping_workspaceAiMemberId_fkey" FOREIGN KEY ("workspaceAiMemberId") REFERENCES "workspace_ai_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
