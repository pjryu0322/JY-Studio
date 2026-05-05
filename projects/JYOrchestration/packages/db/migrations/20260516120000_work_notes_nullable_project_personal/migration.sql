-- Personal work notes: rows with no project (projectId NULL).
ALTER TABLE "work_notes" DROP CONSTRAINT IF EXISTS "work_notes_projectId_fkey";
ALTER TABLE "work_notes" ALTER COLUMN "projectId" DROP NOT NULL;
ALTER TABLE "work_notes" ADD CONSTRAINT "work_notes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
