-- CreateTable
CREATE TABLE "KnowledgeChunkEmbedding" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimension" INTEGER NOT NULL,
    "vector" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeChunkEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeChunkEmbedding_chunkId_provider_model_key" ON "KnowledgeChunkEmbedding"("chunkId", "provider", "model");

-- CreateIndex
CREATE INDEX "KnowledgeChunkEmbedding_versionId_idx" ON "KnowledgeChunkEmbedding"("versionId");

-- CreateIndex
CREATE INDEX "KnowledgeChunkEmbedding_provider_model_idx" ON "KnowledgeChunkEmbedding"("provider", "model");

-- CreateIndex
CREATE INDEX "KnowledgeChunkEmbedding_contentHash_idx" ON "KnowledgeChunkEmbedding"("contentHash");

-- AddForeignKey
ALTER TABLE "KnowledgeChunkEmbedding" ADD CONSTRAINT "KnowledgeChunkEmbedding_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeChunkEmbedding" ADD CONSTRAINT "KnowledgeChunkEmbedding_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
