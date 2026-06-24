-- Project Knowledge Pipeline runtime (monitor persistence)

CREATE TABLE IF NOT EXISTS "project_knowledge_pipeline_runs" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ,
  "durationMs" INTEGER,
  "eventCount" INTEGER,
  "candidateCount" INTEGER,
  "nodeCount" INTEGER,
  "edgeCount" INTEGER,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_knowledge_pipeline_runs_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_knowledge_pipeline_runs_project_startedAt_idx"
  ON "project_knowledge_pipeline_runs" ("projectId", "startedAt" DESC);

CREATE TABLE IF NOT EXISTS "project_knowledge_pipeline_steps" (
  "id" TEXT PRIMARY KEY,
  "runId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "sourceEventId" TEXT,
  "sourceMessageId" TEXT,
  "metadata" JSONB,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt" TIMESTAMPTZ,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_knowledge_pipeline_steps_runId_fkey"
    FOREIGN KEY ("runId") REFERENCES "project_knowledge_pipeline_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "project_knowledge_pipeline_steps_runId_startedAt_idx"
  ON "project_knowledge_pipeline_steps" ("runId", "startedAt" ASC);
