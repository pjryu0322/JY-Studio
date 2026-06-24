-- CreateTable
CREATE TABLE "project_knowledge_graph_revisions" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "sourceEventId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "graphSnapshot" JSONB NOT NULL,
    "nodeCount" INTEGER NOT NULL,
    "edgeCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_knowledge_graph_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_knowledge_graph_revisions_projectId_revisionNumber_key" ON "project_knowledge_graph_revisions"("projectId", "revisionNumber");

-- CreateIndex
CREATE INDEX "project_knowledge_graph_revisions_projectId_createdAt_idx" ON "project_knowledge_graph_revisions"("projectId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "project_knowledge_graph_revisions" ADD CONSTRAINT "project_knowledge_graph_revisions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
