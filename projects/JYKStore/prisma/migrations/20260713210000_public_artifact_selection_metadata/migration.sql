-- CreateEnum
CREATE TYPE "PublicArtifactType" AS ENUM ('SOURCE_ORIGINAL', 'KNOWLEDGE_PACKAGE');

-- CreateEnum
CREATE TYPE "PackContentType" AS ENUM ('DOCUMENT', 'PRODUCT', 'API', 'FRAMEWORK', 'DATA', 'MIXED');

-- AlterTable
ALTER TABLE "PackDistributionMetadata"
ADD COLUMN "sourcePublisherName" TEXT,
ADD COLUMN "sourcePublisherUrl" TEXT,
ADD COLUMN "sourceDocumentVersion" TEXT,
ADD COLUMN "sourcePublishedAt" TIMESTAMP(3),
ADD COLUMN "sourceRetrievedAt" TIMESTAMP(3),
ADD COLUMN "primaryArtifactType" "PublicArtifactType",
ADD COLUMN "contentType" "PackContentType";
