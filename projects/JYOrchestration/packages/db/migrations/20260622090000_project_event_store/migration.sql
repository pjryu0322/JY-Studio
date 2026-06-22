CREATE TABLE IF NOT EXISTS "project_messages" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'requirements_conversation',
  "sourceMessageId" TEXT,
  "senderType" TEXT NOT NULL,
  "senderId" TEXT,
  "senderName" TEXT,
  "messageType" TEXT,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "raw" JSONB,
  "messageCreatedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_messages_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_messages_project_stage_source_sourceMessageId_key"
  ON "project_messages" ("projectId", "stage", "source", "sourceMessageId");

CREATE INDEX IF NOT EXISTS "project_messages_project_stage_messageCreatedAt_idx"
  ON "project_messages" ("projectId", "stage", "messageCreatedAt");

CREATE INDEX IF NOT EXISTS "project_messages_project_sourceMessageId_idx"
  ON "project_messages" ("projectId", "sourceMessageId");

CREATE TABLE IF NOT EXISTS "project_events" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "stage" TEXT,
  "sourceMessageId" TEXT,
  "projectMessageId" TEXT,
  "correlationId" TEXT,
  "causationId" TEXT,
  "sessionId" TEXT,
  "idempotencyKey" TEXT,
  "payload" JSONB NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "project_events_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "project_events_projectMessageId_fkey"
    FOREIGN KEY ("projectMessageId") REFERENCES "project_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_events_project_idempotency_key"
  ON "project_events" ("projectId", "idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "project_events_project_createdAt_idx"
  ON "project_events" ("projectId", "createdAt");

CREATE INDEX IF NOT EXISTS "project_events_project_eventType_createdAt_idx"
  ON "project_events" ("projectId", "eventType", "createdAt");

CREATE INDEX IF NOT EXISTS "project_events_projectMessageId_idx"
  ON "project_events" ("projectMessageId");

CREATE INDEX IF NOT EXISTS "project_events_correlationId_idx"
  ON "project_events" ("correlationId");
