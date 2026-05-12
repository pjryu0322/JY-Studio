-- 지식팩 DB 관리 (정적 seed와 별도)

CREATE TABLE "kp_knowledge_packs" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "vendor" TEXT NOT NULL DEFAULT '',
    "licenseType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "ownerUserId" TEXT NOT NULL,
    "organizationId" TEXT,
    "projectId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "agentsJson" TEXT NOT NULL DEFAULT '["AI_DEVELOPER"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kp_knowledge_packs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kp_knowledge_pack_versions" (
    "id" TEXT NOT NULL,
    "knowledgePackId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changeSummary" TEXT NOT NULL DEFAULT '',
    "sourceType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kp_knowledge_pack_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kp_knowledge_pack_sections" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kp_knowledge_pack_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kp_knowledge_pack_histories" (
    "id" TEXT NOT NULL,
    "knowledgePackId" TEXT NOT NULL,
    "versionId" TEXT,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kp_knowledge_pack_histories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kp_agent_category_mappings" (
    "id" TEXT NOT NULL,
    "agentRole" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "usageMode" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kp_agent_category_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "kp_agent_category_mappings_agentRole_category_key" ON "kp_agent_category_mappings"("agentRole", "category");

CREATE INDEX "kp_knowledge_packs_ownerUserId_idx" ON "kp_knowledge_packs"("ownerUserId");
CREATE INDEX "kp_knowledge_packs_scope_category_idx" ON "kp_knowledge_packs"("scope", "category");

CREATE INDEX "kp_knowledge_pack_versions_knowledgePackId_createdAt_idx" ON "kp_knowledge_pack_versions"("knowledgePackId", "createdAt");
CREATE INDEX "kp_knowledge_pack_sections_versionId_sectionKey_idx" ON "kp_knowledge_pack_sections"("versionId", "sectionKey");
CREATE INDEX "kp_knowledge_pack_histories_knowledgePackId_createdAt_idx" ON "kp_knowledge_pack_histories"("knowledgePackId", "createdAt");

ALTER TABLE "kp_knowledge_pack_versions" ADD CONSTRAINT "kp_knowledge_pack_versions_knowledgePackId_fkey" FOREIGN KEY ("knowledgePackId") REFERENCES "kp_knowledge_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kp_knowledge_pack_sections" ADD CONSTRAINT "kp_knowledge_pack_sections_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "kp_knowledge_pack_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kp_knowledge_pack_histories" ADD CONSTRAINT "kp_knowledge_pack_histories_knowledgePackId_fkey" FOREIGN KEY ("knowledgePackId") REFERENCES "kp_knowledge_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kp_knowledge_pack_histories" ADD CONSTRAINT "kp_knowledge_pack_histories_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "kp_knowledge_pack_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
