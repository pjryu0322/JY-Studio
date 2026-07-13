import { prisma } from "@/lib/prisma";
import { parseReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";

export async function bundleHasSubmissionHistory(
  packId: string,
  bundleId: string,
  versionId: string,
): Promise<boolean> {
  const reviews = await prisma.packReview.findMany({
    where: { packId },
    select: { submitSnapshot: true },
  });
  for (const review of reviews) {
    const snap = parseReviewSubmitSnapshot(review.submitSnapshot);
    if (!snap) continue;
    if (snap.mode === "DOCLING_BUNDLE") {
      if (snap.doclingBundleId === bundleId) return true;
      if (snap.submittedVersionId === versionId && snap.doclingBundleId) return true;
    }
  }
  return false;
}
