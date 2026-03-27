-- CreateTable
CREATE TABLE "public"."execution_setups" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "gitRepoUrl" TEXT NOT NULL,
  "gitRepoName" TEXT,
  "baseBranch" TEXT NOT NULL,
  "branchStrategy" TEXT NOT NULL,
  "branchPrefix" TEXT,
  "cursorApiUrl" TEXT NOT NULL,
  "cursorApiToken" TEXT,
  "cursorApiTokenMasked" TEXT,
  "workspacePath" TEXT NOT NULL,
  "projectRootPath" TEXT NOT NULL,
  "autoCommit" BOOLEAN NOT NULL DEFAULT true,
  "autoPush" BOOLEAN NOT NULL DEFAULT false,
  "autoPr" BOOLEAN NOT NULL DEFAULT false,
  "requireApprovalBeforeApply" BOOLEAN NOT NULL DEFAULT true,
  "requireTestsBeforePush" BOOLEAN NOT NULL DEFAULT true,
  "dryRunAllowed" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "lastValidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "execution_setups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "execution_setups_projectId_key" ON "public"."execution_setups"("projectId");

-- AddForeignKey
ALTER TABLE "public"."execution_setups"
ADD CONSTRAINT "execution_setups_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

