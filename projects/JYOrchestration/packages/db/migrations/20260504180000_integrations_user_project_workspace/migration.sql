-- CreateEnum
CREATE TYPE "IntegrationCapability" AS ENUM ('LLM', 'CODE_AGENT', 'SCM', 'DEPLOY');
CREATE TYPE "IntegrationProvider" AS ENUM ('OPENAI', 'CURSOR', 'GITHUB', 'VERCEL');
CREATE TYPE "UserIntegrationStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ERROR');

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'aes-256-gcm',
    "maskedPreview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "capability" "IntegrationCapability" NOT NULL,
    "credentialRef" TEXT NOT NULL,
    "meta" JSONB,
    "status" "UserIntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_integrations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "capability" "IntegrationCapability" NOT NULL,
    "userIntegrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workspace_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_integrations" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "capability" "IntegrationCapability" NOT NULL,
    "userIntegrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_member_providers" (
    "id" TEXT NOT NULL,
    "workspaceAiMemberId" TEXT NOT NULL,
    "capability" "IntegrationCapability" NOT NULL,
    "userIntegrationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_member_providers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_integrations" ADD CONSTRAINT "user_integrations_credentialRef_fkey" FOREIGN KEY ("credentialRef") REFERENCES "integration_credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_integrations" ADD CONSTRAINT "workspace_integrations_userIntegrationId_fkey" FOREIGN KEY ("userIntegrationId") REFERENCES "user_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_userIntegrationId_fkey" FOREIGN KEY ("userIntegrationId") REFERENCES "user_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_member_providers" ADD CONSTRAINT "ai_member_providers_workspaceAiMemberId_fkey" FOREIGN KEY ("workspaceAiMemberId") REFERENCES "workspace_ai_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_member_providers" ADD CONSTRAINT "ai_member_providers_userIntegrationId_fkey" FOREIGN KEY ("userIntegrationId") REFERENCES "user_integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "user_integrations_userId_provider_capability_key" ON "user_integrations"("userId", "provider", "capability");
CREATE INDEX "user_integrations_userId_idx" ON "user_integrations"("userId");

CREATE UNIQUE INDEX "workspace_integrations_projectId_capability_key" ON "workspace_integrations"("projectId", "capability");
CREATE INDEX "workspace_integrations_projectId_idx" ON "workspace_integrations"("projectId");

CREATE UNIQUE INDEX "project_integrations_projectId_capability_key" ON "project_integrations"("projectId", "capability");
CREATE INDEX "project_integrations_projectId_idx" ON "project_integrations"("projectId");

CREATE UNIQUE INDEX "ai_member_providers_workspaceAiMemberId_capability_key" ON "ai_member_providers"("workspaceAiMemberId", "capability");
CREATE INDEX "ai_member_providers_workspaceAiMemberId_idx" ON "ai_member_providers"("workspaceAiMemberId");

-- Seed: 각 workspace AI 멤버에 LLM capability 행(핀 없음)
INSERT INTO "ai_member_providers" ("id", "workspaceAiMemberId", "capability", "userIntegrationId", "createdAt", "updatedAt")
SELECT md5(random()::text || clock_timestamp()::text || wam."id"), wam."id", 'LLM'::"IntegrationCapability", NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "workspace_ai_member" wam
ON CONFLICT ("workspaceAiMemberId", "capability") DO NOTHING;
