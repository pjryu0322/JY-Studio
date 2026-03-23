-- CreateTable
CREATE TABLE "execution_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "execution_jobs_projectId_status_createdAt_idx" ON "execution_jobs"("projectId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "execution_jobs_status_createdAt_idx" ON "execution_jobs"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "execution_jobs" ADD CONSTRAINT "execution_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
