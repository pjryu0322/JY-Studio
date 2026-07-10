export type ProviderReviewSubmitSnapshot = {
  submittedAt: string;
  submittedVersionId: string;
  sourceDocumentIds: string[];
  activeChunkIds: string[];
  sourceDocumentCount: number;
  activeChunkCount: number;
  retrievalEvaluationSetId?: string;
  retrievalEvaluationRunId?: string;
  releaseGateRunId: string;
  releaseGateStatus: "PASS" | "WARNING";
  retrievalEvaluationStatus?: "PASS" | "WARNING";
  warnings: string[];
};

export function buildProviderReviewSubmitSnapshot(input: {
  submittedVersionId: string;
  sourceDocumentIds: string[];
  activeChunkIds: string[];
  retrievalEvaluationSetId?: string;
  retrievalEvaluationRunId?: string;
  releaseGateRunId: string;
  releaseGateStatus: "PASS" | "WARNING";
  retrievalEvaluationStatus?: "PASS" | "WARNING";
  warnings: string[];
}): ProviderReviewSubmitSnapshot {
  return {
    submittedAt: new Date().toISOString(),
    submittedVersionId: input.submittedVersionId,
    sourceDocumentIds: input.sourceDocumentIds,
    activeChunkIds: input.activeChunkIds,
    sourceDocumentCount: input.sourceDocumentIds.length,
    activeChunkCount: input.activeChunkIds.length,
    retrievalEvaluationSetId: input.retrievalEvaluationSetId,
    retrievalEvaluationRunId: input.retrievalEvaluationRunId,
    releaseGateRunId: input.releaseGateRunId,
    releaseGateStatus: input.releaseGateStatus,
    retrievalEvaluationStatus: input.retrievalEvaluationStatus,
    warnings: input.warnings,
  };
}

export function parseProviderReviewSubmitSnapshot(
  value: unknown,
): ProviderReviewSubmitSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.submittedAt !== "string" || typeof raw.releaseGateRunId !== "string") {
    return null;
  }
  if (raw.releaseGateStatus !== "PASS" && raw.releaseGateStatus !== "WARNING") {
    return null;
  }
  const sourceDocumentIds = Array.isArray(raw.sourceDocumentIds)
    ? raw.sourceDocumentIds.filter((id): id is string => typeof id === "string")
    : [];
  const activeChunkIds = Array.isArray(raw.activeChunkIds)
    ? raw.activeChunkIds.filter((id): id is string => typeof id === "string")
    : [];
  return {
    submittedAt: raw.submittedAt,
    submittedVersionId:
      typeof raw.submittedVersionId === "string" ? raw.submittedVersionId : "",
    sourceDocumentIds,
    activeChunkIds,
    sourceDocumentCount:
      typeof raw.sourceDocumentCount === "number"
        ? raw.sourceDocumentCount
        : sourceDocumentIds.length,
    activeChunkCount:
      typeof raw.activeChunkCount === "number" ? raw.activeChunkCount : activeChunkIds.length,
    retrievalEvaluationSetId:
      typeof raw.retrievalEvaluationSetId === "string" ? raw.retrievalEvaluationSetId : undefined,
    retrievalEvaluationRunId:
      typeof raw.retrievalEvaluationRunId === "string" ? raw.retrievalEvaluationRunId : undefined,
    releaseGateRunId: raw.releaseGateRunId,
    releaseGateStatus: raw.releaseGateStatus,
    retrievalEvaluationStatus:
      raw.retrievalEvaluationStatus === "PASS" || raw.retrievalEvaluationStatus === "WARNING"
        ? raw.retrievalEvaluationStatus
        : undefined,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.filter((w): w is string => typeof w === "string")
      : [],
  };
}
