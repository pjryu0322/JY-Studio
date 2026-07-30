/**
 * P6.1 — Provider review revision binding encoded in PipelineRun.summary.
 * Keeps human-readable prefix for older UIs; JSON trailer is authoritative.
 */

export type ProviderReviewRevisionBinding = {
  v: 1;
  indexGenerationId: string;
  versionId: string;
  pipelineRunId: string;
  reviewedAt: string;
  reviewerClientId?: string | null;
};

const BINDING_MARKER = "\n__PROVIDER_REVIEW_BINDING__=";

export function encodeProviderReviewConfirmSummary(
  binding: ProviderReviewRevisionBinding,
): string {
  return `제공자가 생성 결과 검토를 확인 완료했습니다.${BINDING_MARKER}${JSON.stringify(binding)}`;
}

export function parseProviderReviewRevisionBinding(
  summary: string | null | undefined,
): ProviderReviewRevisionBinding | null {
  if (!summary) return null;
  const idx = summary.indexOf(BINDING_MARKER);
  if (idx < 0) return null;
  try {
    const raw = summary.slice(idx + BINDING_MARKER.length).trim();
    const parsed = JSON.parse(raw) as ProviderReviewRevisionBinding;
    if (
      parsed?.v !== 1 ||
      typeof parsed.indexGenerationId !== "string" ||
      !parsed.indexGenerationId.trim() ||
      typeof parsed.versionId !== "string" ||
      !parsed.versionId.trim() ||
      typeof parsed.pipelineRunId !== "string" ||
      !parsed.pipelineRunId.trim()
    ) {
      return null;
    }
    return {
      v: 1,
      indexGenerationId: parsed.indexGenerationId.trim(),
      versionId: parsed.versionId.trim(),
      pipelineRunId: parsed.pipelineRunId.trim(),
      reviewedAt:
        typeof parsed.reviewedAt === "string" && parsed.reviewedAt.trim()
          ? parsed.reviewedAt
          : new Date(0).toISOString(),
      reviewerClientId: parsed.reviewerClientId ?? null,
    };
  } catch {
    return null;
  }
}
