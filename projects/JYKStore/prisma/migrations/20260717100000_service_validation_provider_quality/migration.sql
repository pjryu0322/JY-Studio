-- Provider quality confirmation + retrieval result snapshot (append-only)
CREATE TYPE "ServiceValidationProviderConfirmationStatus" AS ENUM ('NOT_REVIEWED', 'CONFIRMED', 'REJECTED');

CREATE TABLE "ServiceValidationResultItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "chunkId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "snippet" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "sourceDocumentTitle" TEXT,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "sourceLocator" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceValidationResultItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceValidationProviderConfirmation" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "status" "ServiceValidationProviderConfirmationStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
    "relevanceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "contentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sourceConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "isolationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "fileNameConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "downloadOkConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "fileMatchConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "rejectionReason" TEXT,
    "comment" TEXT,
    "confirmedByUserId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharedConfirmationGroupId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceValidationProviderConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceValidationResultItem_runId_rank_key" ON "ServiceValidationResultItem"("runId", "rank");
CREATE INDEX "ServiceValidationResultItem_runId_idx" ON "ServiceValidationResultItem"("runId");
CREATE INDEX "ServiceValidationResultItem_chunkId_idx" ON "ServiceValidationResultItem"("chunkId");
CREATE INDEX "ServiceValidationResultItem_sourceDocumentId_idx" ON "ServiceValidationResultItem"("sourceDocumentId");

CREATE UNIQUE INDEX "ServiceValidationProviderConfirmation_runId_key" ON "ServiceValidationProviderConfirmation"("runId");
CREATE INDEX "ServiceValidationProviderConfirmation_sharedConfirmationGroupId_idx" ON "ServiceValidationProviderConfirmation"("sharedConfirmationGroupId");
CREATE INDEX "ServiceValidationProviderConfirmation_confirmedByUserId_idx" ON "ServiceValidationProviderConfirmation"("confirmedByUserId");

ALTER TABLE "ServiceValidationResultItem" ADD CONSTRAINT "ServiceValidationResultItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ServiceValidationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceValidationProviderConfirmation" ADD CONSTRAINT "ServiceValidationProviderConfirmation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ServiceValidationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
