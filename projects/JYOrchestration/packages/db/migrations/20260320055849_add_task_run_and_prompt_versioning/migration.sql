/*
  Warnings:

  - Added the required column `version` to the `task_prompts` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."task_prompts_taskId_key";

-- AlterTable
ALTER TABLE "public"."task_prompts" ADD COLUMN     "version" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "public"."task_runs" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskPromptId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resultText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_runs_taskId_createdAt_idx" ON "public"."task_runs"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "task_runs_taskPromptId_idx" ON "public"."task_runs"("taskPromptId");

-- AddForeignKey
ALTER TABLE "public"."task_runs" ADD CONSTRAINT "task_runs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "public"."tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."task_runs" ADD CONSTRAINT "task_runs_taskPromptId_fkey" FOREIGN KEY ("taskPromptId") REFERENCES "public"."task_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
