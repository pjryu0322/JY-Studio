export type ProviderReviewSubmitSnapshot = {
  submittedAt: string;
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
  return {
    submittedAt: raw.submittedAt,
    sourceDocumentIds: Array.isArray(raw.sourceDocumentIds)
      ? raw.sourceDocumentIds.filter((id): id is string => typeof id === "string")
      : [],
    activeChunkIds: Array.isArray(raw.activeChunkIds)
      ? raw.activeChunkIds.filter((id): id is string => typeof id === "string")
      : [],
    sourceDocumentCount:
      typeof raw.sourceDocumentCount === "number"
        ? raw.sourceDocumentCount
        : Array.isArray(raw.sourceDocumentIds)
          ? raw.sourceDocumentIds.length
          : 0,
    activeChunkCount:
      typeof raw.activeChunkCount === "number"
        ? raw.activeChunkCount
        : Array.isArray(raw.activeChunkIds)
          ? raw.activeChunkIds.length
          : 0,
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
