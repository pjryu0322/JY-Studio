/**
 * Lazy loader to avoid a static cycle:
 * admin-review-service (facade) → publishing/* → getAdminReviewDetail.
 */
import type { AdminReviewDetailDto } from "@/lib/admin-review-dto";

export async function loadAdminReviewDetail(
  packId: string,
): Promise<AdminReviewDetailDto | null> {
  const { getAdminReviewDetail } = await import("@/lib/admin-review-service");
  return getAdminReviewDetail(packId);
}
