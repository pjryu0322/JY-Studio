/**
 * P5.1.2: Re-validate approval evidence inside the admin approval transaction.
 * Authority data is ALWAYS the DB PackReview.submitSnapshot (never a memory object).
 */

import type { Prisma, SearchIndexGeneration } from "@prisma/client";
import {
  isReviewSubmitSnapshotV3,
  parseDoclingBundleReviewSubmitSnapshot,
  type DoclingBundleReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";
import { PayloadServiceError, type PayloadErrorCode } from "@/lib/distribution/payload-errors";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { PackReviewStatus } from "@/lib/pack-review-status";
import {
  embeddingDescriptorsEqual,
  validateOperationalEmbeddingDescriptor,
} from "@/lib/search-generation/search-generation-descriptor";

export type ApprovalSearchGenerationContext = {
  /** Parsed from DB PackReview.submitSnapshot — the sole authority for approval. */
  snapshot: DoclingBundleReviewSubmitSnapshot;
  generation: SearchIndexGeneration;
  versionId: string;
  normalizedDocumentId: string;
  pipelineRunId: string;
  fingerprint: string;
  reviewId: string;
};

const APPROVAL_MISMATCH =
  "제출 이후 검수 증적 또는 상태가 변경되었습니다. 화면을 새로고침한 뒤 다시 확인해 주세요.";

function mismatch(code: PayloadErrorCode = "SEARCH_GENERATION_MISMATCH"): never {
  throw new PayloadServiceError(code, APPROVAL_MISMATCH, 409);
}

/**
 * Re-read PackReview.submitSnapshot from DB and verify all approval evidence inside `tx`.
 * Do NOT pass an external snapshot — the DB row is the authority.
 */
export async function assertApprovalSearchGenerationInTx(
  tx: Prisma.TransactionClient,
  input: {
    packId: string;
    reviewId: string;
  },
): Promise<ApprovalSearchGenerationContext> {
  const { packId, reviewId } = input;

  const pack = await tx.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true, status: true },
  });
  if (!pack || pack.status !== "REVIEWING") {
    mismatch("APPROVAL_TRANSITION_CONFLICT");
  }

  const review = await tx.packReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      packId: true,
      status: true,
      submitSnapshot: true,
      updatedAt: true,
    },
  });
  if (!review || review.packId !== packId || review.status !== PackReviewStatus.IN_REVIEW) {
    mismatch("APPROVAL_TRANSITION_CONFLICT");
  }

  // A: DB submitSnapshot is the sole approval authority.
  const parsed = parseDoclingBundleReviewSubmitSnapshot(review.submitSnapshot);
  if (!parsed || parsed.mode !== "DOCLING_BUNDLE") {
    mismatch("APPROVAL_SNAPSHOT_MISMATCH");
  }
  if (!isReviewSubmitSnapshotV3(parsed)) {
    mismatch("APPROVAL_SNAPSHOT_MISMATCH");
  }
  const snapshot = parsed;

  const latestVersion = await tx.knowledgePackVersion.findFirst({
    where: { packId },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!latestVersion || snapshot.submittedVersionId !== latestVersion.id) {
    mismatch();
  }

  const activeNd = await tx.normalizedDocument.findFirst({
    where: { versionId: latestVersion.id, isActive: true },
    select: { id: true, fingerprint: true },
  });
  if (
    !activeNd ||
    snapshot.normalizedDocumentId !== activeNd.id ||
    (snapshot.normalizedDocumentFingerprint ?? snapshot.fingerprint) !== activeNd.fingerprint
  ) {
    mismatch();
  }

  if (
    !snapshot.pipelineRunId ||
    !snapshot.indexGenerationId ||
    !snapshot.searchIndexGenerationId ||
    !snapshot.chunkGenerationId ||
    !snapshot.searchGenerationFingerprint ||
    snapshot.retrievalEvaluationStatus !== "PASS"
  ) {
    mismatch("APPROVAL_SNAPSHOT_MISMATCH");
  }

  // B: chunkGenerationId must agree with both snapshot IDs and the Generation row.
  if (
    snapshot.chunkGenerationId !== snapshot.indexGenerationId ||
    snapshot.chunkGenerationId !== snapshot.searchIndexGenerationId ||
    snapshot.searchIndexGenerationId !== snapshot.indexGenerationId
  ) {
    mismatch();
  }

  const passRun = await tx.pipelineRun.findUnique({
    where: { id: snapshot.pipelineRunId },
    include: { steps: true },
  });
  const binding = parseKnowledgeRunBinding(passRun?.summary ?? null);
  const evalStep = passRun?.steps.find((s) => s.step === "SEARCH_EVALUATING");
  const readyStep = passRun?.steps.find((s) => s.step === "READY_FOR_REVIEW");
  if (
    !passRun ||
    passRun.status !== "PASS" ||
    !binding ||
    binding.indexGenerationId !== snapshot.indexGenerationId ||
    binding.indexGenerationId !== snapshot.searchIndexGenerationId ||
    binding.indexGenerationId !== snapshot.chunkGenerationId ||
    binding.versionId !== latestVersion.id ||
    binding.normalizedDocumentId !== activeNd.id ||
    binding.fingerprint !== activeNd.fingerprint ||
    evalStep?.status !== "PASS" ||
    readyStep?.status !== "PASS"
  ) {
    mismatch();
  }

  const generation = await tx.searchIndexGeneration.findUnique({
    where: { id: snapshot.searchIndexGenerationId },
  });
  if (
    !generation ||
    generation.id !== snapshot.searchIndexGenerationId ||
    generation.id !== snapshot.indexGenerationId ||
    generation.id !== binding.indexGenerationId ||
    generation.packId !== packId ||
    generation.versionId !== latestVersion.id ||
    generation.pipelineRunId !== snapshot.pipelineRunId ||
    generation.pipelineRunId !== passRun.id ||
    generation.normalizedDocumentId !== activeNd.id ||
    generation.normalizedDocumentId !== snapshot.normalizedDocumentId ||
    generation.fingerprint !== activeNd.fingerprint ||
    generation.chunkGenerationId !== snapshot.chunkGenerationId ||
    generation.chunkGenerationId !== snapshot.indexGenerationId ||
    generation.status !== "READY" ||
    generation.scope !== "DRAFT" ||
    generation.chunkCount <= 0 ||
    generation.embeddedCount !== generation.chunkCount ||
    generation.failedCount !== 0
  ) {
    mismatch("SEARCH_GENERATION_NOT_CURRENT");
  }

  if (generation.generationFingerprint !== snapshot.searchGenerationFingerprint) {
    mismatch("SEARCH_GENERATION_NOT_CURRENT");
  }

  const generationDescriptor = {
    embeddingProvider: generation.embeddingProvider,
    embeddingModel: generation.embeddingModel,
    embeddingModelRevision: generation.embeddingModelRevision,
    embeddingDimension: generation.embeddingDimension,
    distanceMetric: generation.distanceMetric,
  };
  const generationCheck = validateOperationalEmbeddingDescriptor(generationDescriptor);
  if (!generationCheck.ok) {
    mismatch(generationCheck.code);
  }

  const snapshotDescriptor = {
    embeddingProvider: snapshot.embeddingProvider,
    embeddingModel: snapshot.embeddingModel,
    embeddingModelRevision: snapshot.embeddingModelRevision,
    embeddingDimension: snapshot.embeddingDimension,
    distanceMetric: snapshot.distanceMetric,
  };
  const snapshotCheck = validateOperationalEmbeddingDescriptor(snapshotDescriptor);
  if (!snapshotCheck.ok) {
    mismatch(snapshotCheck.code);
  }
  if (!embeddingDescriptorsEqual(snapshotDescriptor, generationDescriptor)) {
    mismatch("SEARCH_GENERATION_DESCRIPTOR_DRIFT");
  }

  // Full service-validation evidence is asserted by the caller via
  // assertCurrentServiceValidationEvidence({ client: tx, snapshot }).
  // Keep a minimal run-id presence check here so Generation binding stays coherent.
  const prep = snapshot.preparationValidation;
  if (!prep?.API?.runId || !prep?.MCP?.runId || !prep?.DOWNLOAD?.runId) {
    mismatch("APPROVAL_SNAPSHOT_MISMATCH");
  }

  return {
    snapshot,
    generation,
    versionId: latestVersion.id,
    normalizedDocumentId: activeNd.id,
    pipelineRunId: passRun.id,
    fingerprint: activeNd.fingerprint!,
    reviewId: review.id,
  };
}
