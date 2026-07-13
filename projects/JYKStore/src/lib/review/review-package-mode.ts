import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";
import type { ReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";

export type ReviewPackageMode = "LEGACY_BUILDER" | "DISTRIBUTION_ZIP" | "DOCLING_BUNDLE";

/**
 * Resolves which approval path applies for a review submit snapshot.
 * DISTRIBUTION / DOCLING_BUNDLE skip legacy release-gate evaluation.
 */
export function resolveReviewPackageMode(
  snapshot: ReviewSubmitSnapshot | { mode?: string } | null | undefined,
  detail?: Pick<AdminReviewDetailDto, "payload"> | null,
): ReviewPackageMode {
  void detail;
  if (!snapshot || typeof snapshot !== "object") {
    return "LEGACY_BUILDER";
  }
  const mode = "mode" in snapshot ? snapshot.mode : undefined;
  if (mode === "DISTRIBUTION") {
    return "DISTRIBUTION_ZIP";
  }
  if (mode === "DOCLING_BUNDLE") {
    return "DOCLING_BUNDLE";
  }
  return "LEGACY_BUILDER";
}
