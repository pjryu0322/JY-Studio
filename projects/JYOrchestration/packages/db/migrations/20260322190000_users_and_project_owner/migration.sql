-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "globalRole" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- Legacy row: pre-auth mock id + existing project_members / migrated projects
INSERT INTO "users" ("id", "email", "passwordHash", "name", "globalRole", "createdAt", "updatedAt")
VALUES (
    'demo-user-1',
    'legacy-demo-1@jy.local',
    '$2b$10$rKkUDf3W0blY91l2hUyVCO8Lg5oxOEArXAtpOOTyVUD0u5fWagbWm',
    'Legacy (pre-auth)',
    'USER',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- AlterTable (backfill then enforce NOT NULL)
ALTER TABLE "projects" ADD COLUMN "ownerUserId" TEXT;

UPDATE "projects" SET "ownerUserId" = 'demo-user-1' WHERE "ownerUserId" IS NULL;

ALTER TABLE "projects" ALTER COLUMN "ownerUserId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "projects_ownerUserId_idx" ON "projects"("ownerUserId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
