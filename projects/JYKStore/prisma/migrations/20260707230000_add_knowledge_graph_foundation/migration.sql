-- CreateTable
CREATE TABLE "KnowledgeGraphNode" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT,
    "nodeType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "source" TEXT NOT NULL DEFAULT 'AUTO_DETERMINISTIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeGraphNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeGraphEdge" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT,
    "edgeType" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "source" TEXT NOT NULL DEFAULT 'AUTO_DETERMINISTIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeGraphEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_packId_idx" ON "KnowledgeGraphNode"("packId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_versionId_idx" ON "KnowledgeGraphNode"("versionId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_nodeType_idx" ON "KnowledgeGraphNode"("nodeType");

-- CreateIndex
CREATE INDEX "KnowledgeGraphNode_source_idx" ON "KnowledgeGraphNode"("source");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeGraphNode_packId_externalId_key" ON "KnowledgeGraphNode"("packId", "externalId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_packId_idx" ON "KnowledgeGraphEdge"("packId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_versionId_idx" ON "KnowledgeGraphEdge"("versionId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_edgeType_idx" ON "KnowledgeGraphEdge"("edgeType");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_fromNodeId_idx" ON "KnowledgeGraphEdge"("fromNodeId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_toNodeId_idx" ON "KnowledgeGraphEdge"("toNodeId");

-- CreateIndex
CREATE INDEX "KnowledgeGraphEdge_source_idx" ON "KnowledgeGraphEdge"("source");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeGraphEdge_packId_edgeType_fromNodeId_toNodeId_key" ON "KnowledgeGraphEdge"("packId", "edgeType", "fromNodeId", "toNodeId");

-- AddForeignKey
ALTER TABLE "KnowledgeGraphNode" ADD CONSTRAINT "KnowledgeGraphNode_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGraphNode" ADD CONSTRAINT "KnowledgeGraphNode_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGraphEdge" ADD CONSTRAINT "KnowledgeGraphEdge_packId_fkey" FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGraphEdge" ADD CONSTRAINT "KnowledgeGraphEdge_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGraphEdge" ADD CONSTRAINT "KnowledgeGraphEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "KnowledgeGraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeGraphEdge" ADD CONSTRAINT "KnowledgeGraphEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "KnowledgeGraphNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
