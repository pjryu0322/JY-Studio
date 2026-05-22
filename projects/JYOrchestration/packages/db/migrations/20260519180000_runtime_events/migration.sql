-- RuntimeEvent: dedicated AI Team Runtime event storage

CREATE TABLE IF NOT EXISTS "runtime_events" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "execRunId" TEXT NOT NULL,
    "executionJobId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "workerName" TEXT,
    "failurePhase" TEXT,
    "retryReason" TEXT,
    "runtimeState" TEXT,
    "detailJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runtime_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "runtime_events_projectId_taskId_createdAt_idx"
    ON "runtime_events"("projectId", "taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "runtime_events_execRunId_createdAt_idx"
    ON "runtime_events"("execRunId", "createdAt");
CREATE INDEX IF NOT EXISTS "runtime_events_executionJobId_idx"
    ON "runtime_events"("executionJobId");
CREATE INDEX IF NOT EXISTS "runtime_events_eventType_createdAt_idx"
    ON "runtime_events"("eventType", "createdAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'runtime_events_projectId_fkey'
    ) THEN
        ALTER TABLE "runtime_events"
            ADD CONSTRAINT "runtime_events_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
