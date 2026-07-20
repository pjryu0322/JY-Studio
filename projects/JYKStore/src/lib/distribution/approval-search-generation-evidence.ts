/**
 * P5.1.3: Re-validate approval evidence inside the admin approval transaction.
 * Authority data is ALWAYS the DB PackReview.submitSnapshot (never a memory object).
 * External Object Storage checks are bound via expectedSnapshotFingerprint.
 */

import type { Prisma, SearchIndexGeneration } from "@prisma/client";
import {
  isReviewSubmitSnapshotV3,
  parseDoclingBundleReviewSubmitSnapshot,
  type DoclingBundleReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";
import { PayloadServiceError, type PayloadErrorCode } from "@/lib/distribution/payload-errors";
import { computeReviewSubmitSnapshotFingerprint } from "@/lib/distribution/review-submit-snapshot-fingerprint";
import { assertCompletePreparationValidationSnapshotEntry } from "@/lib/distribution/preparation-validation-snapshot-entry";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import { PackReviewStatus } from "@/lib/pack-review-status";
import { resolveReviewPackageMode } from "@/lib/review/review-package-mode";
import {
  embeddingDescriptorsEqual,
  validateOperationalEmbeddingDescriptor,
} from "@/lib/search-generation/search-generation-descriptor";

const PREPARATION_CHANNELS: ServiceChannel[] = ["API", "MCP", "DOWNLOAD"];

export type ApprovalSearchGenerationContext = {
  /** Parsed from DB PackReview.submitSnapshot — the sole authority for approval. */
  snapshot: DoclingBundleReviewSubmitSnapshot;
  snapshotFingerprint: string;
  packageMode: "DOCLING_BUNDLE";
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

/** DB + pure: pack must be REVIEWING and the review must be its IN_REVIEW row. */
async function loadApprovalPackAndReview(
  tx: Prisma.TransactionClient,
  packId: string,
  reviewId: string,
) {
  const pack = await tx.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true, status: true },
  });
  if (!pack || pack.status !== "REVIEWING") {
    mismatch("APPROVAL_TRANSITION_CONFLICT");
  }

  const review = await tx.packReview.findUnique({
    where: { id: reviewId },
    select: { id: true, packId: true, status: true, submitSnapshot: true, updatedAt: true },
  });
  if (!review || review.packId !== packId || review.status !== PackReviewStatus.IN_REVIEW) {
    mismatch("APPROVAL_TRANSITION_CONFLICT");
  }
  return review;
}

/** Pure: parse + validate the DB submitSnapshot is the sole, current approval authority. */
function parseApprovalSnapshot(
  submitSnapshot: unknown,
  expectedSnapshotFingerprint: string,
): { snapshot: DoclingBundleReviewSubmitSnapshot; snapshotFingerprint: string } {
  const parsed = parseDoclingBundleReviewSubmitSnapshot(submitSnapshot);
  if (!parsed || parsed.mode !== "DOCLING_BUNDLE" || !isReviewSubmitSnapshotV3(parsed)) {
    mismatch("APPROVAL_SNAPSHOT_MISMATCH");
  }
  const snapshotFingerprint = computeReviewSubmitSnapshotFingerprint(parsed);
  if (
    snapshotFingerprint !== expectedSnapshotFingerprint ||
    resolveReviewPackageMode(parsed) !== "DOCLING_BUNDLE"
  ) {
    mismatch("APPROVAL_SNAPSHOT_MISMATCH");
  }
  return { snapshot: parsed, snapshotFingerprint };
}

/** DB + pure: latest version + its active normalized document must match the snapshot. */
async function loadApprovalVersionAndDocument(
  tx: Prisma.TransactionClient,
  packId: string,
  snapshot: DoclingBundleReviewSubmitSnapshot,
) {
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
  return { latestVersion, activeNd };
}

/** Pure: required binding fields present, and chunk/index/search generation ids agree. */
function assertApprovalSnapshotBindingFieldsPresent(
  snapshot: DoclingBundleReviewSubmitSnapshot,
): void {
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
  if (
    snapshot.chunkGenerationId !== snapshot.indexGenerationId ||
    snapshot.chunkGenerationId !== snapshot.searchIndexGenerationId ||
    snapshot.searchIndexGenerationId !== snapshot.indexGenerationId
  ) {
    mismatch();
  }
}

/** Pure: every preparation channel entry must be complete (V3 approval requirement). */
function assertApprovalPreparationChannelsComplete(
  snapshot: DoclingBundleReviewSubmitSnapshot,
): void {
  const prep = snapshot.preparationValidation;
  if (!prep) {
    mismatch("APPROVAL_SNAPSHOT_MISMATCH");
  }
  for (const channel of PREPARATION_CHANNELS) {
    try {
      assertCompletePreparationValidationSnapshotEntry(channel, prep[channel]);
    } catch (error) {
      if (error instanceof PayloadServiceError) {
        mismatch("APPROVAL_SNAPSHOT_MISMATCH");
      }
      throw error;
    }
  }
}

/** DB + pure: the PASS pipeline run whose binding matches the snapshot/version/document. */
async function loadApprovalPassRun(
  tx: Prisma.TransactionClient,
  snapshot: DoclingBundleReviewSubmitSnapshot,
  latestVersion: { id: string },
  activeNd: { id: string; fingerprint: string | null },
) {
  const passRun = await tx.pipelineRun.findUnique({
    where: { id: snapshot.pipelineRunId! },
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
  return { passRun, binding };
}

/** DB + pure: the READY SearchIndexGeneration bound to the pass run/version/document. */
async function loadApprovalSearchGeneration(
  tx: Prisma.TransactionClient,
  input: {
    packId: string;
    snapshot: DoclingBundleReviewSubmitSnapshot;
    latestVersion: { id: string };
    activeNd: { id: string; fingerprint: string | null };
    passRun: { id: string };
    binding: { indexGenerationId: string };
  },
) {
  const { packId, snapshot, latestVersion, activeNd, passRun, binding } = input;
  const generation = await tx.searchIndexGeneration.findUnique({
    where: { id: snapshot.searchIndexGenerationId! },
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
    generation.failedCount !== 0 ||
    generation.generationFingerprint !== snapshot.searchGenerationFingerprint
  ) {
    mismatch("SEARCH_GENERATION_NOT_CURRENT");
  }
  return generation;
}

/** Pure: the generation's and snapshot's embedding descriptors must be operational + equal. */
function assertApprovalEmbeddingDescriptorsMatch(
  generation: SearchIndexGeneration,
  snapshot: DoclingBundleReviewSubmitSnapshot,
): void {
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
}

/**
 * Re-read PackReview.submitSnapshot from DB and verify all approval evidence inside `tx`.
 * Do NOT pass an external snapshot — the DB row is the authority.
 * `expectedSnapshotFingerprint` must match the fingerprint of the snapshot used for
 * external Object Storage integrity verification.
 */
export async function assertApprovalSearchGenerationInTx(
  tx: Prisma.TransactionClient,
  input: {
    packId: string;
    reviewId: string;
    expectedSnapshotFingerprint: string;
  },
): Promise<ApprovalSearchGenerationContext> {
  const { packId, reviewId, expectedSnapshotFingerprint } = input;
  if (!expectedSnapshotFingerprint?.trim()) {
    mismatch("APPROVAL_SNAPSHOT_MISMATCH");
  }

  const review = await loadApprovalPackAndReview(tx, packId, reviewId);
  const { snapshot, snapshotFingerprint } = parseApprovalSnapshot(
    review.submitSnapshot,
    expectedSnapshotFingerprint,
  );

  const { latestVersion, activeNd } = await loadApprovalVersionAndDocument(tx, packId, snapshot);
  assertApprovalSnapshotBindingFieldsPresent(snapshot);
  assertApprovalPreparationChannelsComplete(snapshot);

  const { passRun, binding } = await loadApprovalPassRun(tx, snapshot, latestVersion, activeNd);
  const generation = await loadApprovalSearchGeneration(tx, {
    packId,
    snapshot,
    latestVersion,
    activeNd,
    passRun,
    binding,
  });
  assertApprovalEmbeddingDescriptorsMatch(generation, snapshot);

  return {
    snapshot,
    snapshotFingerprint,
    packageMode: "DOCLING_BUNDLE",
    generation,
    versionId: latestVersion.id,
    normalizedDocumentId: activeNd.id,
    pipelineRunId: passRun.id,
    fingerprint: activeNd.fingerprint!,
    reviewId: review.id,
  };
}
