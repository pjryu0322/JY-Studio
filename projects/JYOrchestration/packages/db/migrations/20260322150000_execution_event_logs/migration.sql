-- CreateTable
CREATE TABLE "execution_event_logs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "executionJobId" TEXT NOT NULL,
    "taskId" TEXT,
    "gitChangeRequestId" TEXT,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT,
    "detailJson" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execution_event_logs_projectId_idx" ON "execution_event_logs"("projectId");

-- CreateIndex
CREATE INDEX "execution_event_logs_executionJobId_idx" ON "execution_event_logs"("executionJobId");

-- CreateIndex
CREATE INDEX "execution_event_logs_stage_idx" ON "execution_event_logs"("stage");

-- AddForeignKey
ALTER TABLE "execution_event_logs" ADD CONSTRAINT "execution_event_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_event_logs" ADD CONSTRAINT "execution_event_logs_executionJobId_fkey" FOREIGN KEY ("executionJobId") REFERENCES "execution_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
