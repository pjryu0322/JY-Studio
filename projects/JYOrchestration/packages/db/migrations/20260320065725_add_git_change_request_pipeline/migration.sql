-- CreateTable
CREATE TABLE "public"."git_change_requests" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskRunId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "git_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "git_change_requests_projectId_createdAt_idx" ON "public"."git_change_requests"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "git_change_requests_taskId_idx" ON "public"."git_change_requests"("taskId");

-- CreateIndex
CREATE INDEX "git_change_requests_taskRunId_idx" ON "public"."git_change_requests"("taskRunId");

-- AddForeignKey
ALTER TABLE "public"."git_change_requests" ADD CONSTRAINT "git_change_requests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."git_change_requests" ADD CONSTRAINT "git_change_requests_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."git_change_requests" ADD CONSTRAINT "git_change_requests_taskRunId_fkey" FOREIGN KEY ("taskRunId") REFERENCES "public"."task_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
