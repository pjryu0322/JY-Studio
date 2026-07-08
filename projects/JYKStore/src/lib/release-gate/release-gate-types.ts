export type ReleaseGateStatus = "PASS" | "WARNING" | "FAIL";

export type ReleaseGateIssue = {
  severity: "BLOCKER" | "WARNING";
  code: string;
  message: string;
  field?: string | null;
  hint?: string | null;
};

export type ReleaseGateSectionStatus = "PASS" | "WARNING" | "FAIL" | "MISSING" | "SKIPPED";

export type ReleaseGateSourceDocument = {
  id: string;
  title: string;
  validationStatus: string;
  updatedAt: string;
};

export type ReleaseGateSourceValidationReport = {
  status: string;
  checkedAt: string;
};

export type ReleaseGateEvaluationInput = {
  packStatus: string;
  versionId: string | null;
  hasRequiredDescription: boolean;
  sourceDocuments: ReleaseGateSourceDocument[];
  latestReportsByDocumentId: Record<string, ReleaseGateSourceValidationReport | undefined>;
  structureQuality: import("@/lib/structure-quality/structure-quality-dto").StructureQualitySummaryDto | null;
  chunkQuality: import("@/lib/chunk-quality/chunk-quality-dto").ChunkQualitySummaryDto | null;
  retrievalEvaluation: import("@/lib/retrieval-evaluation/retrieval-evaluation-dto").RetrievalEvaluationSummaryDto | null;
  graphNodeCount: number;
  targetStatus: "PUBLISHED" | "VERIFIED";
  requireReviewingStatus?: boolean;
};

export type ReleaseGateEvaluationResult = {
  status: ReleaseGateStatus;
  blockingIssueCount: number;
  warningIssueCount: number;
  sourceStatus: ReleaseGateSectionStatus;
  structureStatus: ReleaseGateSectionStatus;
  chunkStatus: ReleaseGateSectionStatus;
  retrievalStatus: ReleaseGateSectionStatus;
  graphStatus: ReleaseGateSectionStatus;
  issues: ReleaseGateIssue[];
  summary: string;
  versionId: string | null;
  targetStatus: "PUBLISHED" | "VERIFIED";
};
