import {
  AuditAction,
  DoclingImportBundleStatus,
  KnowledgePackFileRole,
  PackStatus,
  type Prisma,
} from "@prisma/client";
import {
  acquireVersionUploadLock,
  findLatestStagingBundleForVersion,
} from "@/lib/docling-import/docling-import-lifecycle-service";
import {
  buildDoclingBundleReviewSubmitSnapshot,
  type ReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { toPackLanguageCode } from "@/lib/pack-language";
import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import { recordProviderAudit } from "@/lib/provider-audit";
import { prisma } from "@/lib/prisma";

export type {
  DistributionReviewSubmitSnapshot,
  DoclingBundleReviewSubmitSnapshot,
  ReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";
export {
  buildDistributionReviewSubmitSnapshot,
  buildDoclingBundleReviewSubmitSnapshot,
  parseDistributionReviewSubmitSnapshot,
  parseDoclingBundleReviewSubmitSnapshot,
  parseReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";

export type DistributionSubmitCommitResult =
  | { error: "PROFILE_REQUIRED" }
  | { error: "NOT_FOUND" }
  | { error: "NOT_DRAFT" }
  | { error: "INCOMPLETE"; message: string; missingRequirements?: string[] }
  | { ok: true; snapshot: ReviewSubmitSnapshot };

/**
 * Validate and commit a Docling distribution pack into REVIEWING + PackReview PENDING.
 */
export async function commitDistributionPackForReview(
  userId: string,
  clientId: string,
  packId: string,
): Promise<DistributionSubmitCommitResult> {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);
  if (!profile) {
    return { error: "PROFILE_REQUIRED" };
  }

  const pack = await prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId: profile.id },
    include: {
      versions: {
        orderBy: latestKnowledgePackVersionOrderBy,
        take: 1,
        include: {
          distributionMetadata: true,
        },
      },
    },
  });

  if (!pack) {
    return { error: "NOT_FOUND" };
  }
  if (pack.status !== PackStatus.DRAFT) {
    return { error: "NOT_DRAFT" };
  }
  if (!pack.categoryId || !pack.shortDescription.trim() || !pack.description.trim()) {
    return { error: "INCOMPLETE", message: "카테고리와 설명을 확인해 주세요." };
  }

  const version = pack.versions[0];
  if (!version) {
    return { error: "INCOMPLETE", message: "버전이 최소 1개 필요합니다." };
  }

  const packLanguage = toPackLanguageCode(version.language);
  if (!packLanguage) {
    return {
      error: "INCOMPLETE",
      message: "문서 언어를 선택해 주세요.",
    };
  }

  const liveStaging = await findLatestStagingBundleForVersion(version.id);
  if (liveStaging) {
    return {
      error: "INCOMPLETE",
      message:
        "실패하거나 처리 중인 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 검수 요청하세요.",
    };
  }

  const meta = version.distributionMetadata;

  const doclingBundle = await prisma.doclingImportBundle.findFirst({
    where: { versionId: version.id, isActive: true },
    include: {
      files: true,
      normalizedDocuments: { where: { isActive: true }, take: 1 },
    },
  });

  // Re-check live staging before Docling submit path.
  const stagingAfterLock = await findLatestStagingBundleForVersion(version.id);
  if (stagingAfterLock) {
    return {
      error: "INCOMPLETE",
      message:
        "실패하거나 처리 중인 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 검수 요청하세요.",
    };
  }

  if (!doclingBundle || doclingBundle.status !== DoclingImportBundleStatus.REVIEW_READY) {
    return {
      error: "INCOMPLETE",
      message:
        "원본문서와 구조화 JSON이 정상 처리되어 REVIEW_READY 상태여야 검수 요청할 수 있습니다.",
      missingRequirements: ["DOCLING_REVIEW_READY"],
    };
  }

  const { isDoclingKnowledgePipelinePassed, missingRequirementsForReview } = await import(
    "@/lib/docling-knowledge/docling-knowledge-pipeline-service"
  );
  const knowledgePassed = await isDoclingKnowledgePipelinePassed(packId);
  const { isDistributionReadyForServiceValidation } = await import(
    "@/lib/distribution/service-channel-policy"
  );
  const distributionReady = Boolean(
    meta &&
      isDistributionReadyForServiceValidation({
        sourceTitle: meta.sourceTitle,
        sourceUrl: meta.sourceUrl,
        rightsBasis: meta.rightsBasis,
        rightsConfirmedAt: meta.rightsConfirmedAt,
        allowApi: meta.allowApi,
        allowMcp: meta.allowMcp,
        allowDownload: meta.allowDownload,
      }),
  );
  if (!knowledgePassed || !distributionReady) {
    return {
      error: "INCOMPLETE",
      message: !knowledgePassed
        ? "지식 데이터 생성(검색 결과 검증)이 완료되어야 검수 요청할 수 있습니다."
        : "유통정보(출처·제공 방식·유통 권한)를 입력해 주세요.",
      missingRequirements: missingRequirementsForReview({
        materialReady: true,
        knowledgePassed,
        distributionReady,
      }),
    };
  }

  const byRole = new Map(doclingBundle.files.map((f) => [f.role, f]));
  const sourceFile = byRole.get(KnowledgePackFileRole.SOURCE_ORIGINAL);
  const jsonFile = byRole.get(KnowledgePackFileRole.DOCLING_JSON);
  const mdFile = byRole.get(KnowledgePackFileRole.DOCLING_MARKDOWN) ?? null;
  const nd = doclingBundle.normalizedDocuments[0];

  if (!sourceFile || !jsonFile || !nd) {
    return {
      error: "INCOMPLETE",
      message:
        "원본문서와 구조화 JSON이 정상 처리되어 REVIEW_READY 상태여야 검수 요청할 수 있습니다.",
    };
  }

  // §8 Common source-materials readiness (same condition as list/editor readiness).
  const { isDoclingSourceMaterialsReady } = await import(
    "@/lib/docling-import/docling-source-materials-readiness"
  );
  const sourceMaterialsReady = isDoclingSourceMaterialsReady({
    id: doclingBundle.id,
    status: doclingBundle.status,
    isActive: doclingBundle.isActive,
    deletedAt: doclingBundle.deletedAt,
    storageStatus: doclingBundle.storageStatus,
    packId: doclingBundle.packId,
    versionId: doclingBundle.versionId,
    files: doclingBundle.files.map((f) => ({
      id: f.id,
      role: f.role,
      checksumSha256: f.checksumSha256,
    })),
    normalizedDocument: {
      id: nd.id,
      packId: nd.packId,
      versionId: nd.versionId,
      bundleId: nd.bundleId,
      isActive: nd.isActive,
      sourceFileId: nd.sourceFileId,
      jsonPayloadFileId: nd.jsonPayloadFileId,
      fingerprint: nd.fingerprint,
    },
  });
  if (!sourceMaterialsReady) {
    return {
      error: "INCOMPLETE",
      message:
        "원본문서와 구조화 JSON이 정상 처리되어 REVIEW_READY 상태여야 검수 요청할 수 있습니다.",
      missingRequirements: ["SOURCE_MATERIALS_NOT_READY"],
    };
  }

  if (!meta) {
    return {
      error: "INCOMPLETE",
      message: "유통정보(출처·제공 방식·유통 권한)를 입력해 주세요.",
    };
  }
  if (!meta.sourceTitle?.trim() && !meta.sourceUrl?.trim()) {
    return {
      error: "INCOMPLETE",
      message: "출처 제목 또는 출처 URL이 필요합니다.",
    };
  }
  if (!meta.rightsBasis || !meta.rightsConfirmedAt) {
    return {
      error: "INCOMPLETE",
      message: "유통 권한 근거와 확인이 필요합니다.",
    };
  }
  if (!meta.licenseName.trim()) {
    return { error: "INCOMPLETE", message: "라이선스명이 필요합니다." };
  }

  const { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } = await import(
    "@/lib/docling-knowledge/docling-knowledge-stages"
  );
  const { parseKnowledgeRunBinding } = await import(
    "@/lib/docling-knowledge/docling-knowledge-run-binding"
  );
  const passRun = await prisma.pipelineRun.findFirst({
    where: {
      packId,
      triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER,
      status: "PASS",
    },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
  const passBinding = parseKnowledgeRunBinding(passRun?.summary ?? null);
  const evalStep = passRun?.steps.find((s) => s.step === "SEARCH_EVALUATING");
  if (
    !passRun ||
    !passBinding ||
    passBinding.normalizedDocumentId !== nd.id ||
    passBinding.fingerprint !== nd.fingerprint ||
    passBinding.versionId !== version.id ||
    evalStep?.status !== "PASS"
  ) {
    return {
      error: "INCOMPLETE",
      message:
        "지식 데이터 생성(검색 결과 검증)이 현재 정규화 결과와 일치하지 않습니다. 다시 생성해 주세요.",
      missingRequirements: ["RETRIEVAL_EVALUATION_PASSED"],
    };
  }

  let preparationValidation: Awaited<
    ReturnType<
      typeof import("@/lib/distribution/service-validation-service").assertPreparationServiceValidationsPassed
    >
  >;
  try {
    const { assertPreparationServiceValidationsPassed } = await import(
      "@/lib/distribution/service-validation-service"
    );
    const { assertDistributionChannelsSelected } = await import(
      "@/lib/distribution/service-channel-policy"
    );
    assertDistributionChannelsSelected(meta);
    preparationValidation = await assertPreparationServiceValidationsPassed({
      packId,
      versionId: version.id,
      bindingFingerprint: nd.fingerprint,
      bindingIndexGenerationId: passBinding.indexGenerationId,
      pipelineRunId: passRun.id,
      normalizedDocumentId: nd.id,
    });
  } catch (error) {
    const { isPayloadServiceError } = await import("@/lib/distribution/payload-errors");
    if (isPayloadServiceError(error)) {
      return {
        error: "INCOMPLETE",
        message: error.message,
        missingRequirements: [error.code],
      };
    }
    throw error;
  }

  // P4.1: READY SearchIndexGeneration is required for Snapshot V3 submit.
  const searchGenerationRow = await prisma.searchIndexGeneration.findUnique({
    where: { id: passBinding.indexGenerationId },
  });
  if (
    !searchGenerationRow ||
    searchGenerationRow.status !== "READY" ||
    searchGenerationRow.scope !== "DRAFT" ||
    searchGenerationRow.versionId !== version.id ||
    searchGenerationRow.pipelineRunId !== passRun.id ||
    searchGenerationRow.normalizedDocumentId !== nd.id ||
    searchGenerationRow.fingerprint !== nd.fingerprint ||
    searchGenerationRow.chunkGenerationId !== passBinding.indexGenerationId ||
    searchGenerationRow.chunkCount <= 0 ||
    searchGenerationRow.embeddedCount !== searchGenerationRow.chunkCount ||
    searchGenerationRow.failedCount !== 0
  ) {
    return {
      error: "INCOMPLETE",
      message:
        "READY 상태의 검색 인덱스 세대가 없어 검수요청할 수 없습니다. 검색 데이터를 다시 생성·검증해 주세요.",
      missingRequirements: ["SEARCH_GENERATION_REQUIRED"],
    };
  }

  const snapshot = buildDoclingBundleReviewSubmitSnapshot({
    submittedVersionId: version.id,
    doclingBundleId: doclingBundle.id,
    sourceFileId: sourceFile.id,
    jsonPayloadFileId: jsonFile.id,
    markdownPayloadFileId: mdFile?.id ?? null,
    checksums: {
      source: sourceFile.checksumSha256,
      json: jsonFile.checksumSha256,
      markdown: mdFile?.checksumSha256 ?? null,
    },
    doclingSchemaVersion: doclingBundle.doclingSchemaVersion,
    adapterVersion: nd.adapterVersion,
    normalizedDocumentId: nd.id,
    fingerprint: nd.fingerprint,
    warningCount: doclingBundle.warningCount,
    sourceTitle: meta.sourceTitle,
    licenseName: meta.licenseName,
    visibility: meta.visibility,
    allowDownload: meta.allowDownload,
    allowApi: meta.allowApi,
    allowMcp: meta.allowMcp,
    serviceEndsAt: meta.serviceEndsAt?.toISOString() ?? null,
    rightsBasis: meta.rightsBasis,
    rightsBasisDetail: meta.rightsBasisDetail,
    rightsConfirmedAt: meta.rightsConfirmedAt?.toISOString() ?? null,
    sourceUrl: meta.sourceUrl,
    sourcePublisherName: meta.sourcePublisherName,
    sourceDocumentVersion: meta.sourceDocumentVersion,
    sourcePublishedAt: meta.sourcePublishedAt?.toISOString() ?? null,
    sourceRetrievedAt: meta.sourceRetrievedAt?.toISOString() ?? null,
    serviceValidation: {
      API: {
        status: preparationValidation.API.status,
        runId: preparationValidation.API.runId,
        testedAt: preparationValidation.API.testedAt,
        providerConfirmationStatus: preparationValidation.API.providerConfirmationStatus,
        providerConfirmationId: preparationValidation.API.providerConfirmationId,
        confirmedAt: preparationValidation.API.confirmedAt,
      },
      MCP: {
        status: preparationValidation.MCP.status,
        runId: preparationValidation.MCP.runId,
        testedAt: preparationValidation.MCP.testedAt,
        providerConfirmationStatus: preparationValidation.MCP.providerConfirmationStatus,
        providerConfirmationId: preparationValidation.MCP.providerConfirmationId,
        confirmedAt: preparationValidation.MCP.confirmedAt,
      },
      DOWNLOAD: {
        status: preparationValidation.DOWNLOAD.status,
        runId: preparationValidation.DOWNLOAD.runId,
        testedAt: preparationValidation.DOWNLOAD.testedAt,
        providerConfirmationStatus: preparationValidation.DOWNLOAD.providerConfirmationStatus,
        providerConfirmationId: preparationValidation.DOWNLOAD.providerConfirmationId,
        confirmedAt: preparationValidation.DOWNLOAD.confirmedAt,
      },
    },
    preparationValidation,
    distributionChannels: {
      allowApi: meta.allowApi,
      allowMcp: meta.allowMcp,
      allowDownload: meta.allowDownload,
    },
    language: packLanguage,
    pipelineRunId: passRun.id,
    indexGenerationId: passBinding.indexGenerationId,
    searchIndexGenerationId: searchGenerationRow.id,
    searchGenerationFingerprint: searchGenerationRow.generationFingerprint,
    chunkGenerationId: searchGenerationRow.chunkGenerationId,
    embeddingProvider: searchGenerationRow.embeddingProvider,
    embeddingModel: searchGenerationRow.embeddingModel,
    embeddingModelRevision: searchGenerationRow.embeddingModelRevision,
    embeddingDimension: searchGenerationRow.embeddingDimension,
    distanceMetric: searchGenerationRow.distanceMetric,
    retrievalEvaluationStatus: "PASS",
    normalizedDocumentFingerprint: nd.fingerprint,
  });

  const { assertReviewSubmitEvidenceInTx, ReviewSubmitEvidenceError } = await import(
    "@/lib/distribution/review-submit-evidence"
  );

  try {
    await prisma.$transaction(async (tx) => {
      await acquireVersionUploadLock(tx, version.id, packId);

      const packLocked = await tx.knowledgePack.findFirst({
        where: { packId, providerProfileId: profile.id },
        select: { status: true },
      });
      if (!packLocked || packLocked.status !== PackStatus.DRAFT) {
        throw new Error("NOT_DRAFT");
      }

      const stagingInTx = await tx.doclingImportBundle.findFirst({
        where: {
          versionId: version.id,
          isActive: false,
          deletedAt: null,
          storageStatus: "ACTIVE",
        },
      });
      if (stagingInTx) {
        throw new Error("DOCLING_STAGING_BUNDLE_MUST_BE_RESOLVED");
      }

      const activeInTx = await tx.doclingImportBundle.findFirst({
        where: { id: doclingBundle.id, isActive: true },
      });
      if (!activeInTx || activeInTx.status !== DoclingImportBundleStatus.REVIEW_READY) {
        throw new Error("DOCLING_REVIEW_STATE_CONFLICT");
      }

      // §7 Re-validate the full evidence binding inside the transaction against the snapshot.
      await assertReviewSubmitEvidenceInTx(tx, {
        packId,
        versionId: version.id,
        providerProfileId: profile.id,
        snapshot,
      });

      await tx.knowledgePack.updateMany({
        where: { packId, status: PackStatus.DRAFT },
        data: { status: PackStatus.REVIEWING },
      }).then((result) => {
        if (result.count !== 1) throw new Error("NOT_DRAFT");
      });
      await tx.packReview.create({
        data: {
          packId,
          status: "PENDING",
          submitSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        },
      });
    });
  } catch (error) {
    if (error instanceof ReviewSubmitEvidenceError) {
      if (error.code === "NOT_DRAFT") return { error: "NOT_DRAFT" };
      if (error.code === "NOT_FOUND") return { error: "NOT_FOUND" };
      return {
        error: "INCOMPLETE",
        message: error.message,
        missingRequirements: [error.code],
      };
    }
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_DRAFT") return { error: "NOT_DRAFT" };
    if (code === "DOCLING_STAGING_BUNDLE_MUST_BE_RESOLVED") {
      return {
        error: "INCOMPLETE",
        message:
          "실패하거나 처리 중인 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 검수 요청하세요.",
      };
    }
    if (code === "DOCLING_REVIEW_STATE_CONFLICT") {
      return {
        error: "INCOMPLETE",
        message: "검수 제출 중 Bundle 상태가 변경되었습니다. 다시 시도하세요.",
      };
    }
    throw error;
  }

  await recordProviderAudit({
    action: AuditAction.DISTRIBUTION_SUBMITTED,
    entityType: "KnowledgePack",
    entityId: packId,
    actorUserId: userId,
    metadata: {
      packId,
      versionId: version.id,
      mode: "DOCLING_BUNDLE",
      doclingBundleId: doclingBundle.id,
      normalizedDocumentId: nd.id,
      submitSnapshot: snapshot,
    },
  });

  await recordProviderAudit({
    action: AuditAction.PROVIDER_PACK_SUBMIT,
    entityType: "KnowledgePack",
    entityId: packId,
    actorUserId: userId,
    metadata: { packId, mode: "DOCLING_BUNDLE", submitSnapshot: snapshot },
  });

  await recordProviderAudit({
    action: AuditAction.ADMIN_REVIEW_CREATE,
    entityType: "PackReview",
    entityId: packId,
    actorUserId: userId,
    metadata: { packId, status: "PENDING", mode: "DOCLING_BUNDLE", submitSnapshot: snapshot },
  });

  return { ok: true, snapshot };
}
