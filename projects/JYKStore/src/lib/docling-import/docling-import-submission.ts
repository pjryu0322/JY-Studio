import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";

type ReviewClient = Prisma.TransactionClient | typeof prisma;

/**
 * Submission history is bundle-scoped only.
 * Same version + different bundle must NOT inherit immutability.
 */
export async function bundleHasSubmissionHistory(
  packId: string,
  bundleId: string,
  _versionId?: string,
  client: ReviewClient = prisma,
): Promise<boolean> {
  const reviews = await client.packReview.findMany({
    where: { packId },
    select: { submitSnapshot: true },
  });
  for (const review of reviews) {
    const snap = parseReviewSubmitSnapshot(review.submitSnapshot);
    if (!snap) continue;
    if (snap.mode === "DOCLING_BUNDLE" && snap.doclingBundleId === bundleId) {
      return true;
    }
  }
  return false;
}
