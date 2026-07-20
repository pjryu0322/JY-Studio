/**
 * Section builders for DoclingBundleReviewSubmitSnapshot.
 * Shape must stay identical to the previous flat builder.
 */
import type { PackLanguageCode } from "@/lib/pack-language";
import type { DoclingBundleReviewSubmitSnapshot } from "@/lib/distribution/distribution-submit-snapshot";

/** Keep in sync with REVIEW_SUBMIT_SNAPSHOT_VERSION (avoid circular import). */
const DOCLING_SNAPSHOT_SCHEMA_VERSION = 3 as const;

export type BuildDoclingBundleReviewSubmitSnapshotInput = {
  submittedVersionId: string;
  doclingBundleId: string;
  sourceFileId: string;
  jsonPayloadFileId: string;
  markdownPayloadFileId: string | null;
  checksums: { source: string; json: string; markdown: string | null };
  doclingSchemaVersion: string | null;
  adapterVersion: string;
  normalizedDocumentId: string;
  fingerprint: string | null;
  warningCount: number;
  sourceTitle: string | null;
  licenseName: string;
  visibility: string;
  allowDownload: boolean;
  allowApi?: boolean;
  allowMcp?: boolean;
  serviceEndsAt?: string | null;
  rightsBasis?: string | null;
  rightsBasisDetail?: string | null;
  rightsConfirmedAt?: string | null;
  sourceUrl?: string | null;
  sourcePublisherName?: string | null;
  sourceDocumentVersion?: string | null;
  sourcePublishedAt?: string | null;
  sourceRetrievedAt?: string | null;
  serviceValidation?: DoclingBundleReviewSubmitSnapshot["serviceValidation"];
  preparationValidation?: DoclingBundleReviewSubmitSnapshot["preparationValidation"];
  distributionChannels?: DoclingBundleReviewSubmitSnapshot["distributionChannels"];
  language: PackLanguageCode;
  pipelineRunId?: string | null;
  indexGenerationId?: string | null;
  searchIndexGenerationId?: string | null;
  searchGenerationFingerprint?: string | null;
  chunkGenerationId?: string | null;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingModelRevision?: string | null;
  embeddingDimension?: number | null;
  distanceMetric?: string | null;
  retrievalEvaluationStatus?: string | null;
  normalizedDocumentFingerprint?: string | null;
  snapshotSchemaVersion?: number;
};

export function buildDoclingSnapshotCoreFields(
  input: BuildDoclingBundleReviewSubmitSnapshotInput,
): Pick<
  DoclingBundleReviewSubmitSnapshot,
  | "mode"
  | "snapshotSchemaVersion"
  | "submittedAt"
  | "submittedVersionId"
  | "doclingBundleId"
  | "sourceFileId"
  | "jsonPayloadFileId"
  | "markdownPayloadFileId"
  | "checksums"
  | "doclingSchemaVersion"
  | "adapterVersion"
  | "normalizedDocumentId"
  | "fingerprint"
  | "warningCount"
  | "language"
> {
  return {
    mode: "DOCLING_BUNDLE",
    snapshotSchemaVersion: input.snapshotSchemaVersion ?? DOCLING_SNAPSHOT_SCHEMA_VERSION,
    submittedAt: new Date().toISOString(),
    submittedVersionId: input.submittedVersionId,
    doclingBundleId: input.doclingBundleId,
    sourceFileId: input.sourceFileId,
    jsonPayloadFileId: input.jsonPayloadFileId,
    markdownPayloadFileId: input.markdownPayloadFileId,
    checksums: input.checksums,
    doclingSchemaVersion: input.doclingSchemaVersion,
    adapterVersion: input.adapterVersion,
    normalizedDocumentId: input.normalizedDocumentId,
    fingerprint: input.fingerprint,
    warningCount: input.warningCount,
    language: input.language,
  };
}

export function buildDoclingSnapshotProviderMetaFields(
  input: BuildDoclingBundleReviewSubmitSnapshotInput,
): Pick<
  DoclingBundleReviewSubmitSnapshot,
  | "sourceTitle"
  | "licenseName"
  | "visibility"
  | "allowDownload"
  | "allowApi"
  | "allowMcp"
  | "serviceEndsAt"
  | "rightsBasis"
  | "rightsBasisDetail"
  | "rightsConfirmedAt"
  | "sourceUrl"
  | "sourcePublisherName"
  | "sourceDocumentVersion"
  | "sourcePublishedAt"
  | "sourceRetrievedAt"
> {
  return {
    sourceTitle: input.sourceTitle,
    licenseName: input.licenseName,
    visibility: input.visibility,
    allowDownload: input.allowDownload,
    allowApi: input.allowApi ?? true,
    allowMcp: input.allowMcp ?? true,
    serviceEndsAt: input.serviceEndsAt ?? null,
    rightsBasis: input.rightsBasis ?? null,
    rightsBasisDetail: input.rightsBasisDetail ?? null,
    rightsConfirmedAt: input.rightsConfirmedAt ?? null,
    sourceUrl: input.sourceUrl ?? null,
    sourcePublisherName: input.sourcePublisherName ?? null,
    sourceDocumentVersion: input.sourceDocumentVersion ?? null,
    sourcePublishedAt: input.sourcePublishedAt ?? null,
    sourceRetrievedAt: input.sourceRetrievedAt ?? null,
  };
}

export function buildDoclingSnapshotValidationFields(
  input: BuildDoclingBundleReviewSubmitSnapshotInput,
): Pick<
  DoclingBundleReviewSubmitSnapshot,
  "serviceValidation" | "preparationValidation" | "distributionChannels"
> {
  return {
    serviceValidation: input.serviceValidation ?? null,
    preparationValidation: input.preparationValidation ?? null,
    distributionChannels: input.distributionChannels ?? null,
  };
}

export function buildDoclingSnapshotBindingFields(
  input: BuildDoclingBundleReviewSubmitSnapshotInput,
): Pick<
  DoclingBundleReviewSubmitSnapshot,
  | "pipelineRunId"
  | "indexGenerationId"
  | "searchIndexGenerationId"
  | "searchGenerationFingerprint"
  | "chunkGenerationId"
  | "embeddingProvider"
  | "embeddingModel"
  | "embeddingModelRevision"
  | "embeddingDimension"
  | "distanceMetric"
  | "retrievalEvaluationStatus"
  | "normalizedDocumentFingerprint"
> {
  return {
    pipelineRunId: input.pipelineRunId ?? null,
    indexGenerationId: input.indexGenerationId ?? null,
    searchIndexGenerationId: input.searchIndexGenerationId ?? null,
    searchGenerationFingerprint: input.searchGenerationFingerprint ?? null,
    chunkGenerationId: input.chunkGenerationId ?? null,
    embeddingProvider: input.embeddingProvider ?? null,
    embeddingModel: input.embeddingModel ?? null,
    embeddingModelRevision: input.embeddingModelRevision ?? null,
    embeddingDimension: input.embeddingDimension ?? null,
    distanceMetric: input.distanceMetric ?? null,
    retrievalEvaluationStatus: input.retrievalEvaluationStatus ?? null,
    normalizedDocumentFingerprint:
      input.normalizedDocumentFingerprint ?? input.fingerprint ?? null,
  };
}

export function assembleDoclingBundleReviewSubmitSnapshot(
  input: BuildDoclingBundleReviewSubmitSnapshotInput,
): DoclingBundleReviewSubmitSnapshot {
  return {
    ...buildDoclingSnapshotCoreFields(input),
    ...buildDoclingSnapshotProviderMetaFields(input),
    ...buildDoclingSnapshotValidationFields(input),
    ...buildDoclingSnapshotBindingFields(input),
  };
}
