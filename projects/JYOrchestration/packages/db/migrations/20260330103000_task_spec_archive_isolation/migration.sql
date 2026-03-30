-- Spec 전환 시 이전 TaskSet / Run 보관용
ALTER TABLE "tasks" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "task_execution_runs" ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "tasks_projectId_archivedAt_idx" ON "tasks"("projectId", "archivedAt");
CREATE INDEX "task_execution_runs_projectId_archivedAt_idx" ON "task_execution_runs"("projectId", "archivedAt");
