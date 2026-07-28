import type {
  KnowledgeScopeDecisionSource,
  KnowledgeScopeExclusionReason,
  KnowledgeScopeInventoryStatus,
  KnowledgeScopeItemDecision,
  KnowledgeScopeProviderDecision,
} from "@prisma/client";

export type KnowledgeScopeInventorySummaryDto = {
  id: string;
  packId: string;
  versionId: string;
  sourceRevisionId: string;
  workingCopyId: string | null;
  inventorySourceFingerprint: string | null;
  status: KnowledgeScopeInventoryStatus;
  counts: KnowledgeScopeInventoryCountsDto;
  finalizedAt: string | null;
  finalizedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeScopeInventoryCountsDto = {
  total: number;
  included: number;
  excluded: number;
  excludedBySystem: number;
  excludedByAdmin: number;
  excludedByProvider: number;
  pending: number;
  reviewRequired: number;
  providerRequested: number;
};

export type KnowledgeScopeInventoryItemDto = {
  id: string;
  inventoryId: string;
  relativePath: string;
  fileName: string;
  extension: string;
  sizeBytes: number;
  mimeType: string | null;
  decision: KnowledgeScopeItemDecision;
  decisionSource: KnowledgeScopeDecisionSource;
  exclusionReasonCode: KnowledgeScopeExclusionReason | null;
  exclusionReasonText: string | null;
  providerDecisionStatus: KnowledgeScopeProviderDecision;
  providerRequestNote: string | null;
  previewKind: string | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeScopeInventoryListFilters = {
  inventoryId: string;
  page: number;
  pageSize: number;
  q?: string;
  decision?: KnowledgeScopeItemDecision;
  extension?: string;
  exclusionReasonCode?: KnowledgeScopeExclusionReason;
  decisionSource?: KnowledgeScopeDecisionSource;
  providerDecisionStatus?: KnowledgeScopeProviderDecision;
  pathPrefix?: string;
};

export type KnowledgeScopeInventoryListResult = {
  items: KnowledgeScopeInventoryItemDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type InventoryAdminDecisionAction =
  | "INCLUDE"
  | "EXCLUDE"
  | "REQUEST_PROVIDER"
  | "CLEAR_TO_REVIEW";

export type UpdateInventoryItemDecisionInput = {
  inventoryId: string;
  itemId: string;
  action: InventoryAdminDecisionAction;
  actorUserId: string;
  /** Required for EXCLUDE when not safety-blocked override path. */
  exclusionReasonCode?: KnowledgeScopeExclusionReason;
  exclusionReasonText?: string;
  providerRequestNote?: string;
};

export type BulkUpdateInventoryItemDecisionsInput = {
  inventoryId: string;
  itemIds: string[];
  action: InventoryAdminDecisionAction;
  actorUserId: string;
  exclusionReasonCode?: KnowledgeScopeExclusionReason;
  exclusionReasonText?: string;
  providerRequestNote?: string;
};

export type ProviderInventoryDecision = "INCLUDED" | "EXCLUDED";

export type RespondProviderInventoryDecisionInput = {
  packId: string;
  itemIds: string[];
  decision: ProviderInventoryDecision;
  providerUserId: string;
};

export class KnowledgeScopeInventoryError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "KnowledgeScopeInventoryError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
