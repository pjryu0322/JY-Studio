import {
  parseDistributionReviewSubmitSnapshot,
  type DistributionReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";

export type LegacyProviderReviewSubmitSnapshot = {
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
  mode?: "LEGACY";
};

/** @deprecated Use LegacyProviderReviewSubmitSnapshot — kept for existing imports. */
export type ProviderReviewSubmitSnapshot = LegacyProviderReviewSubmitSnapshot;

export type AnyReviewSubmitSnapshot =
  | LegacyProviderReviewSubmitSnapshot
  | DistributionReviewSubmitSnapshot;

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
}): LegacyProviderReviewSubmitSnapshot {
  return {
    mode: "LEGACY",
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

export function parseLegacyProviderReviewSubmitSnapshot(
  value: unknown,
): LegacyProviderReviewSubmitSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.mode === "DISTRIBUTION") return null;
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
    mode: "LEGACY",
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

/** Parses legacy or distribution submit snapshots. */
export function parseProviderReviewSubmitSnapshot(
  value: unknown,
): AnyReviewSubmitSnapshot | null {
  const distribution = parseDistributionReviewSubmitSnapshot(value);
  if (distribution) return distribution;
  return parseLegacyProviderReviewSubmitSnapshot(value);
}

export function isDistributionReviewSnapshot(
  snapshot: AnyReviewSubmitSnapshot | null | undefined,
): snapshot is DistributionReviewSubmitSnapshot {
  return snapshot?.mode === "DISTRIBUTION";
}

export type { DistributionReviewSubmitSnapshot };
