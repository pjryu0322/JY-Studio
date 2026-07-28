import type { KnowledgeScopeInventory } from "@prisma/client";
import type {
  KnowledgeScopeInventoryCountsDto,
  KnowledgeScopeInventoryItemDto,
  KnowledgeScopeInventorySummaryDto,
} from "@/lib/knowledge-scope/inventory-types";

export function toInventorySummaryDto(
  row: KnowledgeScopeInventory,
  countsOverride?: KnowledgeScopeInventoryCountsDto,
): KnowledgeScopeInventorySummaryDto {
  const counts: KnowledgeScopeInventoryCountsDto = countsOverride ?? {
    total: row.itemCount,
    included: row.includedCount,
    excluded: row.excludedCount,
    excludedBySystem: 0,
    excludedByAdmin: 0,
    excludedByProvider: 0,
    pending: row.pendingCount,
    reviewRequired: row.reviewRequiredCount,
    providerRequested: row.providerRequestedCount,
  };

  return {
    id: row.id,
    packId: row.packId,
    versionId: row.versionId,
    sourceRevisionId: row.sourceRevisionId,
    workingCopyId: row.workingCopyId,
    inventorySourceFingerprint: row.inventorySourceFingerprint ?? null,
    status: row.status,
    counts,
    finalizedAt: row.finalizedAt?.toISOString() ?? null,
    finalizedByUserId: row.finalizedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toInventoryItemDto(
  row: import("@prisma/client").KnowledgeScopeInventoryItem,
): KnowledgeScopeInventoryItemDto {
  return {
    id: row.id,
    inventoryId: row.inventoryId,
    relativePath: row.relativePath,
    fileName: row.fileName,
    extension: row.extension,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
    decision: row.decision,
    decisionSource: row.decisionSource,
    exclusionReasonCode: row.exclusionReasonCode,
    exclusionReasonText: row.exclusionReasonText,
    providerDecisionStatus: row.providerDecisionStatus,
    providerRequestNote: row.providerRequestNote,
    previewKind: row.previewKind,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    decidedByUserId: row.decidedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
