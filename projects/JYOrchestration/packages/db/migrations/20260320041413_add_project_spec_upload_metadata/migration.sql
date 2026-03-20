-- CreateTable
CREATE TABLE "public"."project_spec_uploads" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REGISTERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_spec_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_spec_uploads_projectId_createdAt_idx" ON "public"."project_spec_uploads"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."project_spec_uploads" ADD CONSTRAINT "project_spec_uploads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
