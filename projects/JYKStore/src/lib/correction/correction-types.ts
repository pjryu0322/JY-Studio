/**
 * P5 Exception-only Correction Workbench — shared types and errors.
 */

import type {
  CorrectionCaseStatus,
  CorrectionRequestedAction,
  CorrectionSeverity,
  CorrectionTargetType,
} from "@prisma/client";

export type CorrectionCaseDto = {
  id: string;
  packId: string;
  versionId: string;
  targetType: CorrectionTargetType;
  targetId: string;
  secondaryTargetId: string | null;
  issueCode: string | null;
  severity: CorrectionSeverity;
  title: string;
  description: string;
  sourceLocation: string | null;
  contentPreview: string | null;
  recommendedAction: CorrectionRequestedAction | null;
  status: CorrectionCaseStatus;
  generationRunId: string | null;
  searchIndexGenerationId: string | null;
  inventoryItemId: string | null;
  relativePath: string | null;
  parameters: Record<string, unknown> | null;
  appliedAt: string | null;
  appliedByUserId: string | null;
  regeneratedAt: string | null;
  verifiedAt: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  availableActions: CorrectionRequestedAction[];
  nextAction: string;
};

export type CorrectionWorkbenchSummaryDto = {
  packId: string;
  versionId: string | null;
  openCount: number;
  appliedCount: number;
  regeneratedCount: number;
  verifiedCount: number;
  closedCount: number;
  blockerCount: number;
  warningCount: number;
  currentStatus: string;
  nextWork: string;
};

export type CorrectionAuditEventDto = {
  id: string;
  caseId: string;
  actorUserId: string | null;
  action: string;
  fromStatus: CorrectionCaseStatus | null;
  toStatus: CorrectionCaseStatus | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

export class CorrectionServiceError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = "CorrectionServiceError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
