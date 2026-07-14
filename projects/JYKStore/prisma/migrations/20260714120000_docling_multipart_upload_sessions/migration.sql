-- Docling multipart upload sessions + async processing jobs (additive only)

CREATE TYPE "DoclingUploadSessionStatus" AS ENUM (
  'CREATED',
  'UPLOADING',
  'COMPLETING',
  'COMPLETED',
  'ABORTED',
  'EXPIRED',
  'FAILED'
);

CREATE TYPE "DoclingUploadFileStatus" AS ENUM (
  'PENDING',
  'UPLOADING',
  'COMPLETED',
  'ABORTED',
  'FAILED'
);

CREATE TYPE "DoclingProcessingJobStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED'
);

CREATE TABLE "DoclingUploadSession" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "status" "DoclingUploadSessionStatus" NOT NULL DEFAULT 'CREATED',
    "uploadedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "abortedAt" TIMESTAMP(3),
    "bundleId" TEXT,
    "processingJobId" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoclingUploadSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DoclingUploadFile" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "KnowledgePackFileRole" NOT NULL,
    "status" "DoclingUploadFileStatus" NOT NULL DEFAULT 'PENDING',
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileExtension" TEXT NOT NULL,
    "declaredFileSize" BIGINT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "multipartUploadId" TEXT,
    "partSizeBytes" INTEGER NOT NULL,
    "partCount" INTEGER NOT NULL,
    "checksumSha256" TEXT,
    "etag" TEXT,
    "knowledgePackFileId" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoclingUploadFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DoclingProcessingJob" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "sessionId" TEXT,
    "status" "DoclingProcessingJobStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockOwner" TEXT,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoclingProcessingJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DoclingUploadSession_packId_versionId_idx" ON "DoclingUploadSession"("packId", "versionId");
CREATE INDEX "DoclingUploadSession_status_expiresAt_idx" ON "DoclingUploadSession"("status", "expiresAt");
CREATE INDEX "DoclingUploadSession_bundleId_idx" ON "DoclingUploadSession"("bundleId");

CREATE UNIQUE INDEX "DoclingUploadFile_sessionId_role_key" ON "DoclingUploadFile"("sessionId", "role");
CREATE INDEX "DoclingUploadFile_objectKey_idx" ON "DoclingUploadFile"("objectKey");
CREATE INDEX "DoclingUploadFile_multipartUploadId_idx" ON "DoclingUploadFile"("multipartUploadId");

CREATE INDEX "DoclingProcessingJob_status_createdAt_idx" ON "DoclingProcessingJob"("status", "createdAt");
CREATE INDEX "DoclingProcessingJob_bundleId_idx" ON "DoclingProcessingJob"("bundleId");
CREATE INDEX "DoclingProcessingJob_packId_versionId_idx" ON "DoclingProcessingJob"("packId", "versionId");

ALTER TABLE "DoclingUploadFile" ADD CONSTRAINT "DoclingUploadFile_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DoclingUploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
