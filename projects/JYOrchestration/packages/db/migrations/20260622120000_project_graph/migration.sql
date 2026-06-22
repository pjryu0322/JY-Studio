CREATE TABLE IF NOT EXISTS "project_graph_nodes" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "projectionKey" TEXT NOT NULL,
  "entityKey" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "metadata" JSONB,
  "sourceEventId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_graph_nodes_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_graph_nodes_project_projectionKey_key"
  ON "project_graph_nodes" ("projectId", "projectionKey");

CREATE UNIQUE INDEX IF NOT EXISTS "project_graph_nodes_project_entityKey_key"
  ON "project_graph_nodes" ("projectId", "entityKey");

CREATE INDEX IF NOT EXISTS "project_graph_nodes_project_nodeType_idx"
  ON "project_graph_nodes" ("projectId", "nodeType");

CREATE INDEX IF NOT EXISTS "project_graph_nodes_project_createdAt_idx"
  ON "project_graph_nodes" ("projectId", "createdAt");

CREATE INDEX IF NOT EXISTS "project_graph_nodes_sourceEventId_idx"
  ON "project_graph_nodes" ("sourceEventId");

CREATE TABLE IF NOT EXISTS "project_graph_edges" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "projectionKey" TEXT NOT NULL,
  "fromNodeId" TEXT NOT NULL,
  "toNodeId" TEXT NOT NULL,
  "edgeType" TEXT NOT NULL,
  "metadata" JSONB,
  "sourceEventId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_graph_edges_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_graph_edges_fromNodeId_fkey"
    FOREIGN KEY ("fromNodeId") REFERENCES "project_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_graph_edges_toNodeId_fkey"
    FOREIGN KEY ("toNodeId") REFERENCES "project_graph_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_graph_edges_project_projectionKey_key"
  ON "project_graph_edges" ("projectId", "projectionKey");

CREATE INDEX IF NOT EXISTS "project_graph_edges_project_edgeType_idx"
  ON "project_graph_edges" ("projectId", "edgeType");

CREATE INDEX IF NOT EXISTS "project_graph_edges_project_fromNodeId_idx"
  ON "project_graph_edges" ("projectId", "fromNodeId");

CREATE INDEX IF NOT EXISTS "project_graph_edges_project_toNodeId_idx"
  ON "project_graph_edges" ("projectId", "toNodeId");

CREATE INDEX IF NOT EXISTS "project_graph_edges_sourceEventId_idx"
  ON "project_graph_edges" ("sourceEventId");
