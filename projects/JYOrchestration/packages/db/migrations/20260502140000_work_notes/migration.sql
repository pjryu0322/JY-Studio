-- CreateEnum
CREATE TYPE "WorkNoteVisibility" AS ENUM ('PRIVATE');

-- CreateTable
CREATE TABLE "work_notes" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "visibility" "WorkNoteVisibility" NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_notes_projectId_userId_stageKey_key" ON "work_notes"("projectId", "userId", "stageKey");

-- CreateIndex
CREATE INDEX "work_notes_projectId_userId_stageKey_idx" ON "work_notes"("projectId", "userId", "stageKey");

-- AddForeignKey
ALTER TABLE "work_notes" ADD CONSTRAINT "work_notes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_notes" ADD CONSTRAINT "work_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
