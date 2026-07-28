-- P3: Knowledge Scope Inventory DB (SoT for Worker input file selection).

CREATE TYPE "KnowledgeScopeInventoryStatus" AS ENUM ('DRAFT', 'FINALIZED', 'SUPERSEDED');
CREATE TYPE "KnowledgeScopeItemDecision" AS ENUM ('PENDING', 'INCLUDED', 'EXCLUDED', 'REVIEW_REQUIRED');
CREATE TYPE "KnowledgeScopeDecisionSource" AS ENUM ('SYSTEM', 'ADMIN', 'PROVIDER');
CREATE TYPE "KnowledgeScopeProviderDecision" AS ENUM ('NONE', 'REQUESTED', 'INCLUDED', 'EXCLUDED');
CREATE TYPE "KnowledgeScopeExclusionReason" AS ENUM (
  'ZERO_BYTE',
  'EXECUTABLE',
  'EXECUTABLE_LIBRARY',
  'BUILD_ARTIFACT',
  'CACHE',
  'FONT',
  'LICENSE_OR_KEY',
  'UNSUPPORTED',
  'NON_KNOWLEDGE_FILE',
  'ADMIN_DECISION',
  'PROVIDER_DECISION',
  'EXCLUDED_DIRECTORY',
  'EXCLUDED_FILE_NAME',
  'EXCLUDED_EXTENSION',
  'FILE_SIZE_EXCEEDED',
  'OTHER'
);

ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_INVENTORY_DECISION';
ALTER TYPE "AuditAction" ADD VALUE 'PROVIDER_INVENTORY_DECISION';
ALTER TYPE "AuditAction" ADD VALUE 'ADMIN_INVENTORY_SCOPE_FINALIZE';

CREATE TABLE "KnowledgeScopeInventory" (
  "id" TEXT NOT NULL,
  "packId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "sourceRevisionId" TEXT NOT NULL,
  "workingCopyId" TEXT,
  "status" "KnowledgeScopeInventoryStatus" NOT NULL DEFAULT 'DRAFT',
  "itemCount" INTEGER NOT NULL DEFAULT 0,
  "includedCount" INTEGER NOT NULL DEFAULT 0,
  "excludedCount" INTEGER NOT NULL DEFAULT 0,
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "reviewRequiredCount" INTEGER NOT NULL DEFAULT 0,
  "providerRequestedCount" INTEGER NOT NULL DEFAULT 0,
  "finalizedAt" TIMESTAMP(3),
  "finalizedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeScopeInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeScopeInventory_versionId_sourceRevisionId_key"
  ON "KnowledgeScopeInventory"("versionId", "sourceRevisionId");
CREATE INDEX "KnowledgeScopeInventory_packId_status_idx"
  ON "KnowledgeScopeInventory"("packId", "status");
CREATE INDEX "KnowledgeScopeInventory_workingCopyId_idx"
  ON "KnowledgeScopeInventory"("workingCopyId");
CREATE INDEX "KnowledgeScopeInventory_sourceRevisionId_idx"
  ON "KnowledgeScopeInventory"("sourceRevisionId");

ALTER TABLE "KnowledgeScopeInventory"
  ADD CONSTRAINT "KnowledgeScopeInventory_packId_fkey"
  FOREIGN KEY ("packId") REFERENCES "KnowledgePack"("packId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeScopeInventory"
  ADD CONSTRAINT "KnowledgeScopeInventory_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "KnowledgePackVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeScopeInventory"
  ADD CONSTRAINT "KnowledgeScopeInventory_workingCopyId_fkey"
  FOREIGN KEY ("workingCopyId") REFERENCES "WorkerZipWorkingCopy"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "KnowledgeScopeInventoryItem" (
  "id" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "relativePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "extension" TEXT NOT NULL DEFAULT '',
  "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  "mimeType" TEXT,
  "contentHash" TEXT,
  "fileCategory" TEXT,
  "decision" "KnowledgeScopeItemDecision" NOT NULL DEFAULT 'PENDING',
  "decisionSource" "KnowledgeScopeDecisionSource" NOT NULL DEFAULT 'SYSTEM',
  "exclusionReasonCode" "KnowledgeScopeExclusionReason",
  "exclusionReasonText" TEXT,
  "providerDecisionStatus" "KnowledgeScopeProviderDecision" NOT NULL DEFAULT 'NONE',
  "providerRequestNote" TEXT,
  "previewKind" TEXT,
  "decidedAt" TIMESTAMP(3),
  "decidedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeScopeInventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeScopeInventoryItem_inventoryId_relativePath_key"
  ON "KnowledgeScopeInventoryItem"("inventoryId", "relativePath");
CREATE INDEX "KnowledgeScopeInventoryItem_inventoryId_decision_idx"
  ON "KnowledgeScopeInventoryItem"("inventoryId", "decision");
CREATE INDEX "KnowledgeScopeInventoryItem_inventoryId_providerDecisionStatus_idx"
  ON "KnowledgeScopeInventoryItem"("inventoryId", "providerDecisionStatus");
CREATE INDEX "KnowledgeScopeInventoryItem_inventoryId_exclusionReasonCode_idx"
  ON "KnowledgeScopeInventoryItem"("inventoryId", "exclusionReasonCode");
CREATE INDEX "KnowledgeScopeInventoryItem_inventoryId_extension_idx"
  ON "KnowledgeScopeInventoryItem"("inventoryId", "extension");
CREATE INDEX "KnowledgeScopeInventoryItem_inventoryId_fileName_idx"
  ON "KnowledgeScopeInventoryItem"("inventoryId", "fileName");

ALTER TABLE "KnowledgeScopeInventoryItem"
  ADD CONSTRAINT "KnowledgeScopeInventoryItem_inventoryId_fkey"
  FOREIGN KEY ("inventoryId") REFERENCES "KnowledgeScopeInventory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "KnowledgeScopeDecisionEvent" (
  "id" TEXT NOT NULL,
  "inventoryId" TEXT NOT NULL,
  "itemId" TEXT,
  "actorUserId" TEXT,
  "actorRole" TEXT NOT NULL,
  "fromDecision" "KnowledgeScopeItemDecision",
  "toDecision" "KnowledgeScopeItemDecision",
  "fromSource" "KnowledgeScopeDecisionSource",
  "toSource" "KnowledgeScopeDecisionSource",
  "fromProviderStatus" "KnowledgeScopeProviderDecision",
  "toProviderStatus" "KnowledgeScopeProviderDecision",
  "reasonCode" "KnowledgeScopeExclusionReason",
  "reasonText" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "KnowledgeScopeDecisionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeScopeDecisionEvent_inventoryId_createdAt_idx"
  ON "KnowledgeScopeDecisionEvent"("inventoryId", "createdAt");
CREATE INDEX "KnowledgeScopeDecisionEvent_itemId_createdAt_idx"
  ON "KnowledgeScopeDecisionEvent"("itemId", "createdAt");

ALTER TABLE "KnowledgeScopeDecisionEvent"
  ADD CONSTRAINT "KnowledgeScopeDecisionEvent_inventoryId_fkey"
  FOREIGN KEY ("inventoryId") REFERENCES "KnowledgeScopeInventory"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeScopeDecisionEvent"
  ADD CONSTRAINT "KnowledgeScopeDecisionEvent_itemId_fkey"
  FOREIGN KEY ("itemId") REFERENCES "KnowledgeScopeInventoryItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
