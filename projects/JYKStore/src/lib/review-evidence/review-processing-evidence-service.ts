import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import type {
  DoclingImportBundlePublicDto,
  PackCapabilitiesDto,
} from "@/lib/docling-import/docling-import-dto";
import {
  isDistributionReviewSnapshot,
  isDoclingBundleReviewSnapshot,
} from "@/lib/provider-review-submit-snapshot";
import {
  buildDistributionProcessingEvidence,
  buildDoclingProcessingEvidence,
  buildLegacyProcessingEvidence,
} from "@/lib/review-evidence/review-processing-evidence-adapters";
import type { ImportProcessingEvidenceDto } from "@/lib/review-evidence/review-processing-evidence-dto";

export function resolveReviewProcessingEvidence(input: {
  detail: AdminReviewDetailDto;
  bundle?: DoclingImportBundlePublicDto | null;
  capabilities?: PackCapabilitiesDto | null;
}): ImportProcessingEvidenceDto {
  const snapshot = input.detail.latestReview?.submitSnapshot ?? null;
  if (isDoclingBundleReviewSnapshot(snapshot) || input.bundle) {
    return buildDoclingProcessingEvidence({
      detail: input.detail,
      bundle: input.bundle ?? null,
      capabilities: input.capabilities ?? null,
    });
  }
  if (isDistributionReviewSnapshot(snapshot) || input.detail.payload) {
    return buildDistributionProcessingEvidence(input.detail);
  }
  return buildLegacyProcessingEvidence(input.detail);
}

export function resolveApprovalPublishGuidance(
  evidence: Pick<ImportProcessingEvidenceDto, "capabilities">,
): string[] {
  const downloadReady = evidence.capabilities.download.status === "READY";
  const retrievalReady =
    evidence.capabilities.retrieval.status === "READY" ||
    evidence.capabilities.context.status === "READY";
  const mcpReady = evidence.capabilities.mcp.status === "READY";

  if (mcpReady && retrievalReady) {
    return ["승인하면 카탈로그, API 및 MCP에서 사용할 수 있습니다."];
  }
  if (retrievalReady) {
    return ["승인하면 카탈로그, 다운로드 및 Context API에 공개됩니다."];
  }
  if (downloadReady) {
    return [
      "승인하면 카탈로그와 원본 다운로드에 공개됩니다.",
      "Context API와 MCP는 Runtime 준비 후 활성화됩니다.",
    ];
  }
  return ["승인하면 일반 카탈로그에 공개됩니다."];
}
