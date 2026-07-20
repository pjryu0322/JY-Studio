import { findOrEnsureProviderProfileForUser } from "@/lib/provider-profile-service";
import type { PackLanguageCode } from "@/lib/pack-language";
import {
  buildDoclingBundleReviewSubmitSnapshot,
  type DoclingBundleReviewSubmitSnapshot,
  type ReviewSubmitSnapshot,
} from "@/lib/distribution/distribution-submit-snapshot";
import {
  assertPreparationValidationsOrError,
  checkDistributionMetadataCompleteOrError,
  checkEmbeddingDescriptorOperationalOrError,
  checkKnowledgePipelineAndDistributionReadyOrError,
  checkNoLiveStagingBundleOrError,
  checkRetrievalEvaluationPolicyCurrentOrError,
  checkSourceMaterialsReadyOrError,
  loadCurrentKnowledgeRunBindingOrError,
  loadDraftPackContextOrError,
  loadReadySearchGenerationOrError,
  loadReviewReadyDoclingBundleOrError,
  resolveDoclingBundleFilesOrError,
  type ActiveDoclingBundle,
  type CommitDistributionMetadata,
  type CurrentKnowledgeRunBinding,
  type DistributionSubmitCommitError,
  type ResolvedDoclingBundleFiles,
} from "@/lib/distribution/distribution-submit-commit-steps";
import {
  recordReviewSubmitCommitAudits,
  runReviewSubmitCommitTransactionOrError,
} from "@/lib/distribution/distribution-submit-commit-tx";

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
  | DistributionSubmitCommitError
  | { ok: true; snapshot: ReviewSubmitSnapshot };

type NonError<T> = Exclude<T, DistributionSubmitCommitError>;

type CommitSnapshotContext = {
  version: { id: string; language: string | null };
  doclingBundle: ActiveDoclingBundle;
  files: ResolvedDoclingBundleFiles;
  meta: NonNullable<CommitDistributionMetadata>;
  packLanguage: PackLanguageCode;
  binding: CurrentKnowledgeRunBinding;
  preparationValidation: NonError<Awaited<ReturnType<typeof assertPreparationValidationsOrError>>>;
  searchGenerationRow: NonError<Awaited<ReturnType<typeof loadReadySearchGenerationOrError>>>;
};

/** Pure: assemble the Docling-bundle review-submit snapshot from every resolved fact. */
function buildCommitReviewSubmitSnapshot(ctx: CommitSnapshotContext): DoclingBundleReviewSubmitSnapshot {
  const { doclingBundle, files, meta, binding, preparationValidation, searchGenerationRow } = ctx;
  const { sourceFile, jsonFile, mdFile, nd } = files;
  return buildDoclingBundleReviewSubmitSnapshot({
    submittedVersionId: ctx.version.id,
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
    language: ctx.packLanguage,
    pipelineRunId: binding.passRun.id,
    indexGenerationId: binding.passBinding.indexGenerationId,
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
}

function isCommitError(
  value: unknown,
): value is DistributionSubmitCommitError {
  return Boolean(value) && typeof value === "object" && value !== null && "error" in value;
}

/**
 * Validate and commit a Docling distribution pack into REVIEWING + PackReview PENDING.
 *
 * Each precondition is resolved by a small `*OrError` step (see
 * `distribution-submit-commit-steps.ts`); this orchestrator only sequences them
 * with early returns, then builds the snapshot and runs the commit transaction.
 */
export async function commitDistributionPackForReview(
  userId: string,
  clientId: string,
  packId: string,
): Promise<DistributionSubmitCommitResult> {
  const profile = await findOrEnsureProviderProfileForUser(userId, clientId);
  if (!profile) return { error: "PROFILE_REQUIRED" };

  const draftContext = await loadDraftPackContextOrError(profile.id, packId);
  if (isCommitError(draftContext)) return draftContext;
  const { version, packLanguage } = draftContext;
  const meta = version.distributionMetadata;

  const stagingBeforeLoad = await checkNoLiveStagingBundleOrError(version.id);
  if (stagingBeforeLoad) return stagingBeforeLoad;

  const doclingBundle = await loadReviewReadyDoclingBundleOrError(version.id);
  if (isCommitError(doclingBundle)) return doclingBundle;

  // Re-check live staging before the Docling submit path proceeds.
  const stagingAfterLoad = await checkNoLiveStagingBundleOrError(version.id);
  if (stagingAfterLoad) return stagingAfterLoad;

  const pipelineReadyError = await checkKnowledgePipelineAndDistributionReadyOrError(packId, meta);
  if (pipelineReadyError) return pipelineReadyError;

  const files = resolveDoclingBundleFilesOrError(doclingBundle);
  if (isCommitError(files)) return files;
  const { nd } = files;

  const materialsError = await checkSourceMaterialsReadyOrError(doclingBundle, nd);
  if (materialsError) return materialsError;

  const metaError = checkDistributionMetadataCompleteOrError(meta);
  if (metaError) return metaError;

  const binding = await loadCurrentKnowledgeRunBindingOrError(packId, nd, version.id);
  if (isCommitError(binding)) return binding;

  const policyError = checkRetrievalEvaluationPolicyCurrentOrError(binding.evalStep);
  if (policyError) return policyError;

  const preparationValidation = await assertPreparationValidationsOrError({
    packId,
    versionId: version.id,
    meta: meta!,
    fingerprint: nd.fingerprint,
    indexGenerationId: binding.passBinding.indexGenerationId,
    pipelineRunId: binding.passRun.id,
    normalizedDocumentId: nd.id,
  });
  if (isCommitError(preparationValidation)) return preparationValidation;

  const searchGenerationRow = await loadReadySearchGenerationOrError({
    indexGenerationId: binding.passBinding.indexGenerationId,
    versionId: version.id,
    passRunId: binding.passRun.id,
    ndId: nd.id,
    ndFingerprint: nd.fingerprint,
  });
  if (isCommitError(searchGenerationRow)) return searchGenerationRow;

  const descriptorError = await checkEmbeddingDescriptorOperationalOrError(searchGenerationRow);
  if (descriptorError) return descriptorError;

  const snapshot = buildCommitReviewSubmitSnapshot({
    version,
    doclingBundle,
    files,
    meta: meta!,
    packLanguage,
    binding,
    preparationValidation,
    searchGenerationRow,
  });

  const txError = await runReviewSubmitCommitTransactionOrError({
    packId,
    providerProfileId: profile.id,
    versionId: version.id,
    doclingBundleId: doclingBundle.id,
    snapshot,
  });
  if (txError) return txError;

  await recordReviewSubmitCommitAudits({
    userId,
    packId,
    versionId: version.id,
    doclingBundleId: doclingBundle.id,
    normalizedDocumentId: nd.id,
    snapshot,
  });

  return { ok: true, snapshot };
}
