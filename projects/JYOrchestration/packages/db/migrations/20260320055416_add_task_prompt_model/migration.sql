-- CreateTable
CREATE TABLE "public"."task_prompts" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_prompts_taskId_key" ON "public"."task_prompts"("taskId");

-- CreateIndex
CREATE INDEX "task_prompts_projectId_createdAt_idx" ON "public"."task_prompts"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."task_prompts" ADD CONSTRAINT "task_prompts_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_prompts" ADD CONSTRAINT "task_prompts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
