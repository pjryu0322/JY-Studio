import { PackStatus } from "@prisma/client";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";
import {
  parseKnowledgeRunBinding,
  type KnowledgeRunBinding,
} from "@/lib/docling-knowledge/docling-knowledge-run-binding";
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
import {
  EVIDENCE_DRIFT_MESSAGE,
  ReviewSubmitEvidenceError,
  type PrismaLike,
} from "@/lib/distribution/review-submit-evidence-policy";

export async function loadOwnedDraftPackForSubmitEvidence(
  client: PrismaLike,
  input: { packId: string; providerProfileId: string },
): Promise<void> {
  const pack = await client.knowledgePack.findFirst({
    where: { packId: input.packId, providerProfileId: input.providerProfileId },
    select: { status: true },
  });
  if (!pack) {
    throw new ReviewSubmitEvidenceError("NOT_FOUND", "지식팩을 찾을 수 없습니다.");
  }
  if (pack.status !== PackStatus.DRAFT) {
    throw new ReviewSubmitEvidenceError("NOT_DRAFT", "초안 상태에서만 검수요청할 수 있습니다.");
  }
}

export type ReviewSubmitMaterialLoad = {
  bundle: {
    id: string;
    status: string;
    isActive: boolean;
    deletedAt: Date | null;
    storageStatus: string;
    packId: string;
    versionId: string;
    files: Array<{ id: string; role: string; checksumSha256: string | null }>;
  };
  nd: {
    id: string;
    packId: string;
    versionId: string;
    bundleId: string;
    isActive: boolean;
    sourceFileId: string | null;
    jsonPayloadFileId: string | null;
    fingerprint: string;
  };
  sourceFile: { id: string; role: string; checksumSha256: string | null } | null;
};

export async function loadActiveBundleMaterialsForSubmitEvidence(
  client: PrismaLike,
  input: { versionId: string; snapshot: DoclingBundleReviewSubmitSnapshot },
): Promise<ReviewSubmitMaterialLoad> {
  const bundle = await client.doclingImportBundle.findFirst({
    where: { versionId: input.versionId, isActive: true, deletedAt: null },
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
  const fingerprint = nd.fingerprint?.trim() ?? "";
  if (!fingerprint) {
    throw new ReviewSubmitEvidenceError(
      "SOURCE_MATERIALS_NOT_READY",
      "원본문서·구조화 자료가 REVIEW_READY 상태로 준비되어야 검수요청할 수 있습니다.",
    );
  }
  if (
    bundle.id !== input.snapshot.doclingBundleId ||
    nd.id !== input.snapshot.normalizedDocumentId ||
    (input.snapshot.fingerprint != null && fingerprint !== input.snapshot.fingerprint)
  ) {
    throw new ReviewSubmitEvidenceError("MATERIALS_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  const sourceFile = bundle.files.find((f) => f.role === "SOURCE_ORIGINAL") ?? null;
  return {
    bundle,
    nd: {
      id: nd.id,
      packId: nd.packId,
      versionId: nd.versionId,
      bundleId: nd.bundleId,
      isActive: nd.isActive,
      sourceFileId: nd.sourceFileId,
      jsonPayloadFileId: nd.jsonPayloadFileId,
      fingerprint,
    },
    sourceFile,
  };
}

export type ReviewSubmitPipelineLoad = {
  passRun: { id: string; steps: Array<{ step: string; status: string; details: unknown }> };
  binding: KnowledgeRunBinding;
  steps: PipelineStepLike[];
};

export async function loadPassPipelineForSubmitEvidence(
  client: PrismaLike,
  input: {
    packId: string;
    versionId: string;
    nd: { id: string; fingerprint: string };
    bundleId: string;
    snapshot: DoclingBundleReviewSubmitSnapshot;
  },
): Promise<ReviewSubmitPipelineLoad> {
  const passRun = await client.pipelineRun.findFirst({
    where: {
      packId: input.packId,
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      status: "PASS",
    },
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
    binding.versionId === input.versionId &&
    binding.normalizedDocumentId === input.nd.id &&
    binding.fingerprint === input.nd.fingerprint &&
    binding.bundleId === input.bundleId;
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
    passRun.id !== input.snapshot.pipelineRunId ||
    (input.snapshot.indexGenerationId != null &&
      binding.indexGenerationId !== input.snapshot.indexGenerationId)
  ) {
    throw new ReviewSubmitEvidenceError("PIPELINE_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  return { passRun, binding, steps };
}

export async function loadSearchGenerationForSubmitEvidence(
  client: PrismaLike,
  input: {
    packId: string;
    versionId: string;
    nd: { id: string; fingerprint: string };
    passRunId: string;
    binding: KnowledgeRunBinding;
    snapshot: DoclingBundleReviewSubmitSnapshot;
  },
) {
  const generationId =
    input.snapshot.searchIndexGenerationId ??
    input.snapshot.indexGenerationId ??
    input.binding.indexGenerationId;
  if (!generationId) {
    throw new ReviewSubmitEvidenceError("SEARCH_GENERATION_REQUIRED", EVIDENCE_DRIFT_MESSAGE);
  }
  const generation = await client.searchIndexGeneration.findUnique({
    where: { id: generationId },
  });
  if (
    !generation ||
    generation.id !== generationId ||
    generation.id !== input.binding.indexGenerationId ||
    generation.packId !== input.packId ||
    generation.versionId !== input.versionId ||
    generation.pipelineRunId !== input.passRunId ||
    generation.normalizedDocumentId !== input.nd.id ||
    generation.fingerprint !== input.nd.fingerprint ||
    generation.chunkGenerationId !== input.binding.indexGenerationId ||
    (input.snapshot.searchGenerationFingerprint != null &&
      generation.generationFingerprint !== input.snapshot.searchGenerationFingerprint) ||
    generation.status !== "READY" ||
    generation.scope !== "DRAFT" ||
    generation.chunkCount <= 0 ||
    generation.embeddedCount !== generation.chunkCount ||
    generation.failedCount !== 0
  ) {
    throw new ReviewSubmitEvidenceError("SEARCH_GENERATION_NOT_CURRENT", EVIDENCE_DRIFT_MESSAGE);
  }

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
    embeddingProvider: input.snapshot.embeddingProvider,
    embeddingModel: input.snapshot.embeddingModel,
    embeddingModelRevision: input.snapshot.embeddingModelRevision,
    embeddingDimension: input.snapshot.embeddingDimension,
    distanceMetric: input.snapshot.distanceMetric,
  };
  if (!embeddingDescriptorsEqual(snapshotDescriptor, generationDescriptor)) {
    throw new ReviewSubmitEvidenceError("SEARCH_GENERATION_DESCRIPTOR_DRIFT", EVIDENCE_DRIFT_MESSAGE);
  }
  return generation;
}
