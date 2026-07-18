/**
 * P5.1.1: Re-validate SearchIndexGeneration binding + embedding descriptor
 * inside the admin approval transaction. Outside-tx checks are UX-only;
 * final approval is decided solely by this in-tx result.
 */

import type { Prisma, SearchIndexGeneration } from "@prisma/client";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import { PayloadServiceError, type PayloadErrorCode } from "@/lib/distribution/payload-errors";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import {
  embeddingDescriptorsEqual,
  validateOperationalEmbeddingDescriptor,
} from "@/lib/search-generation/search-generation-descriptor";

export type ApprovalSearchGenerationContext = {
  generation: SearchIndexGeneration;
  versionId: string;
  normalizedDocumentId: string;
  pipelineRunId: string;
  fingerprint: string;
};

const APPROVAL_MISMATCH =
  "제출 이후 지식 데이터 또는 검색 인덱스가 변경되었습니다. 제공자에게 다시 검수요청하도록 안내해 주세요.";

function mismatch(code: PayloadErrorCode = "SEARCH_GENERATION_MISMATCH"): never {
  throw new PayloadServiceError(code, APPROVAL_MISMATCH, 409);
}

/**
 * Re-read and verify all approval evidence for a Docling-bundle pack inside `tx`.
 * Returns the verified Generation that alone may be promoted.
 */
export async function assertApprovalSearchGenerationInTx(
  tx: Prisma.TransactionClient,
  input: {
    packId: string;
    reviewId: string;
    snapshot: DoclingBundleReviewSubmitSnapshot;
  },
): Promise<ApprovalSearchGenerationContext> {
  const { packId, reviewId, snapshot } = input;

  const pack = await tx.knowledgePack.findUnique({
    where: { packId },
    select: { packId: true, status: true },
  });
  if (!pack || pack.status !== "REVIEWING") {
    mismatch("SEARCH_GENERATION_NOT_CURRENT");
  }

  const review = await tx.packReview.findUnique({
    where: { id: reviewId },
    select: { id: true, packId: true, status: true },
  });
  if (!review || review.packId !== packId || review.status !== "IN_REVIEW") {
    mismatch("SEARCH_GENERATION_NOT_CURRENT");
  }

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
    (snapshot.snapshotSchemaVersion ?? 1) < 3
  ) {
    mismatch("SEARCH_GENERATION_REQUIRED");
  }

  // Generation ID binding: all four identities must agree.
  if (
    snapshot.searchIndexGenerationId !== snapshot.indexGenerationId ||
    !snapshot.searchIndexGenerationId
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
    generation.chunkGenerationId !== snapshot.indexGenerationId ||
    generation.status !== "READY" ||
    generation.scope !== "DRAFT" ||
    generation.chunkCount <= 0 ||
    generation.embeddedCount !== generation.chunkCount ||
    generation.failedCount !== 0
  ) {
    mismatch("SEARCH_GENERATION_NOT_CURRENT");
  }

  if (
    snapshot.searchGenerationFingerprint != null &&
    generation.generationFingerprint !== snapshot.searchGenerationFingerprint
  ) {
    mismatch("SEARCH_GENERATION_NOT_CURRENT");
  }

  // Descriptor: operational fitness then Snapshot ↔ Generation equality.
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

  // Validation runs: re-read each channel by Snapshot runId (not merely "latest PASS").
  const prep = snapshot.preparationValidation;
  if (!prep) {
    mismatch("SEARCH_GENERATION_REQUIRED");
  }
  for (const channel of ["API", "MCP", "DOWNLOAD"] as const) {
    const snap = prep[channel];
    if (!snap?.runId) {
      mismatch("SEARCH_GENERATION_REQUIRED");
    }
    const run = await tx.serviceValidationRun.findUnique({
      where: { id: snap.runId },
      select: {
        id: true,
        packId: true,
        versionId: true,
        channel: true,
        status: true,
        invalidatedAt: true,
        pipelineRunId: true,
        normalizedDocumentId: true,
        searchIndexGenerationId: true,
        indexGenerationId: true,
      },
    });
    if (
      !run ||
      run.id !== snap.runId ||
      run.packId !== packId ||
      run.versionId !== latestVersion.id ||
      run.channel !== channel ||
      run.status !== "PASS" ||
      run.invalidatedAt != null ||
      run.pipelineRunId !== passRun.id ||
      run.normalizedDocumentId !== activeNd.id ||
      run.searchIndexGenerationId !== generation.id ||
      run.indexGenerationId !== generation.id
    ) {
      mismatch("SEARCH_GENERATION_NOT_CURRENT");
    }
  }

  return {
    generation,
    versionId: latestVersion.id,
    normalizedDocumentId: activeNd.id,
    pipelineRunId: passRun.id,
    fingerprint: activeNd.fingerprint,
  };
}
