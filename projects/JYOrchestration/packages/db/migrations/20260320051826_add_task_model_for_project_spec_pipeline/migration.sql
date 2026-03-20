-- CreateTable
CREATE TABLE "public"."tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectSpecUploadId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_projectId_order_idx" ON "public"."tasks"("projectId", "order");

-- CreateIndex
CREATE INDEX "tasks_projectSpecUploadId_idx" ON "public"."tasks"("projectSpecUploadId");

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_projectSpecUploadId_fkey" FOREIGN KEY ("projectSpecUploadId") REFERENCES "public"."project_spec_uploads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
