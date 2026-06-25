-- AlterTable
ALTER TABLE "project_knowledge_graph_revisions" ADD COLUMN "snapshotPurpose" TEXT NOT NULL DEFAULT 'REPLAY';

-- CreateIndex
CREATE INDEX "project_knowledge_graph_revisions_projectId_snapshotPurpose_idx" ON "project_knowledge_graph_revisions"("projectId", "snapshotPurpose", "revisionNumber" DESC);
