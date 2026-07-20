import { PackStatus, type Prisma } from "@prisma/client";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import { parseKnowledgeRunBinding } from "@/lib/docling-knowledge/docling-knowledge-run-binding";
import {
  isSearchFoundationStagesPassedStrict,
  isStructureStagesPassed,
  type PipelineStepLike,
} from "@/lib/docling-knowledge/docling-knowledge-stage-pass";
import { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } from "@/lib/docling-knowledge/docling-knowledge-stages";
import {
  isDoclingSourceMaterialsReady,
  type DoclingBundleMaterialContext,
} from "@/lib/docling-import/docling-source-materials-readiness";
import type { ServiceChannel } from "@/lib/distribution/service-channel-policy";

/** Any Prisma client (root or interactive transaction). */
export type PrismaLike = Prisma.TransactionClient;

export class ReviewSubmitEvidenceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ReviewSubmitEvidenceError";
  }
}

const PREPARATION_CHANNELS: ServiceChannel[] = ["API", "MCP", "DOWNLOAD"];

const EVIDENCE_DRIFT_MESSAGE =
  "검수요청 증적이 현재 지식 데이터와 일치하지 않습니다. 다시 검증한 뒤 검수요청해 주세요.";

const RAG_EXPORT_DOWNLOAD_EVIDENCE_MESSAGE =
  "RAG Export 다운로드 테스트 증적이 검증 결과와 일치하지 않습니다. 다시 검증·다운로드해 주세요.";

/**
 * Fail-closed RAG Export download evidence: only a non-empty `exportFingerprint`
 * may bind downloadTest.fileId. Never fall back to details.fileId or SOURCE_ORIGINAL.
 */
export function assertRagExportDownloadEvidenceBinding(input: {
  runDetails: Record<string, unknown> | null;
  downloadTestFileId: string;
}): void {
  if (input.runDetails?.downloadMode !== "RAG_EXPORT") {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", RAG_EXPORT_DOWNLOAD_EVIDENCE_MESSAGE);
  }
  const exportFingerprint = input.runDetails.exportFingerprint;
  if (typeof exportFingerprint !== "string" || exportFingerprint.trim().length < 1) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", RAG_EXPORT_DOWNLOAD_EVIDENCE_MESSAGE);
  }
  if (input.downloadTestFileId !== exportFingerprint) {
    throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", RAG_EXPORT_DOWNLOAD_EVIDENCE_MESSAGE);
  }
}

/**
 * Re-validate the full review-submit binding inside the commit transaction (§7-§10).
 *
 * Re-reads pack ownership, active bundle/ND, pipeline run binding, and the three
 * preparation-channel validation runs, then compares each against the snapshot that
 * was built before the transaction. Throws {@link ReviewSubmitEvidenceError} on any drift.
 */
export async function assertReviewSubmitEvidenceInTx(
  client: PrismaLike,
  input: {
    packId: string;
    versionId: string;
    providerProfileId: string;
    snapshot: DoclingBundleReviewSubmitSnapshot;
  },
): Promise<void> {
  const { packId, versionId, snapshot } = input;

  const pack = await client.knowledgePack.findFirst({
    where: { packId, providerProfileId: input.providerProfileId },
    select: { status: true },
  });
  if (!pack) {
    throw new ReviewSubmitEvidenceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.");
  }
  if (pack.status !== PackStatus.DRAFT) {
    throw new ReviewSubmitEvidenceError("NOT_DRAFT", "초안 상태에서만 검수요청할 수 있습니다.");
  }

  // §8 source materials — same condition as isDoclingSourceMaterialsReady.
  const bundle = await client.doclingImportBundle.findFirst({
    where: { versionId, isActive: true, deletedAt: null },
    include: {
      files: { select: { id: true, role: true, checksumSha256: true } },
      normalizedDocuments: { where: { isActive: true }, take: 1 },
    },
  });
  const nd = bundle?.normalizedDocuments[0] ?? null;
  const materialCtx: DoclingBundleMaterialContext | null = bundle
    ? {
        id: bundle.id,
        status: bundle.status,
        isActive: bundle.isActive,
        deletedAt: bundle.deletedAt,
        storageStatus: bundle.storageStatus,
        packId: bundle.packId,
        versionId: bundle.versionId,
        files: bundle.files,
        normalizedDocument: nd
          ? {
              id: nd.id,
              packId: nd.packId,
              versionId: nd.versionId,
              bundleId: nd.bundleId,
              isActive: nd.isActive,
              sourceFileId: nd.sourceFileId,
              jsonPayloadFileId: nd.jsonPayloadFileId,
              fingerprint: nd.fingerprint,
            }
          : null,
      }
    : null;
  if (!bundle || !nd || !isDoclingSourceMaterialsReady(materialCtx)) {
    throw new ReviewSubmitEvidenceError(
      "SOURCE_MATERIALS_NOT_READY",
      "원본문서·구조화 자료가 REVIEW_READY 상태로 준비되어야 검수요청할 수 있습니다.",
    );
  }
  if (
    bundle.id !== snapshot.doclingBundleId ||
    nd.id !== snapshot.normalizedDocumentId ||
    (snapshot.fingerprint != null && nd.fingerprint !== snapshot.fingerprint)
  ) {
    throw new ReviewSubmitEvidenceError("MATERIALS_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  const sourceFile = bundle.files.find((f) => f.role === "SOURCE_ORIGINAL") ?? null;

  // §9 pipeline PASS binding.
  const passRun = await client.pipelineRun.findFirst({
    where: { packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER, status: "PASS" },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
  const binding = parseKnowledgeRunBinding(passRun?.summary ?? null);
  if (!passRun || !binding) {
    throw new ReviewSubmitEvidenceError("PIPELINE_NOT_CURRENT", EVIDENCE_DRIFT_MESSAGE);
  }
  const steps: PipelineStepLike[] = passRun.steps.map((s) => ({
    step: s.step,
    status: s.status,
    details:
      s.details && typeof s.details === "object" && !Array.isArray(s.details)
        ? (s.details as Record<string, unknown>)
        : null,
  }));
  const pipelineCurrent =
    binding.versionId === versionId &&
    binding.normalizedDocumentId === nd.id &&
    binding.fingerprint === nd.fingerprint &&
    binding.bundleId === bundle.id;
  const passInput = { steps, pipelineCurrent };
  const readyStep = steps.find((s) => s.step === "READY_FOR_REVIEW");
  if (
    !pipelineCurrent ||
    !isStructureStagesPassed(passInput) ||
    !isSearchFoundationStagesPassedStrict(passInput) ||
    readyStep?.status !== "PASS"
  ) {
    throw new ReviewSubmitEvidenceError("PIPELINE_NOT_CURRENT", EVIDENCE_DRIFT_MESSAGE);
  }
  if (
    passRun.id !== snapshot.pipelineRunId ||
    (snapshot.indexGenerationId != null &&
      binding.indexGenerationId !== snapshot.indexGenerationId)
  ) {
    throw new ReviewSubmitEvidenceError("PIPELINE_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }

  // P4.1: re-validate SearchIndexGeneration inside the transaction.
  const generationId =
    snapshot.searchIndexGenerationId ?? snapshot.indexGenerationId ?? binding.indexGenerationId;
  if (!generationId) {
    throw new ReviewSubmitEvidenceError("SEARCH_GENERATION_REQUIRED", EVIDENCE_DRIFT_MESSAGE);
  }
  const generation = await client.searchIndexGeneration.findUnique({
    where: { id: generationId },
  });
  if (
    !generation ||
    generation.id !== generationId ||
    generation.id !== binding.indexGenerationId ||
    generation.packId !== packId ||
    generation.versionId !== versionId ||
    generation.pipelineRunId !== passRun.id ||
    generation.normalizedDocumentId !== nd.id ||
    generation.fingerprint !== nd.fingerprint ||
    generation.chunkGenerationId !== binding.indexGenerationId ||
    (snapshot.searchGenerationFingerprint != null &&
      generation.generationFingerprint !== snapshot.searchGenerationFingerprint) ||
    generation.status !== "READY" ||
    generation.scope !== "DRAFT" ||
    generation.chunkCount <= 0 ||
    generation.embeddedCount !== generation.chunkCount ||
    generation.failedCount !== 0
  ) {
    throw new ReviewSubmitEvidenceError("SEARCH_GENERATION_NOT_CURRENT", EVIDENCE_DRIFT_MESSAGE);
  }

  // P5.1: fingerprint alone is not enough — compare embedding descriptor fields directly.
  const { embeddingDescriptorsEqual, validateOperationalEmbeddingDescriptor } = await import(
    "@/lib/search-generation/search-generation-descriptor"
  );
  const generationDescriptor = {
    embeddingProvider: generation.embeddingProvider,
    embeddingModel: generation.embeddingModel,
    embeddingModelRevision: generation.embeddingModelRevision,
    embeddingDimension: generation.embeddingDimension,
    distanceMetric: generation.distanceMetric,
  };
  const descriptorCheck = validateOperationalEmbeddingDescriptor(generationDescriptor);
  if (!descriptorCheck.ok) {
    throw new ReviewSubmitEvidenceError(descriptorCheck.code, EVIDENCE_DRIFT_MESSAGE);
  }
  const snapshotDescriptor = {
    embeddingProvider: snapshot.embeddingProvider,
    embeddingModel: snapshot.embeddingModel,
    embeddingModelRevision: snapshot.embeddingModelRevision,
    embeddingDimension: snapshot.embeddingDimension,
    distanceMetric: snapshot.distanceMetric,
  };
  if (!embeddingDescriptorsEqual(snapshotDescriptor, generationDescriptor)) {
    throw new ReviewSubmitEvidenceError("SEARCH_GENERATION_DESCRIPTOR_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }

  // §10 preparation-channel evidence — compare each snapshot entry against the current run.
  const prep = snapshot.preparationValidation ?? null;
  if (!prep) {
    throw new ReviewSubmitEvidenceError("PREPARATION_MISSING", EVIDENCE_DRIFT_MESSAGE);
  }

  for (const channel of PREPARATION_CHANNELS) {
    const snap = prep[channel];
    if (!snap?.runId) {
      throw new ReviewSubmitEvidenceError("PREPARATION_MISSING", EVIDENCE_DRIFT_MESSAGE);
    }
    const run = await client.serviceValidationRun.findFirst({
      where: { versionId, channel },
      orderBy: { createdAt: "desc" },
    });
    if (
      !run ||
      run.id !== snap.runId ||
      run.packId !== packId ||
      run.status !== "PASS" ||
      run.invalidatedAt != null ||
      run.pipelineRunId !== passRun.id ||
      run.normalizedDocumentId !== nd.id ||
      run.fingerprint !== nd.fingerprint ||
      run.indexGenerationId !== binding.indexGenerationId ||
      run.searchIndexGenerationId !== generation.id
    ) {
      throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
    }
    if (
      (snap.pipelineRunId != null && snap.pipelineRunId !== run.pipelineRunId) ||
      (snap.normalizedDocumentId != null && snap.normalizedDocumentId !== run.normalizedDocumentId) ||
      (snap.indexGenerationId != null && snap.indexGenerationId !== run.indexGenerationId) ||
      (snap.fingerprint != null && snap.fingerprint !== run.fingerprint) ||
      (snap.testedAt != null &&
        run.testedAt != null &&
        run.testedAt.toISOString() !== snap.testedAt)
    ) {
      throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
    }

    if (channel === "API" || channel === "MCP") {
      const itemCount = await client.serviceValidationResultItem.count({
        where: { runId: run.id },
      });
      if (itemCount < 1) {
        throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
      }
      const snapResultFingerprint = (snap as { resultFingerprint?: string | null })
        .resultFingerprint;
      if (snapResultFingerprint != null && run.resultFingerprint !== snapResultFingerprint) {
        throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
      }
    }

    if (channel === "DOWNLOAD") {
      const downloadTest = await client.serviceValidationDownloadTest.findUnique({
        where: { runId: run.id },
      });
      if (!downloadTest?.responseReady) {
        throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
      }
      const snapDownloadTestId = (snap as { downloadTestId?: string | null }).downloadTestId;
      if (snapDownloadTestId != null && downloadTest.id !== snapDownloadTestId) {
        throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
      }
      const runDetails =
        run.details && typeof run.details === "object" && !Array.isArray(run.details)
          ? (run.details as Record<string, unknown>)
          : null;
      // RAG Export: downloadTest.fileId must equal exportFingerprint only (no fileId fallback).
      if (runDetails?.downloadMode === "RAG_EXPORT") {
        assertRagExportDownloadEvidenceBinding({
          runDetails,
          downloadTestFileId: downloadTest.fileId,
        });
      } else if (sourceFile && downloadTest.fileId !== sourceFile.id) {
        throw new ReviewSubmitEvidenceError("VALIDATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
      }
    }

    const confirmation = await client.serviceValidationProviderConfirmation.findUnique({
      where: { runId: run.id },
    });
    if (!confirmation || confirmation.status !== "CONFIRMED") {
      throw new ReviewSubmitEvidenceError("CONFIRMATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
    }
    if (snap.providerConfirmationId != null && confirmation.id !== snap.providerConfirmationId) {
      throw new ReviewSubmitEvidenceError("CONFIRMATION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
    }
  }

  // §14 distribution channels must still match the snapshot selection.
  const dist = await client.packDistributionMetadata.findUnique({ where: { versionId } });
  if (!dist) {
    throw new ReviewSubmitEvidenceError("DISTRIBUTION_MISSING", "유통정보가 없습니다.");
  }
  const channels = snapshot.distributionChannels;
  if (
    channels &&
    (channels.allowApi !== dist.allowApi ||
      channels.allowMcp !== dist.allowMcp ||
      channels.allowDownload !== dist.allowDownload)
  ) {
    throw new ReviewSubmitEvidenceError("DISTRIBUTION_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  if (!dist.allowApi && !dist.allowMcp && !dist.allowDownload) {
    throw new ReviewSubmitEvidenceError(
      "SERVICE_CHANNEL_REQUIRED",
      "제공 방식을 한 개 이상 선택해 주세요.",
    );
  }
}
