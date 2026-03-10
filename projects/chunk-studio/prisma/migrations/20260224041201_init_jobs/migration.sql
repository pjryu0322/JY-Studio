-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('UPLOADED', 'ACTION_REQUIRED', 'QUEUED', 'CONVERTING', 'PDF_READY', 'EXTRACTING_TEXT', 'CHUNKING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "FileSourceType" AS ENUM ('original', 'replacement_pdf');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('PDF', 'EXTRACTED_TEXT', 'CHUNKS_JSON');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'UPLOADED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "errorCode" TEXT,
    "errorDetail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobFile" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sourceType" "FileSourceType" NOT NULL DEFAULT 'original',
    "originalName" TEXT NOT NULL,
    "ext" TEXT NOT NULL,
    "mime" TEXT,
    "sizeBytes" INTEGER,
    "storagePath" TEXT NOT NULL,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "path" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobFile_jobId_idx" ON "JobFile"("jobId");

-- CreateIndex
CREATE INDEX "JobFile_sourceType_idx" ON "JobFile"("sourceType");

-- CreateIndex
CREATE INDEX "Artifact_jobId_idx" ON "Artifact"("jobId");

-- CreateIndex
CREATE INDEX "Artifact_type_idx" ON "Artifact"("type");

-- AddForeignKey
ALTER TABLE "JobFile" ADD CONSTRAINT "JobFile_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
