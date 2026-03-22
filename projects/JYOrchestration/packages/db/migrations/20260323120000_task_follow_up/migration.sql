-- Follow-up tasks: link to parent completed task without reopening it.
ALTER TABLE "tasks" ADD COLUMN "parentTaskId" TEXT;
ALTER TABLE "tasks" ADD COLUMN "taskKind" TEXT NOT NULL DEFAULT 'PRIMARY';
ALTER TABLE "tasks" ADD COLUMN "changeReason" TEXT;

CREATE INDEX "tasks_parentTaskId_idx" ON "tasks"("parentTaskId");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
