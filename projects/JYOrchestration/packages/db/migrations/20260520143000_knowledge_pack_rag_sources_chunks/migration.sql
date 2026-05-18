-- 지식팩 RAG 1단계: 원천자료·청크·색인 작업

CREATE TABLE "kp_knowledge_pack_sources" (
    "id" TEXT NOT NULL,
    "knowledgePackId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "rawText" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "version" TEXT NOT NULL DEFAULT '',
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "ragEnabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL,
    "lastCollectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastCollectedText" TEXT,
    "lastContentType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kp_knowledge_pack_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kp_knowledge_pack_chunks" (
    "id" TEXT NOT NULL,
    "knowledgePackId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkText" TEXT NOT NULL,
    "chunkOrder" INTEGER NOT NULL,
    "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kp_knowledge_pack_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "kp_knowledge_pack_index_jobs" (
    "id" TEXT NOT NULL,
    "knowledgePackId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kp_knowledge_pack_index_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "kp_knowledge_pack_sources_knowledgePackId_idx" ON "kp_knowledge_pack_sources"("knowledgePackId");
CREATE INDEX "kp_knowledge_pack_sources_knowledgePackId_status_idx" ON "kp_knowledge_pack_sources"("knowledgePackId", "status");

CREATE INDEX "kp_knowledge_pack_chunks_knowledgePackId_idx" ON "kp_knowledge_pack_chunks"("knowledgePackId");
CREATE INDEX "kp_knowledge_pack_chunks_sourceId_idx" ON "kp_knowledge_pack_chunks"("sourceId");
CREATE INDEX "kp_knowledge_pack_chunks_contentHash_idx" ON "kp_knowledge_pack_chunks"("contentHash");

CREATE INDEX "kp_knowledge_pack_index_jobs_sourceId_createdAt_idx" ON "kp_knowledge_pack_index_jobs"("sourceId", "createdAt");

ALTER TABLE "kp_knowledge_pack_sources" ADD CONSTRAINT "kp_knowledge_pack_sources_knowledgePackId_fkey" FOREIGN KEY ("knowledgePackId") REFERENCES "kp_knowledge_packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kp_knowledge_pack_chunks" ADD CONSTRAINT "kp_knowledge_pack_chunks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "kp_knowledge_pack_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kp_knowledge_pack_index_jobs" ADD CONSTRAINT "kp_knowledge_pack_index_jobs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "kp_knowledge_pack_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
