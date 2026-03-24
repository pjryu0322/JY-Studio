-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "ownerUserId" TEXT;

UPDATE "tasks" AS t
SET "ownerUserId" = p."ownerUserId"
FROM "projects" AS p
WHERE t."projectId" = p."id";

ALTER TABLE "tasks" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "tasks_ownerUserId_idx" ON "tasks"("ownerUserId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMENT ON COLUMN "tasks"."ownerUserId" IS '태스크 소유 사용자 ID(프로젝트 소유자와 동일)';
