/**
 * Step-by-step DB reads + pure eligibility checks for `commitDistributionPackForReview`.
 *
 * Each `*OrError` helper does at most one DB read plus a narrow, single-purpose
 * check, returning either the resolved data or a {@link DistributionSubmitCommitError}.
 * The orchestrator in `distribution-submit-service.ts` sequences these with early
 * returns instead of inlining every branch into one large function.
 */
import { DoclingImportBundleStatus, KnowledgePackFileRole, PackStatus } from "@prisma/client";
import { findLatestStagingBundleForVersion } from "@/lib/docling-import/docling-import-lifecycle-service";
import { latestKnowledgePackVersionOrderBy } from "@/lib/distribution/latest-distribution-state";
import { toPackLanguageCode, type PackLanguageCode } from "@/lib/pack-language";
import { prisma } from "@/lib/prisma";
import { RETRIEVAL_RANKING_POLICY_VERSION } from "@/lib/retrieval/relevance-diversity-rerank";

export type DistributionSubmitCommitError =
  | { error: "PROFILE_REQUIRED" }
  | { error: "NOT_FOUND" }
  | { error: "NOT_DRAFT" }
  | { error: "INCOMPLETE"; message: string; missingRequirements?: string[] };

function isCommitError<T>(value: T | DistributionSubmitCommitError): value is DistributionSubmitCommitError {
  return Boolean(value) && typeof value === "object" && "error" in (value as object);
}

async function fetchDraftPackWithLatestVersion(providerProfileId: string, packId: string) {
  return prisma.knowledgePack.findFirst({
    where: { packId, providerProfileId },
    include: {
      versions: {
        orderBy: latestKnowledgePackVersionOrderBy,
        take: 1,
        include: { distributionMetadata: true },
      },
    },
  });
}
type DraftPackWithLatestVersion = NonNullable<Awaited<ReturnType<typeof fetchDraftPackWithLatestVersion>>>;
export type CommitDistributionPackVersion = DraftPackWithLatestVersion["versions"][number];
export type CommitDistributionMetadata = CommitDistributionPackVersion["distributionMetadata"];

/** Pure: NOT_FOUND / NOT_DRAFT / basic-fields checks on the fetched pack row. */
function checkPackDraftBasicsOrError(
  pack: Awaited<ReturnType<typeof fetchDraftPackWithLatestVersion>>,
): DistributionSubmitCommitError | null {
  if (!pack) return { error: "NOT_FOUND" };
  if (pack.status !== PackStatus.DRAFT) return { error: "NOT_DRAFT" };
  if (!pack.categoryId || !pack.shortDescription.trim() || !pack.description.trim()) {
    return { error: "INCOMPLETE", message: "카테고리와 설명을 확인해 주세요." };
  }
  return null;
}

/** Pure: a version must exist and carry a recognized pack-language code. */
function checkVersionAndLanguageOrError(
  version: CommitDistributionPackVersion | undefined,
): DistributionSubmitCommitError | { packLanguage: PackLanguageCode } {
  if (!version) return { error: "INCOMPLETE", message: "버전이 최소 1개 필요합니다." };
  const packLanguage = toPackLanguageCode(version.language);
  if (!packLanguage) {
    return { error: "INCOMPLETE", message: "문서 언어를 선택해 주세요." };
  }
  return { packLanguage };
}

/** DB read + basics/version/language checks for the draft pack being submitted. */
export async function loadDraftPackContextOrError(
  providerProfileId: string,
  packId: string,
): Promise<
  | DistributionSubmitCommitError
  | { pack: DraftPackWithLatestVersion; version: CommitDistributionPackVersion; packLanguage: PackLanguageCode }
> {
  const pack = await fetchDraftPackWithLatestVersion(providerProfileId, packId);
  const basicsError = checkPackDraftBasicsOrError(pack);
  if (basicsError) return basicsError;
  const version = pack!.versions[0];
  const langResult = checkVersionAndLanguageOrError(version);
  if (isCommitError(langResult)) return langResult;
  return { pack: pack!, version, packLanguage: langResult.packLanguage };
}

const LIVE_STAGING_BUNDLE_MESSAGE =
  "실패하거나 처리 중인 Staging Bundle이 있습니다. 재시도하거나 삭제한 후 검수 요청하세요.";

/** DB read: no failed/in-progress staging bundle may exist for this version. */
export async function checkNoLiveStagingBundleOrError(
  versionId: string,
): Promise<DistributionSubmitCommitError | null> {
  const liveStaging = await findLatestStagingBundleForVersion(versionId);
  if (!liveStaging) return null;
  return { error: "INCOMPLETE", message: LIVE_STAGING_BUNDLE_MESSAGE };
}

async function fetchActiveDoclingBundle(versionId: string) {
  return prisma.doclingImportBundle.findFirst({
    where: { versionId, isActive: true },
    include: {
      files: true,
      normalizedDocuments: { where: { isActive: true }, take: 1 },
    },
  });
}
export type ActiveDoclingBundle = NonNullable<Awaited<ReturnType<typeof fetchActiveDoclingBundle>>>;

/** DB read: the active Docling bundle for this version must be REVIEW_READY. */
export async function loadReviewReadyDoclingBundleOrError(
  versionId: string,
): Promise<DistributionSubmitCommitError | ActiveDoclingBundle> {
  const doclingBundle = await fetchActiveDoclingBundle(versionId);
  if (!doclingBundle || doclingBundle.status !== DoclingImportBundleStatus.REVIEW_READY) {
    return {
      error: "INCOMPLETE",
      message:
        "원본문서와 구조화 JSON이 정상 처리되어 REVIEW_READY 상태여야 검수 요청할 수 있습니다.",
      missingRequirements: ["DOCLING_REVIEW_READY"],
    };
  }
  return doclingBundle;
}

/** Knowledge pipeline pass + distribution readiness (dynamic-import policy checks). */
export async function checkKnowledgePipelineAndDistributionReadyOrError(
  packId: string,
  meta: CommitDistributionMetadata,
): Promise<DistributionSubmitCommitError | null> {
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
  if (knowledgePassed && distributionReady) return null;
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

const DOCLING_MATERIALS_NOT_READY_MESSAGE =
  "원본문서와 구조화 JSON이 정상 처리되어 REVIEW_READY 상태여야 검수 요청할 수 있습니다.";

export type ResolvedDoclingBundleFiles = {
  sourceFile: ActiveDoclingBundle["files"][number];
  jsonFile: ActiveDoclingBundle["files"][number];
  mdFile: ActiveDoclingBundle["files"][number] | null;
  nd: ActiveDoclingBundle["normalizedDocuments"][number];
};

/** Pure: pick the required by-role files + normalized document off the bundle. */
export function resolveDoclingBundleFilesOrError(
  doclingBundle: ActiveDoclingBundle,
): DistributionSubmitCommitError | ResolvedDoclingBundleFiles {
  const byRole = new Map(doclingBundle.files.map((f) => [f.role, f]));
  const sourceFile = byRole.get(KnowledgePackFileRole.SOURCE_ORIGINAL);
  const jsonFile = byRole.get(KnowledgePackFileRole.DOCLING_JSON);
  const mdFile = byRole.get(KnowledgePackFileRole.DOCLING_MARKDOWN) ?? null;
  const nd = doclingBundle.normalizedDocuments[0];
  if (!sourceFile || !jsonFile || !nd) {
    return { error: "INCOMPLETE", message: DOCLING_MATERIALS_NOT_READY_MESSAGE };
  }
  return { sourceFile, jsonFile, mdFile, nd };
}

/** §8 common source-materials readiness (dynamic-import policy check). */
export async function checkSourceMaterialsReadyOrError(
  doclingBundle: ActiveDoclingBundle,
  nd: ResolvedDoclingBundleFiles["nd"],
): Promise<DistributionSubmitCommitError | null> {
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
  if (sourceMaterialsReady) return null;
  return {
    error: "INCOMPLETE",
    message: DOCLING_MATERIALS_NOT_READY_MESSAGE,
    missingRequirements: ["SOURCE_MATERIALS_NOT_READY"],
  };
}

/** Pure: distribution metadata must be present with source/rights/license fields. */
export function checkDistributionMetadataCompleteOrError(
  meta: CommitDistributionMetadata,
): DistributionSubmitCommitError | null {
  if (!meta) {
    return { error: "INCOMPLETE", message: "유통정보(출처·제공 방식·유통 권한)를 입력해 주세요." };
  }
  if (!meta.sourceTitle?.trim() && !meta.sourceUrl?.trim()) {
    return { error: "INCOMPLETE", message: "출처 제목 또는 출처 URL이 필요합니다." };
  }
  if (!meta.rightsBasis || !meta.rightsConfirmedAt) {
    return { error: "INCOMPLETE", message: "유통 권한 근거와 확인이 필요합니다." };
  }
  if (!meta.licenseName.trim()) {
    return { error: "INCOMPLETE", message: "라이선스명이 필요합니다." };
  }
  return null;
}

async function fetchKnowledgeRunPass(packId: string) {
  const { DOCLING_KNOWLEDGE_PIPELINE_TRIGGER } = await import(
    "@/lib/docling-knowledge/docling-knowledge-stages"
  );
  return prisma.pipelineRun.findFirst({
    where: { packId, triggerType: DOCLING_KNOWLEDGE_PIPELINE_TRIGGER, status: "PASS" },
    orderBy: { startedAt: "desc" },
    include: { steps: true },
  });
}
type KnowledgeRunPass = NonNullable<Awaited<ReturnType<typeof fetchKnowledgeRunPass>>>;

export type CurrentKnowledgeRunBinding = {
  passRun: KnowledgeRunPass;
  passBinding: NonNullable<
    Awaited<ReturnType<(typeof import("@/lib/docling-knowledge/docling-knowledge-run-binding"))["parseKnowledgeRunBinding"]>>
  >;
  evalStep: KnowledgeRunPass["steps"][number];
};

/** Pure: the loaded run/binding must target the current normalized document + version and have PASSed evaluation. */
function isKnowledgeRunBindingCurrent(
  passRun: KnowledgeRunPass | null,
  passBinding: CurrentKnowledgeRunBinding["passBinding"] | null,
  evalStep: KnowledgeRunPass["steps"][number] | undefined,
  nd: { id: string; fingerprint: string | null },
  versionId: string,
): boolean {
  return Boolean(
    passRun &&
      passBinding &&
      passBinding.normalizedDocumentId === nd.id &&
      passBinding.fingerprint === nd.fingerprint &&
      passBinding.versionId === versionId &&
      evalStep?.status === "PASS",
  );
}

const RETRIEVAL_EVALUATION_NOT_CURRENT_MESSAGE =
  "지식 데이터 생성(검색 결과 검증)이 현재 정규화 결과와 일치하지 않습니다. 다시 생성해 주세요.";

/** DB read: the latest PASSed knowledge-pipeline run, checked against the current ND/version binding. */
export async function loadCurrentKnowledgeRunBindingOrError(
  packId: string,
  nd: { id: string; fingerprint: string | null },
  versionId: string,
): Promise<DistributionSubmitCommitError | CurrentKnowledgeRunBinding> {
  const passRun = await fetchKnowledgeRunPass(packId);
  const { parseKnowledgeRunBinding } = await import(
    "@/lib/docling-knowledge/docling-knowledge-run-binding"
  );
  const passBinding = parseKnowledgeRunBinding(passRun?.summary ?? null);
  const evalStep = passRun?.steps.find((s) => s.step === "SEARCH_EVALUATING");
  if (!isKnowledgeRunBindingCurrent(passRun, passBinding, evalStep, nd, versionId)) {
    return {
      error: "INCOMPLETE",
      message: RETRIEVAL_EVALUATION_NOT_CURRENT_MESSAGE,
      missingRequirements: ["RETRIEVAL_EVALUATION_PASSED"],
    };
  }
  return { passRun: passRun!, passBinding: passBinding!, evalStep: evalStep! };
}

/** Pure: the evaluation step's recorded ranking-policy version must match the current one. */
export function checkRetrievalEvaluationPolicyCurrentOrError(
  evalStep: { details: unknown },
): DistributionSubmitCommitError | null {
  const evalDetails =
    evalStep.details && typeof evalStep.details === "object" && !Array.isArray(evalStep.details)
      ? (evalStep.details as Record<string, unknown>)
      : null;
  const evalPolicy =
    typeof evalDetails?.retrievalRankingPolicyVersion === "string"
      ? evalDetails.retrievalRankingPolicyVersion.trim()
      : "";
  if (evalPolicy === RETRIEVAL_RANKING_POLICY_VERSION) return null;
  return {
    error: "INCOMPLETE",
    message: "검색 순위 정책이 변경되었습니다. 자동 검색 평가를 다시 실행해 주세요.",
    missingRequirements: ["RETRIEVAL_EVALUATION_POLICY_CURRENT"],
  };
}

/** Runs §9 preparation-channel validation assertions, mapping PayloadServiceError to INCOMPLETE. */
export async function assertPreparationValidationsOrError(input: {
  packId: string;
  versionId: string;
  meta: NonNullable<CommitDistributionMetadata>;
  fingerprint: string | null;
  indexGenerationId: string | null | undefined;
  pipelineRunId: string;
  normalizedDocumentId: string;
}) {
  try {
    const { assertPreparationServiceValidationsPassed } = await import(
      "@/lib/distribution/service-validation-service"
    );
    const { assertDistributionChannelsSelected } = await import(
      "@/lib/distribution/service-channel-policy"
    );
    assertDistributionChannelsSelected(input.meta);
    return await assertPreparationServiceValidationsPassed({
      packId: input.packId,
      versionId: input.versionId,
      bindingFingerprint: input.fingerprint,
      bindingIndexGenerationId: input.indexGenerationId,
      pipelineRunId: input.pipelineRunId,
      normalizedDocumentId: input.normalizedDocumentId,
    });
  } catch (error) {
    const { isPayloadServiceError } = await import("@/lib/distribution/payload-errors");
    if (isPayloadServiceError(error)) {
      return {
        error: "INCOMPLETE",
        message: error.message,
        missingRequirements: [error.code],
      } as DistributionSubmitCommitError;
    }
    throw error;
  }
}

async function fetchSearchIndexGenerationById(id: string) {
  return prisma.searchIndexGeneration.findUnique({ where: { id } });
}
type SearchIndexGenerationRow = NonNullable<Awaited<ReturnType<typeof fetchSearchIndexGenerationById>>>;

/** Pure: P4.1 — the generation row must be READY/DRAFT and bound to the current run/ND/binding. */
function isSearchGenerationRowValid(
  row: SearchIndexGenerationRow | null,
  ctx: {
    versionId: string;
    passRunId: string;
    ndId: string;
    ndFingerprint: string | null;
    indexGenerationId: string | null | undefined;
  },
): boolean {
  return Boolean(
    row &&
      row.status === "READY" &&
      row.scope === "DRAFT" &&
      row.versionId === ctx.versionId &&
      row.pipelineRunId === ctx.passRunId &&
      row.normalizedDocumentId === ctx.ndId &&
      row.fingerprint === ctx.ndFingerprint &&
      row.chunkGenerationId === ctx.indexGenerationId &&
      row.chunkCount > 0 &&
      row.embeddedCount === row.chunkCount &&
      row.failedCount === 0,
  );
}

/** DB read: the READY SearchIndexGeneration required for Snapshot V3 submit (P4.1). */
export async function loadReadySearchGenerationOrError(ctx: {
  indexGenerationId: string;
  versionId: string;
  passRunId: string;
  ndId: string;
  ndFingerprint: string | null;
}): Promise<DistributionSubmitCommitError | SearchIndexGenerationRow> {
  const row = await fetchSearchIndexGenerationById(ctx.indexGenerationId);
  if (!isSearchGenerationRowValid(row, ctx)) {
    return {
      error: "INCOMPLETE",
      message:
        "READY 상태의 검색 인덱스 세대가 없어 검수요청할 수 없습니다. 검색 데이터를 다시 생성·검증해 주세요.",
      missingRequirements: ["SEARCH_GENERATION_REQUIRED"],
    };
  }
  return row!;
}

/** P5.1: Snapshot creation requires an operational (pinned-SHA) embedding descriptor. */
export async function checkEmbeddingDescriptorOperationalOrError(
  searchGenerationRow: SearchIndexGenerationRow,
): Promise<DistributionSubmitCommitError | null> {
  const { validateOperationalEmbeddingDescriptor } = await import(
    "@/lib/search-generation/search-generation-descriptor"
  );
  const descriptorCheck = validateOperationalEmbeddingDescriptor(searchGenerationRow);
  if (descriptorCheck.ok) return null;
  return {
    error: "INCOMPLETE",
    message:
      "검색 인덱스 세대의 Embedding descriptor가 운영 기준에 맞지 않습니다. 검색 데이터를 다시 생성해 주세요.",
    missingRequirements: [descriptorCheck.code],
  };
}
